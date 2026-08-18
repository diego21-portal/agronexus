from rest_framework import serializers
from django.utils import timezone

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

    class Meta:
        model = Shipment
        fields = (
            "id",
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

    def validate_status(self, value):
        allowed_statuses = [
            Shipment.Status.PREPARING,
            Shipment.Status.DISPATCHED,
            Shipment.Status.IN_TRANSIT,
            Shipment.Status.IN_DISTRIBUTION_CENTER,
            Shipment.Status.OUT_FOR_DELIVERY,
            Shipment.Status.DELIVERED,
            Shipment.Status.DELIVERY_PROBLEM,
            Shipment.Status.CANCELLED,
        ]

        if value not in allowed_statuses:
            raise serializers.ValidationError(
                "Estado de envío no permitido."
            )

        if self.instance.status == Shipment.Status.DELIVERED:
            raise serializers.ValidationError(
                "No se puede modificar un envío ya entregado."
            )

        if self.instance.status == Shipment.Status.CANCELLED:
            raise serializers.ValidationError(
                "No se puede modificar un envío cancelado."
            )

        return value

    def update(self, instance, validated_data):
        request = self.context["request"]

        description = validated_data.pop("description", "")
        location = validated_data.pop("location", "")

        old_status = instance.status
        new_status = validated_data.get("status", old_status)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if new_status == Shipment.Status.DELIVERED:
            instance.delivered_at = timezone.now()

        instance.save()

        if old_status != new_status:
            ShipmentEvent.objects.create(
                shipment=instance,
                status=new_status,
                description=description or f"El envío cambió a estado {new_status}.",
                location=location,
                created_by=request.user,
            )

            order = instance.order

            if new_status == Shipment.Status.PREPARING:
                order.status = order.Status.PREPARING
            elif new_status in [
                Shipment.Status.DISPATCHED,
                Shipment.Status.IN_TRANSIT,
                Shipment.Status.IN_DISTRIBUTION_CENTER,
                Shipment.Status.OUT_FOR_DELIVERY,
            ]:
                order.status = order.Status.SHIPPED
            elif new_status == Shipment.Status.DELIVERED:
                order.status = order.Status.DELIVERED
            elif new_status == Shipment.Status.DELIVERY_PROBLEM:
                order.status = order.Status.PROBLEM
            elif new_status == Shipment.Status.CANCELLED:
                order.status = order.Status.CANCELLED

            order.save(update_fields=["status", "updated_at"])

            from apps.notifications.models import Notification
            from apps.notifications.services import create_notification

            create_notification(
                user=order.user,
                title="Actualización de envío",
                message=f"El envío de tu orden {order.order_number} cambió a {new_status}.",
                notification_type=Notification.NotificationType.SHIPMENT_UPDATED,
                related_object_type="Shipment",
                related_object_id=instance.id,
                action_url=f"/orders/{order.id}/tracking",
            )            

        return instance

    def to_representation(self, instance):
        return ShipmentSerializer(instance, context=self.context).data