from rest_framework import serializers

from .models import Shipment, ShipmentEvent


class ShipmentEventSerializer(serializers.ModelSerializer):
    created_by_email = serializers.CharField(source="created_by.email", read_only=True)

    class Meta:
        model = ShipmentEvent
        fields = (
            "id",
            "status",
            "description",
            "location",
            "created_by_email",
            "created_at",
        )


class ShipmentSerializer(serializers.ModelSerializer):
    events = ShipmentEventSerializer(many=True, read_only=True)
    seller_name = serializers.CharField(source="seller.business_name", read_only=True, default=None)
    seller_subtotal = serializers.SerializerMethodField()
    cancellation = serializers.SerializerMethodField()
    cancellation_pending = serializers.SerializerMethodField()
    can_request_cancellation = serializers.SerializerMethodField()

    class Meta:
        model = Shipment
        fields = (
            "id",
            "seller",
            "seller_name",
            "seller_subtotal",
            "cancellation",
            "cancellation_pending",
            "can_request_cancellation",
            "tracking_code",
            "status",
            "carrier",
            "estimated_delivery_date",
            "delivered_at",
            "events",
            "created_at",
            "updated_at",
        )

    def get_seller_subtotal(self, obj):
        from decimal import Decimal
        return format(sum((item.total_price for item in obj.order.items.all() if item.seller_id == obj.seller_id), Decimal("0.00")), ".2f")

    def get_cancellation(self, obj):
        from apps.aftersales.serializers import CancellationSerializer
        case = next(iter(obj.cancellations.all()), None)
        return CancellationSerializer(case, context=self.context).data if case else None

    def get_cancellation_pending(self, obj):
        from apps.aftersales.services import OPEN_STATUSES
        return any(case.status in OPEN_STATUSES for case in obj.cancellations.all())

    def get_can_request_cancellation(self, obj):
        from apps.aftersales.services import can_request_cancellation
        return can_request_cancellation(obj)

class ShipmentStatusUpdateSerializer(serializers.ModelSerializer):
    description = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
        write_only=True,
    )
    location = serializers.CharField(
        max_length=120,
        required=False,
        allow_blank=True,
        write_only=True,
    )

    class Meta:
        model = Shipment
        fields = (
            "status",
            "carrier",
            "estimated_delivery_date",
            "description",
            "location",
        )

    def update(self, instance, validated_data):
        from .services import update_seller_shipment

        return update_seller_shipment(
            shipment_id=instance.id,
            order_id=instance.order_id,
            user=self.context["request"].user,
            changes=validated_data,
        )

    def to_representation(self, instance):
        return ShipmentSerializer(instance, context=self.context).data
