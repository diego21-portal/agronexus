from django.utils import timezone
from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field

from apps.orders.models import Order, OrderItem

from .models import Complaint, ReturnRequest, ReturnRequestEvent


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
            "resolution",
            "resolved_at",
            "created_at",
            "updated_at",
        )


class AdminComplaintSerializer(ComplaintSerializer):
    resolved_by_email = serializers.CharField(
        source="resolved_by.email",
        read_only=True,
    )

    class Meta(ComplaintSerializer.Meta):
        fields = ComplaintSerializer.Meta.fields + ("admin_note", "resolved_by_email")


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
        return AdminComplaintSerializer(instance, context=self.context).data


class ReturnRequestEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReturnRequestEvent
        fields = ("id", "status", "action", "description", "created_at")
        read_only_fields = fields


class ReturnInspectionSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    expected_quantity = serializers.IntegerField()
    received_quantity = serializers.IntegerField()
    restocked_quantity = serializers.IntegerField()
    defective_quantity = serializers.IntegerField()
    quarantined_quantity = serializers.IntegerField()
    received_at = serializers.DateTimeField(allow_null=True)
    inspected_at = serializers.DateTimeField(allow_null=True)


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
    inspection = serializers.SerializerMethodField()
    allowed_statuses = serializers.SerializerMethodField()
    can_receive = serializers.SerializerMethodField()
    can_inspect = serializers.SerializerMethodField()
    events = ReturnRequestEventSerializer(many=True, read_only=True)

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
            "resolution",
            "resolved_at",
            "created_at",
            "updated_at",
            "inspection",
            "allowed_statuses",
            "can_receive",
            "can_inspect",
            "events",
        )

    @extend_schema_field(ReturnInspectionSummarySerializer(allow_null=True))
    def get_inspection(self, obj):
        inspection = getattr(obj, "inspection", None)
        if inspection is None:
            return None
        return {
            "id": inspection.pk,
            "expected_quantity": inspection.expected_quantity,
            "received_quantity": inspection.received_quantity,
            "restocked_quantity": inspection.restocked_quantity,
            "defective_quantity": inspection.defective_quantity,
            "quarantined_quantity": (
                inspection.received_quantity - inspection.restocked_quantity - inspection.defective_quantity
            ),
            "received_at": inspection.received_at,
            "inspected_at": inspection.inspected_at,
        }

    @extend_schema_field(serializers.ListField(child=serializers.ChoiceField(choices=ReturnRequest.Status.choices)))
    def get_allowed_statuses(self, obj):
        from .services import ADMIN_TRANSITIONS, is_platform_admin

        request = self.context.get("request")
        if request is None or not is_platform_admin(request.user):
            return []
        return sorted(ADMIN_TRANSITIONS.get(obj.status, set()))

    def get_can_receive(self, obj) -> bool:
        from .services import can_handle_return

        request = self.context.get("request")
        inspection = getattr(obj, "inspection", None)
        return bool(
            request and can_handle_return(request.user, obj)
            and obj.status in {ReturnRequest.Status.APPROVED, ReturnRequest.Status.PRODUCT_RECEIVED}
            and (inspection is None or inspection.received_quantity < inspection.expected_quantity)
        )

    def get_can_inspect(self, obj) -> bool:
        from .services import can_handle_return

        request = self.context.get("request")
        inspection = getattr(obj, "inspection", None)
        return bool(
            request and can_handle_return(request.user, obj)
            and obj.status in {ReturnRequest.Status.APPROVED, ReturnRequest.Status.PRODUCT_RECEIVED}
            and inspection is not None
            and inspection.received_quantity > inspection.restocked_quantity + inspection.defective_quantity
        )


class AdminReturnRequestSerializer(ReturnRequestSerializer):
    resolved_by_email = serializers.CharField(
        source="resolved_by.email",
        read_only=True,
    )

    class Meta(ReturnRequestSerializer.Meta):
        fields = ReturnRequestSerializer.Meta.fields + ("admin_note", "resolved_by_email")


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

        if not order_item.is_delivered:
            raise serializers.ValidationError(
                {
                    "order": (
                        "Solo puedes solicitar devolución de productos "
                        "entregados por su vendedor."
                    )
                }
            )

        if hasattr(order_item, "return_request"):
            raise serializers.ValidationError(
                {"order_item": "Ya existe una solicitud de devolución para este ítem."}
            )

        return attrs

    def create(self, validated_data):
        from .services import create_return_request

        return create_return_request(
            order_item_id=self.context["order_item"].pk,
            user=self.context["request"].user,
            **validated_data,
        )

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
            ReturnRequest.Status.INSPECTED,
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
        from .services import update_return_request

        return update_return_request(
            return_request_id=instance.pk,
            user=self.context["request"].user,
            changes=validated_data,
        )

    def to_representation(self, instance):
        return AdminReturnRequestSerializer(instance, context=self.context).data


class ReturnReceiveSerializer(serializers.Serializer):
    received_quantity = serializers.IntegerField(min_value=0)
    note = serializers.CharField(max_length=1000, required=False, allow_blank=True, default="")


class ReturnInspectSerializer(serializers.Serializer):
    restocked_quantity = serializers.IntegerField(min_value=0)
    defective_quantity = serializers.IntegerField(min_value=0)
    note = serializers.CharField(max_length=1000, required=False, allow_blank=True, default="")
