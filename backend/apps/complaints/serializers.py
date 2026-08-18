from django.utils import timezone
from rest_framework import serializers

from apps.orders.models import Order, OrderItem

from .models import Complaint, ReturnRequest


class ComplaintSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source="order.order_number", read_only=True)
    user_email = serializers.CharField(source="user.email", read_only=True)
    product_name = serializers.CharField(
        source="order_item.product_name",
        read_only=True,
    )
    seller_name = serializers.CharField(
        source="order_item.seller.business_name",
        read_only=True,
    )
    resolved_by_email = serializers.CharField(
        source="resolved_by.email",
        read_only=True,
    )

    class Meta:
        model = Complaint
        fields = (
            "id",
            "order",
            "order_number",
            "order_item",
            "product_name",
            "seller_name",
            "user_email",
            "complaint_type",
            "title",
            "description",
            "status",
            "admin_note",
            "resolution",
            "resolved_by_email",
            "resolved_at",
            "created_at",
            "updated_at",
        )


class ComplaintCreateSerializer(serializers.ModelSerializer):
    order_item_id = serializers.PrimaryKeyRelatedField(
        source="order_item",
        queryset=OrderItem.objects.select_related("order", "seller"),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Complaint
        fields = (
            "id",
            "order_item_id",
            "complaint_type",
            "title",
            "description",
        )
        read_only_fields = ("id",)

    def validate_title(self, value):
        if len(value.strip()) < 5:
            raise serializers.ValidationError(
                "El título debe tener al menos 5 caracteres."
            )
        return value.strip()

    def validate_description(self, value):
        if len(value.strip()) < 10:
            raise serializers.ValidationError(
                "La descripción debe tener al menos 10 caracteres."
            )
        return value.strip()

    def validate(self, attrs):
        order = self.context["order"]
        order_item = attrs.get("order_item")

        if order.user_id != self.context["request"].user.id:
            raise serializers.ValidationError(
                {"order": "Esta orden no pertenece al usuario autenticado."}
            )

        if order_item and order_item.order_id != order.id:
            raise serializers.ValidationError(
                {"order_item_id": "El producto seleccionado no pertenece a esta orden."}
            )

        if order.status == Order.Status.CANCELLED:
            raise serializers.ValidationError(
                {"order": "No se puede crear un reclamo sobre una orden cancelada."}
            )

        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        order = self.context["order"]

        complaint = Complaint.objects.create(
            user=request.user,
            order=order,
            order_item=validated_data.get("order_item"),
            complaint_type=validated_data["complaint_type"],
            title=validated_data["title"],
            description=validated_data["description"],
        )

        from apps.notifications.models import Notification
        from apps.notifications.services import create_notification

        if complaint.order_item:
            create_notification(
                user=complaint.order_item.seller.user,
                title="Nuevo reclamo recibido",
                message=f"Se creó un reclamo sobre {complaint.order_item.product_name}.",
                notification_type=Notification.NotificationType.COMPLAINT_CREATED,
                related_object_type="Complaint",
                related_object_id=complaint.id,
                action_url=f"/seller/complaints/{complaint.id}",
            )        

        return complaint

    def to_representation(self, instance):
        return ComplaintSerializer(instance, context=self.context).data


class ComplaintStatusUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Complaint
        fields = (
            "status",
            "admin_note",
            "resolution",
        )

    def validate_status(self, value):
        allowed_statuses = [
            Complaint.Status.IN_REVIEW,
            Complaint.Status.WAITING_CUSTOMER,
            Complaint.Status.RESOLVED,
            Complaint.Status.REJECTED,
            Complaint.Status.CLOSED,
        ]

        if value not in allowed_statuses:
            raise serializers.ValidationError(
                "Estado no permitido para actualizar el reclamo."
            )

        return value

    def update(self, instance, validated_data):
        request = self.context["request"]

        old_status = instance.status
        new_status = validated_data.get("status", old_status)

        instance.status = new_status
        instance.admin_note = validated_data.get("admin_note", instance.admin_note)
        instance.resolution = validated_data.get("resolution", instance.resolution)

        if new_status in [
            Complaint.Status.RESOLVED,
            Complaint.Status.REJECTED,
            Complaint.Status.CLOSED,
        ]:
            instance.resolved_by = request.user
            instance.resolved_at = timezone.now()

        instance.save(
            update_fields=[
                "status",
                "admin_note",
                "resolution",
                "resolved_by",
                "resolved_at",
                "updated_at",
            ]
        )

        from apps.notifications.models import Notification
        from apps.notifications.services import create_notification

        if new_status in [
            Complaint.Status.RESOLVED,
            Complaint.Status.REJECTED,
            Complaint.Status.CLOSED,
        ]:
            create_notification(
                user=instance.user,
                title="Actualización de reclamo",
                message=f"Tu reclamo '{instance.title}' cambió a estado {new_status}.",
                notification_type=Notification.NotificationType.COMPLAINT_RESOLVED,
                related_object_type="Complaint",
                related_object_id=instance.id,
                action_url=f"/complaints/{instance.id}",
            )        

        return instance

    def to_representation(self, instance):
        return ComplaintSerializer(instance, context=self.context).data


class ReturnRequestSerializer(serializers.ModelSerializer):
    order_item_id = serializers.IntegerField(source="order_item.id", read_only=True)
    order_number = serializers.CharField(
        source="order_item.order.order_number",
        read_only=True,
    )
    product_name = serializers.CharField(
        source="order_item.product_name",
        read_only=True,
    )
    sku = serializers.CharField(source="order_item.sku", read_only=True)
    seller_name = serializers.CharField(
        source="order_item.seller.business_name",
        read_only=True,
    )
    user_email = serializers.CharField(source="user.email", read_only=True)
    resolved_by_email = serializers.CharField(
        source="resolved_by.email",
        read_only=True,
    )

    class Meta:
        model = ReturnRequest
        fields = (
            "id",
            "order_item_id",
            "order_number",
            "product_name",
            "sku",
            "seller_name",
            "user_email",
            "reason",
            "description",
            "quantity",
            "requested_refund_amount",
            "approved_refund_amount",
            "status",
            "admin_note",
            "resolution",
            "resolved_by_email",
            "resolved_at",
            "created_at",
            "updated_at",
        )


class ReturnRequestCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReturnRequest
        fields = (
            "id",
            "reason",
            "description",
            "quantity",
        )
        read_only_fields = ("id",)

    def validate_description(self, value):
        if len(value.strip()) < 10:
            raise serializers.ValidationError(
                "La descripción debe tener al menos 10 caracteres."
            )
        return value.strip()

    def validate_quantity(self, value):
        order_item = self.context["order_item"]

        if value <= 0:
            raise serializers.ValidationError("La cantidad debe ser mayor que cero.")

        if value > order_item.quantity:
            raise serializers.ValidationError(
                "No puedes devolver más unidades de las que compraste."
            )

        return value

    def validate(self, attrs):
        request = self.context["request"]
        order_item = self.context["order_item"]

        if order_item.order.user_id != request.user.id:
            raise serializers.ValidationError(
                {"order_item": "Este producto comprado no pertenece a tu usuario."}
            )

        if order_item.order.status != Order.Status.DELIVERED:
            raise serializers.ValidationError(
                {
                    "order": (
                        "Solo puedes solicitar devolución de productos "
                        "de pedidos entregados."
                    )
                }
            )

        if hasattr(order_item, "return_request"):
            raise serializers.ValidationError(
                {"order_item": "Ya existe una solicitud de devolución para este ítem."}
            )

        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        order_item = self.context["order_item"]

        quantity = validated_data["quantity"]
        requested_refund_amount = order_item.unit_price * quantity

        return_request = ReturnRequest.objects.create(
            user=request.user,
            order_item=order_item,
            reason=validated_data["reason"],
            description=validated_data["description"],
            quantity=quantity,
            requested_refund_amount=requested_refund_amount,
        )

        from apps.notifications.models import Notification
        from apps.notifications.services import create_notification

        create_notification(
            user=order_item.seller.user,
            title="Nueva devolución solicitada",
            message=f"El cliente solicitó devolución de {order_item.product_name}.",
            notification_type=Notification.NotificationType.RETURN_REQUESTED,
            related_object_type="ReturnRequest",
            related_object_id=return_request.id,
            action_url=f"/seller/returns/{return_request.id}",
        )

        return return_request

    def to_representation(self, instance):
        return ReturnRequestSerializer(instance, context=self.context).data


class ReturnRequestStatusUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReturnRequest
        fields = (
            "status",
            "approved_refund_amount",
            "admin_note",
            "resolution",
        )

    def validate_status(self, value):
        allowed_statuses = [
            ReturnRequest.Status.IN_REVIEW,
            ReturnRequest.Status.APPROVED,
            ReturnRequest.Status.REJECTED,
            ReturnRequest.Status.PRODUCT_RECEIVED,
            ReturnRequest.Status.REFUNDED,
            ReturnRequest.Status.CLOSED,
        ]

        if value not in allowed_statuses:
            raise serializers.ValidationError(
                "Estado no permitido para actualizar la devolución."
            )

        return value

    def validate_approved_refund_amount(self, value):
        if value < 0:
            raise serializers.ValidationError(
                "El monto aprobado no puede ser negativo."
            )
        return value

    def update(self, instance, validated_data):
        request = self.context["request"]

        old_status = instance.status
        new_status = validated_data.get("status", old_status)

        instance.status = new_status
        instance.approved_refund_amount = validated_data.get(
            "approved_refund_amount",
            instance.approved_refund_amount,
        )
        instance.admin_note = validated_data.get("admin_note", instance.admin_note)
        instance.resolution = validated_data.get("resolution", instance.resolution)

        if new_status in [
            ReturnRequest.Status.APPROVED,
            ReturnRequest.Status.REJECTED,
            ReturnRequest.Status.REFUNDED,
            ReturnRequest.Status.CLOSED,
        ]:
            instance.resolved_by = request.user
            instance.resolved_at = timezone.now()

        instance.save(
            update_fields=[
                "status",
                "approved_refund_amount",
                "admin_note",
                "resolution",
                "resolved_by",
                "resolved_at",
                "updated_at",
            ]
        )

        from apps.notifications.models import Notification
        from apps.notifications.services import create_notification

        create_notification(
            user=instance.user,
            title="Actualización de devolución",
            message=f"Tu solicitud de devolución cambió a estado {new_status}.",
            notification_type=Notification.NotificationType.RETURN_UPDATED,
            related_object_type="ReturnRequest",
            related_object_id=instance.id,
            action_url=f"/returns/{instance.id}",
        )        

        return instance

    def to_representation(self, instance):
        return ReturnRequestSerializer(instance, context=self.context).data