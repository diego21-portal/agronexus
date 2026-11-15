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

    class Meta:
        model = Shipment
        fields = (
            "id",
            "seller",
            "seller_name",
            "tracking_code",
            "status",
            "carrier",
            "estimated_delivery_date",
            "delivered_at",
            "events",
            "created_at",
            "updated_at",
        )

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
