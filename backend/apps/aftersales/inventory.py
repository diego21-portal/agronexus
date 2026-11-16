"""Physical receipt and disposition, separate from financial refunds."""

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.orders.models import Order
from apps.products.models import StockMovement
from apps.products.services import change_stock

from .models import ReturnInspection


def _quantity(value, field):
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        raise ValidationError({field: "La cantidad debe ser un entero no negativo."})
    return value


def _locked_inspection(inspection_id, user):
    order_id = ReturnInspection.objects.values_list("order_item__order_id", flat=True).get(pk=inspection_id)
    Order.objects.select_for_update().get(pk=order_id)
    inspection = (
        ReturnInspection.objects.select_for_update(of=("self",))
        .select_related("order_item__seller", "cancellation_request", "return_request")
        .get(pk=inspection_id)
    )
    seller = inspection.order_item.seller
    if not user or not user.is_authenticated or not user.is_active:
        raise PermissionDenied("La recepción requiere un usuario activo.")
    is_admin = user.effective_role in {"ADMIN", "SUPER_ADMIN"}
    is_seller = user.effective_role == "SELLER" and seller.user_id == user.pk and seller.is_active
    if not (is_admin or is_seller):
        raise PermissionDenied("No puedes recibir ni inspeccionar productos de este vendedor.")
    if inspection.cancellation_request_id:
        source = inspection.cancellation_request
        if (
            source.shipment.order_id != order_id
            or source.shipment.seller_id != inspection.order_item.seller_id
            or source.is_pre_dispatch
        ):
            raise ValidationError("La inspección no corresponde a un retorno de esta compra.")
        valid_states = {"RETURNING", "RECEIVED", "INSPECTED"}
    else:
        source = inspection.return_request
        if source.order_item_id != inspection.order_item_id:
            raise ValidationError("La inspección no corresponde a este producto comprado.")
        valid_states = {"APPROVED", "PRODUCT_RECEIVED", "INSPECTED"}
    return inspection, source.status in valid_states


@transaction.atomic
def record_receipt(*, inspection_id, received_quantity, user, note=""):
    received_quantity = _quantity(received_quantity, "received_quantity")
    inspection, source_open = _locked_inspection(inspection_id, user)
    if received_quantity < inspection.received_quantity:
        raise ValidationError({"received_quantity": "La cantidad recibida registrada no puede disminuir."})
    if received_quantity > inspection.expected_quantity:
        raise ValidationError({"received_quantity": "No puedes recibir más unidades de las autorizadas."})
    if not source_open and received_quantity != inspection.received_quantity:
        raise ValidationError("La solicitud no permite registrar nuevas recepciones.")
    if received_quantity == inspection.received_quantity:
        return inspection
    inspection.received_quantity = received_quantity
    inspection.received_at = timezone.now()
    inspection.received_by = user
    if note:
        inspection.note = note
    inspection.save(update_fields=[
        "received_quantity", "received_at", "received_by", "note", "updated_at",
    ])
    # No stock movement: received units remain quarantined until inspection.
    return inspection


@transaction.atomic
def inspect_receipt(*, inspection_id, restocked_quantity, defective_quantity, user, note=""):
    restocked_quantity = _quantity(restocked_quantity, "restocked_quantity")
    defective_quantity = _quantity(defective_quantity, "defective_quantity")
    inspection, source_open = _locked_inspection(inspection_id, user)
    if restocked_quantity < inspection.restocked_quantity or defective_quantity < inspection.defective_quantity:
        raise ValidationError("Las cantidades ya clasificadas no pueden disminuir.")
    if restocked_quantity + defective_quantity > inspection.received_quantity:
        raise ValidationError("No puedes clasificar más unidades de las que se recibieron.")
    unchanged = (
        restocked_quantity == inspection.restocked_quantity
        and defective_quantity == inspection.defective_quantity
    )
    if unchanged:
        return inspection
    if not source_open:
        raise ValidationError("La solicitud no permite registrar nuevas inspecciones.")
    if not note.strip():
        raise ValidationError({"note": "Registra el resultado de la inspección."})
    delta = restocked_quantity - inspection.restocked_quantity
    if delta:
        if inspection.order_item.product_id is None:
            raise ValidationError("El producto fue eliminado; no se puede reponer automáticamente.")
        change_stock(
            product_id=inspection.order_item.product_id,
            delta=delta,
            user=user,
            movement_type=StockMovement.MovementType.RETURN,
            reason=f"Reposición tras inspección {inspection.pk} de la compra {inspection.order_item.order_id}.",
            operation_key=f"inspection:{inspection.pk}:restocked:{restocked_quantity}",
            order_item=inspection.order_item,
        )
    inspection.restocked_quantity = restocked_quantity
    inspection.defective_quantity = defective_quantity
    inspection.inspected_at = timezone.now()
    inspection.inspected_by = user
    inspection.note = note.strip()
    inspection.save(update_fields=[
        "restocked_quantity", "defective_quantity", "inspected_at", "inspected_by", "note", "updated_at",
    ])
    return inspection
