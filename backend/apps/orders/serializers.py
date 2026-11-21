from decimal import Decimal

from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field

from apps.payments.models import Payment
from apps.payments.serializers import PaymentSerializer
from apps.shipments.models import Shipment
from apps.shipments.serializers import ShipmentSerializer
from apps.shipments.services import seller_order_status, update_seller_shipment

from .models import Order, OrderItem
from .checkout import confirm_checkout, find_replay, read_quote, request_fingerprint, validate_cart_item


class DeliveryAddressSnapshotSerializer(serializers.Serializer):
    region_id = serializers.IntegerField()
    region_name = serializers.CharField()
    street = serializers.CharField()
    number = serializers.CharField()
    city = serializers.CharField()
    province = serializers.CharField()
    postal_code = serializers.CharField(allow_blank=True)
    reference = serializers.CharField(allow_blank=True)


class CheckoutQuoteItemSerializer(serializers.Serializer):
    cart_item_id = serializers.IntegerField()
    product_id = serializers.IntegerField()
    product_name = serializers.CharField()
    sku = serializers.CharField()
    seller_id = serializers.IntegerField()
    seller_name = serializers.CharField()
    quantity = serializers.IntegerField(min_value=1)
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_price = serializers.DecimalField(max_digits=12, decimal_places=2)


class CheckoutQuoteResponseSerializer(serializers.Serializer):
    quote_token = serializers.CharField()
    expires_at = serializers.DateTimeField()
    cart_id = serializers.IntegerField()
    items = CheckoutQuoteItemSerializer(many=True)
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2)
    discount_total = serializers.DecimalField(max_digits=12, decimal_places=2)
    shipping_cost = serializers.DecimalField(max_digits=12, decimal_places=2)
    total = serializers.DecimalField(max_digits=12, decimal_places=2)
    currency = serializers.ChoiceField(choices=["ARS"])
    shipping_address_snapshot = DeliveryAddressSnapshotSerializer()
    price_changed = serializers.BooleanField()


class CheckoutConflictSerializer(serializers.Serializer):
    code = serializers.ChoiceField(choices=["quote_changed", "idempotency_conflict"])
    detail = serializers.CharField()
    quote = CheckoutQuoteResponseSerializer(allow_null=True, required=False)


class OrderItemSerializer(serializers.ModelSerializer):
    seller_name = serializers.CharField(source="seller.business_name", read_only=True)
    product_slug = serializers.CharField(source="product.slug", read_only=True, default=None)
    delivery_status = serializers.CharField(read_only=True, allow_null=True)
    is_delivered = serializers.BooleanField(read_only=True)
    can_request_return = serializers.BooleanField(read_only=True)

    class Meta:
        model = OrderItem
        fields = (
            "id",
            "product",
            "product_slug",
            "seller",
            "seller_name",
            "product_name",
            "sku",
            "quantity",
            "unit_price",
            "total_price",
            "delivery_status",
            "is_delivered",
            "can_request_return",
        )


class OrderSerializer(serializers.ModelSerializer):
    shipping_address_snapshot = DeliveryAddressSnapshotSerializer(read_only=True, allow_null=True)
    items = OrderItemSerializer(many=True, read_only=True)
    payment = serializers.SerializerMethodField()
    shipment = serializers.SerializerMethodField()
    shipments = ShipmentSerializer(many=True, read_only=True)
    has_cancellations = serializers.BooleanField(read_only=True)
    refunded_amount = serializers.SerializerMethodField()
    net_total = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = (
            "id",
            "order_number",
            "status",
            "subtotal",
            "discount_total",
            "shipping_cost",
            "total",
            "items",
            "payment",
            "shipment",
            "shipments",
            "has_cancellations",
            "refunded_amount",
            "net_total",
            "shipping_address_snapshot",
            "shipping_address_snapshot_source",
            "created_at",
            "updated_at",
        )

    @extend_schema_field(PaymentSerializer(allow_null=True))
    def get_payment(self, obj):
        from apps.payments.serializers import PaymentSerializer

        payment = getattr(obj, "payment", None)
        if not payment:
            return None
        return PaymentSerializer(payment).data

    @extend_schema_field(ShipmentSerializer(allow_null=True))
    def get_shipment(self, obj):
        shipment = getattr(obj, "shipment", None)
        if not shipment:
            return None
        return ShipmentSerializer(shipment).data

    @extend_schema_field(serializers.DecimalField(max_digits=12, decimal_places=2))
    def get_refunded_amount(self, obj):
        payment = getattr(obj, "payment", None)
        return format(payment.refunded_amount if payment else Decimal("0.00"), ".2f")

    @extend_schema_field(serializers.DecimalField(max_digits=12, decimal_places=2))
    def get_net_total(self, obj):
        return format(obj.total - Decimal(self.get_refunded_amount(obj)), ".2f")


class OrderTrackingSerializer(OrderSerializer):
    order_id = serializers.IntegerField(source="id", read_only=True)
    order_status = serializers.CharField(source="status", read_only=True)

    class Meta(OrderSerializer.Meta):
        fields = ("order_id", "order_number", "order_status", "shipments", "shipment")


class CheckoutQuoteSerializer(serializers.Serializer):
    address_id = serializers.IntegerField(min_value=1)
    payment_method = serializers.ChoiceField(choices=Payment.PaymentMethod.choices)


