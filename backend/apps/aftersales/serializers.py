from decimal import Decimal

from rest_framework import serializers

from .models import CancellationEvent, CancellationRequest, ReturnInspection


class InspectionSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="order_item.product_name", read_only=True)
    quarantined_quantity = serializers.IntegerField(read_only=True)

    class Meta:
        model = ReturnInspection
        fields = (
            "id", "order_item", "product_name", "expected_quantity", "received_quantity",
            "restocked_quantity", "defective_quantity", "quarantined_quantity",
            "received_at", "inspected_at",
        )
        read_only_fields = fields


class CancellationEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = CancellationEvent
        fields = ("id", "status", "action", "description", "created_at")
        read_only_fields = fields


class CancellationSerializer(serializers.ModelSerializer):
    order_id = serializers.IntegerField(source="shipment.order_id", read_only=True)
    order_number = serializers.CharField(source="shipment.order.order_number", read_only=True)
    seller = serializers.IntegerField(source="shipment.seller_id", read_only=True, allow_null=True)
    seller_name = serializers.CharField(source="shipment.seller.business_name", read_only=True, default=None)
    inspections = InspectionSerializer(many=True, read_only=True)
    events = CancellationEventSerializer(many=True, read_only=True)
    refunded_amount = serializers.SerializerMethodField()

    class Meta:
        model = CancellationRequest
        fields = (
            "id", "shipment", "order_id", "order_number", "seller", "seller_name",
            "status", "reason", "resolution", "is_pre_dispatch", "inspections", "events",
            "refunded_amount", "created_at", "updated_at",
        )
        read_only_fields = fields

    def get_refunded_amount(self, obj) -> str:
        return format(sum((refund.amount for refund in obj.refunds.all()), Decimal("0.00")), ".2f")

    def get_shipping_refundable_amount(self, obj) -> str:
        from apps.payments.models import PaymentRefund
        order = obj.shipment.order
        payment = getattr(order, "payment", None)
        if payment is None:
            return "0.00"
        shipping_refunds = sum(
            (refund.amount for refund in payment.refunds.all() if refund.kind == PaymentRefund.Kind.SHIPPING),
            Decimal("0.00"),
        )
        return format(max(Decimal("0.00"), min(order.shipping_cost - shipping_refunds, payment.refundable_amount)), ".2f")


class AdminCancellationSerializer(CancellationSerializer):
    shipping_refundable_amount = serializers.SerializerMethodField()

    class Meta(CancellationSerializer.Meta):
        fields = CancellationSerializer.Meta.fields + ("admin_note", "shipping_refundable_amount")
        read_only_fields = fields


class CancellationCreateSerializer(serializers.Serializer):
    reason = serializers.CharField(min_length=10, max_length=1000, trim_whitespace=True)


class CancellationItemSerializer(serializers.Serializer):
    order_item = serializers.IntegerField(min_value=1)
    received_quantity = serializers.IntegerField(min_value=0, required=False)
    restocked_quantity = serializers.IntegerField(min_value=0, required=False)
    defective_quantity = serializers.IntegerField(min_value=0, required=False)


class CancellationActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=("start_return", "receive", "inspect", "complete", "reject", "refund_shipping"))
    resolution = serializers.CharField(max_length=1000, required=False, allow_blank=True, trim_whitespace=True)
    items = CancellationItemSerializer(many=True, required=False)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"), required=False)
    operation_key = serializers.CharField(max_length=160, required=False, allow_blank=False)

    def validate(self, attrs):
        action = attrs["action"]
        text = attrs.get("resolution", "")
        if action in {"inspect", "reject", "refund_shipping"} and len(text) < 10:
            raise serializers.ValidationError({"resolution": "Describe el resultado o motivo en al menos 10 caracteres."})
        if action in {"receive", "inspect"} and not attrs.get("items"):
            raise serializers.ValidationError({"items": "Indica los productos y sus cantidades acumuladas."})
        if action == "refund_shipping":
            if "amount" not in attrs or "operation_key" not in attrs:
                raise serializers.ValidationError({"amount": "Indica el importe y la referencia única de operación."})
            if len(text) > 255:
                raise serializers.ValidationError({"resolution": "El motivo del reembolso debe tener hasta 255 caracteres."})
        return attrs