class CheckoutSerializer(CheckoutQuoteSerializer):
    quote_token = serializers.CharField(max_length=65536, trim_whitespace=False)
    idempotency_key = serializers.UUIDField()
    validate_cart_item = staticmethod(validate_cart_item)

    def validate(self, attrs):
        user = self.context["request"].user
        attrs["fingerprint"] = request_fingerprint(user=user, **attrs)
        attrs["existing_order"] = find_replay(
            user=user, idempotency_key=attrs["idempotency_key"], fingerprint=attrs["fingerprint"],
        )
        # A successful request can be replayed even after its quote expires
        # or its cart/address are no longer active.
        if attrs["existing_order"] is None:
            # An identical purchase may still be uncommitted. Verify its token
            # now, then resolve replay under the cart lock before checking TTL.
            attrs["quoted"] = read_quote(
                token=attrs["quote_token"], user=user,
                address_id=attrs["address_id"], payment_method=attrs["payment_method"],
                verify_age=False,
            )
        return attrs

    def create(self, validated_data):
        if validated_data["existing_order"] is not None:
            self.was_created = False
            return validated_data["existing_order"]
        values = {key: value for key, value in validated_data.items() if key != "existing_order"}
        order, self.was_created = confirm_checkout(user=self.context["request"].user, **values)
        return order

    def to_representation(self, instance):
        return OrderSerializer(instance, context=self.context).data


class SellerOrderItemSerializer(serializers.ModelSerializer):
    delivery_status = serializers.CharField(read_only=True, allow_null=True)
    is_delivered = serializers.BooleanField(read_only=True)

    class Meta:
        model = OrderItem
        fields = (
            "id",
            "product",
            "product_name",
            "sku",
            "quantity",
            "unit_price",
            "total_price",
            "created_at",
            "delivery_status",
            "is_delivered",
        )


class SellerOrderSerializer(serializers.ModelSerializer):
    shipping_address_snapshot = DeliveryAddressSnapshotSerializer(read_only=True, allow_null=True)
    items = serializers.SerializerMethodField()
    seller_subtotal = serializers.SerializerMethodField()
    customer_email = serializers.CharField(source="user.email", read_only=True)
    payment_status = serializers.CharField(source="payment.status", read_only=True)
    status = serializers.SerializerMethodField()
    order_status = serializers.CharField(source="status", read_only=True)
    shipment = serializers.SerializerMethodField()
    tracking_code = serializers.SerializerMethodField()
    shipment_status = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = (
            "id",
            "order_number",
            "customer_email",
            "shipping_address_snapshot",
            "shipping_address_snapshot_source",
            "status",
            "order_status",
            "seller_subtotal",
            "payment_status",
            "tracking_code",
            "shipment_status",
            "shipment",
            "items",
            "created_at",
            "updated_at",
        )

    @extend_schema_field(SellerOrderItemSerializer(many=True))
    def get_items(self, obj):
        seller_profile = self.context["request"].user.seller_profile
        items = [item for item in obj.items.all() if item.seller_id == seller_profile.id]
        return SellerOrderItemSerializer(items, many=True).data

    @extend_schema_field(serializers.DecimalField(max_digits=12, decimal_places=2))
    def get_seller_subtotal(self, obj):
        seller_profile = self.context["request"].user.seller_profile
        total = sum(
            (item.total_price for item in obj.items.all() if item.seller_id == seller_profile.id),
            Decimal("0.00"),
        )
        return format(total, ".2f")

    def _shipment(self, obj):
        return obj.shipment_for_seller(self.context["request"].user.seller_profile.id)

    @extend_schema_field(serializers.ChoiceField(choices=Order.Status.choices))
    def get_status(self, obj):
        return seller_order_status(self._shipment(obj), obj.status)

    @extend_schema_field(ShipmentSerializer(allow_null=True))
    def get_shipment(self, obj):
        shipment = self._shipment(obj)
        return ShipmentSerializer(shipment).data if shipment else None

    @extend_schema_field(serializers.CharField(allow_null=True, allow_blank=True))
    def get_tracking_code(self, obj):
        shipment = self._shipment(obj)
        return shipment.tracking_code if shipment else None

    @extend_schema_field(serializers.ChoiceField(choices=Shipment.Status.choices, allow_null=True))
    def get_shipment_status(self, obj):
        shipment = self._shipment(obj)
        return shipment.status if shipment else None


class SellerOrderStatusUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = (
            "status",
        )

    def validate_status(self, value):
        allowed_statuses = [
            Order.Status.PREPARING,
            Order.Status.SHIPPED,
            Order.Status.PROBLEM,
        ]

        if value not in allowed_statuses:
            raise serializers.ValidationError(
                "Usa PREPARING, SHIPPED o PROBLEM. La cancelación requiere una operación de inventario y reembolso."
            )

        if self.instance.status == Order.Status.DELIVERED:
            raise serializers.ValidationError(
                "No se puede modificar una orden ya entregada."
            )

        if self.instance.status == Order.Status.CANCELLED:
            raise serializers.ValidationError(
                "No se puede modificar una orden cancelada."
            )

        return value

    def update(self, instance, validated_data):
        if "status" not in validated_data:
            raise serializers.ValidationError({"status": "Indica el nuevo estado del pedido."})
        shipment = instance.shipment_for_seller(self.context["request"].user.seller_profile.id)
        if shipment is None:
            raise serializers.ValidationError({"status": "Este vendedor no tiene un envío asignado."})
        target = {
            Order.Status.PREPARING: Shipment.Status.PREPARING,
            Order.Status.SHIPPED: Shipment.Status.DISPATCHED,
            Order.Status.PROBLEM: Shipment.Status.DELIVERY_PROBLEM,
        }[validated_data["status"]]
        update_seller_shipment(
            shipment_id=shipment.id,
            order_id=instance.id,
            user=self.context["request"].user,
            changes={"status": target},
        )
        instance.refresh_from_db()
        return instance

    def to_representation(self, instance):
        return SellerOrderSerializer(instance, context=self.context).data
