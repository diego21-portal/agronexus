"""Post-delivery returns with an auditable receipt, inspection and refund."""

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.notifications.models import Notification
from apps.notifications.services import create_notification
from apps.orders.models import Order, OrderItem
from apps.users.models import User

from .models import ReturnRequest, ReturnRequestEvent


ADMIN_TRANSITIONS = {
    ReturnRequest.Status.REQUESTED: {
        ReturnRequest.Status.IN_REVIEW,
        ReturnRequest.Status.APPROVED,
        ReturnRequest.Status.REJECTED,
    },
    ReturnRequest.Status.IN_REVIEW: {
        ReturnRequest.Status.APPROVED,
        ReturnRequest.Status.REJECTED,
    },
    ReturnRequest.Status.APPROVED: set(),
    ReturnRequest.Status.PRODUCT_RECEIVED: set(),
    ReturnRequest.Status.INSPECTED: {ReturnRequest.Status.REFUNDED},
    ReturnRequest.Status.REFUNDED: {ReturnRequest.Status.CLOSED},
    ReturnRequest.Status.REJECTED: {ReturnRequest.Status.CLOSED},
    ReturnRequest.Status.CLOSED: set(),
}


def is_platform_admin(user):
    return bool(
        user and user.is_authenticated and user.is_active
        and user.effective_role in {User.Role.ADMIN, User.Role.SUPER_ADMIN}
    )


def can_handle_return(user, return_request):
    if is_platform_admin(user):
        return True
    profile = getattr(user, "seller_profile", None)
    return bool(
        user and user.is_authenticated and user.is_active
        and user.role == User.Role.SELLER and profile and profile.is_active
        and return_request.order_item.seller_id == profile.pk
    )


def _notify(return_request, message=None):
    create_notification(
        user=return_request.user,
        title="Actualización de devolución",
        message=message or f"Tu solicitud de devolución cambió a estado {return_request.status}.",
        notification_type=Notification.NotificationType.RETURN_UPDATED,
        related_object_type="ReturnRequest",
        related_object_id=return_request.pk,
        action_url="/account/returns",
    )


def _event(return_request, user, action, description):
    ReturnRequestEvent.objects.create(
        return_request=return_request, status=return_request.status,
        action=action, description=description, created_by=user,
    )


def _lock_return(return_request_id):
    # The shared order lock serializes cancellations, physical returns and
    # refunds for different sellers belonging to the same payment.
    order_id = (
        ReturnRequest.objects.filter(pk=return_request_id)
        .values_list("order_item__order_id", flat=True).first()
    )
    if order_id is None:
        raise NotFound("No se encontró la devolución.")
    Order.objects.select_for_update().get(pk=order_id)
    return (
        ReturnRequest.objects.select_for_update(of=("self",))
        .select_related("order_item__order", "order_item__seller", "user")
        .get(pk=return_request_id)
    )


def _inspection(return_request, *, create=False):
    from apps.aftersales.models import ReturnInspection

    if create:
        inspection, _ = ReturnInspection.objects.get_or_create(
            return_request=return_request,
            defaults={
                "order_item": return_request.order_item,
                "expected_quantity": return_request.quantity,
            },
        )
        return inspection
    return ReturnInspection.objects.filter(return_request=return_request).first()


def _validate_amount(return_request, amount, *, check_remaining=True):
    from apps.payments.models import Payment

    maximum = return_request.order_item.unit_price * return_request.quantity
    if maximum < 0 or amount < 0 or amount > maximum:
        raise ValidationError({
            "approved_refund_amount": "El importe debe estar entre cero y el valor pagado por las unidades devueltas."
        })
    if not check_remaining:
        return
    payment = (
        Payment.objects.select_for_update()
        .filter(order_id=return_request.order_item.order_id).first()
    )
    if payment is None:
        raise ValidationError({"approved_refund_amount": "La compra no tiene un pago registrado para reembolsar."})
    if payment.status not in {"APPROVED", "PARTIALLY_REFUNDED"}:
        raise ValidationError({"approved_refund_amount": "El pago no tiene un saldo aprobado disponible para esta devolución."})
    # The ledger performs the final item and payment budget checks on refund.
    # At approval the payment's current refundable balance is also respected.
    remaining = getattr(payment, "refundable_amount", payment.amount)
    if amount > remaining:
        raise ValidationError({"approved_refund_amount": "El importe supera el saldo reembolsable del pago."})


def create_return_request(*, order_item_id, user, reason, description, quantity):
    from apps.aftersales.models import CancellationRequest

    with transaction.atomic():
        order_id = (
            OrderItem.objects.filter(pk=order_item_id, order__user=user)
            .values_list("order_id", flat=True).first()
        )
        if order_id is None:
            raise NotFound("No se encontró el producto comprado.")
        Order.objects.select_for_update().get(pk=order_id)
        item = OrderItem.objects.select_related("order", "seller").get(pk=order_item_id)
        if not item.is_delivered:
            raise ValidationError({"order": "Solo puedes devolver productos entregados por su vendedor."})
        if quantity < 1 or quantity > item.quantity:
            raise ValidationError({"quantity": "La cantidad debe estar dentro de las unidades compradas."})
        if ReturnRequest.objects.filter(order_item=item).exists():
            raise ValidationError({"order_item": "Ya existe una solicitud de devolución para este ítem."})
        if CancellationRequest.objects.filter(
            shipment__order_id=order_id,
            shipment__seller_id=item.seller_id,
        ).exclude(status__in=["REJECTED", "WITHDRAWN"]).exists():
            raise ValidationError({"order_item": "Este envío ya tiene una cancelación en trámite o completada."})
        record = ReturnRequest.objects.create(
            user=user, order_item=item, reason=reason, description=description,
            quantity=quantity, requested_refund_amount=item.unit_price * quantity,
        )
        _event(record, user, "REQUEST", "El cliente solicitó la devolución del producto recibido.")
        create_notification(
            user=item.seller.user,
            title="Nueva devolución solicitada",
            message=f"El cliente solicitó devolución de {item.product_name}.",
            notification_type=Notification.NotificationType.RETURN_REQUESTED,
            related_object_type="ReturnRequest",
            related_object_id=record.pk,
            action_url="/seller/returns",
        )
        return record


def update_return_request(*, return_request_id, user, changes):
    if not is_platform_admin(user):
        raise PermissionDenied("Solo administración puede resolver una devolución o autorizar el reembolso.")
    with transaction.atomic():
        record = _lock_return(return_request_id)
        old_status = record.status
        target = changes.get("status", old_status)
        amount = changes.get("approved_refund_amount", record.approved_refund_amount)
        if target != old_status and target not in ADMIN_TRANSITIONS.get(old_status, set()):
            raise ValidationError({
                "status": "Transición no permitida. La recepción y la inspección se registran mediante sus operaciones específicas."
            })
        if old_status in {ReturnRequest.Status.REFUNDED, ReturnRequest.Status.CLOSED}:
            if amount != record.approved_refund_amount:
                raise ValidationError({"approved_refund_amount": "Un reembolso registrado no puede modificarse."})
        else:
            _validate_amount(
                record, amount,
                check_remaining=(
                    "approved_refund_amount" in changes
                    or target in {ReturnRequest.Status.APPROVED, ReturnRequest.Status.REFUNDED}
                ),
            )
        if target == ReturnRequest.Status.APPROVED:
            _inspection(record, create=True)
        if target == ReturnRequest.Status.REFUNDED:
            inspection = _inspection(record)
            if (
                inspection is None
                or inspection.received_quantity != record.quantity
                or inspection.restocked_quantity + inspection.defective_quantity != record.quantity
            ):
                raise ValidationError({"status": "Primero deben completarse la recepción y la inspección reales."})
            from apps.payments.services import refund_item

            refund_item(
                record.order_item, amount, user,
                return_request=record,
                operation_key=f"return:{record.pk}:product",
                reason=f"Reembolso de devolución {record.pk}.",
            )
        record.status = target
        record.approved_refund_amount = amount
        record.admin_note = changes.get("admin_note", record.admin_note)
        record.resolution = changes.get("resolution", record.resolution)
        if target != old_status and target in {
            ReturnRequest.Status.APPROVED, ReturnRequest.Status.REJECTED,
            ReturnRequest.Status.REFUNDED, ReturnRequest.Status.CLOSED,
        }:
            record.resolved_by = user
            record.resolved_at = timezone.now()
        record.save(update_fields=[
            "status", "approved_refund_amount", "admin_note", "resolution",
            "resolved_by", "resolved_at", "updated_at",
        ])
        if target != old_status:
            _event(record, user, "STATUS", f"La devolución cambió a estado {target}.")
            _notify(record)
        return record


def receive_return(*, return_request_id, user, received_quantity, note=""):
    from apps.aftersales.inventory import record_receipt

    with transaction.atomic():
        record = _lock_return(return_request_id)
        if not can_handle_return(user, record):
            raise NotFound("No se encontró la devolución del vendedor.")
        inspection = _inspection(record)
        if record.status not in {
            ReturnRequest.Status.APPROVED, ReturnRequest.Status.PRODUCT_RECEIVED,
        }:
            if inspection and inspection.received_quantity == received_quantity and record.status in {
                ReturnRequest.Status.INSPECTED, ReturnRequest.Status.REFUNDED, ReturnRequest.Status.CLOSED,
            }:
                return record
            raise ValidationError({"status": "La devolución debe estar aprobada antes de recibir productos."})
        if inspection is None:
            # A legacy approval is not evidence of receipt. Start a fresh
            # record and require the operator's explicit physical quantities.
            inspection = _inspection(record, create=True)
        previous_quantity = inspection.received_quantity
        inspection = record_receipt(
            inspection_id=inspection.pk, received_quantity=received_quantity, user=user, note=note,
        )
        record._state.fields_cache["inspection"] = inspection
        if inspection.received_quantity == inspection.expected_quantity:
            record.status = ReturnRequest.Status.PRODUCT_RECEIVED
            record.save(update_fields=["status", "updated_at"])
        if inspection.received_quantity != previous_quantity:
            _event(
                record, user, "RECEIVE",
                f"Se recibieron {inspection.received_quantity} de {inspection.expected_quantity} unidades autorizadas.",
            )
            _notify(record, f"Se recibieron {inspection.received_quantity} de {inspection.expected_quantity} unidades de tu devolución.")
        return record


def inspect_return(*, return_request_id, user, restocked_quantity, defective_quantity, note=""):
    from apps.aftersales.inventory import inspect_receipt

    with transaction.atomic():
        record = _lock_return(return_request_id)
        if not can_handle_return(user, record):
            raise NotFound("No se encontró la devolución del vendedor.")
        inspection = _inspection(record)
        if inspection is None or inspection.received_quantity == 0:
            raise ValidationError({"status": "Primero debe registrarse la recepción física."})
        previous = (inspection.restocked_quantity, inspection.defective_quantity)
        if record.status not in {
            ReturnRequest.Status.APPROVED, ReturnRequest.Status.PRODUCT_RECEIVED,
            ReturnRequest.Status.INSPECTED,
        }:
            if previous == (restocked_quantity, defective_quantity) and record.status in {
                ReturnRequest.Status.REFUNDED, ReturnRequest.Status.CLOSED,
            }:
                return record
            raise ValidationError({"status": "Esta devolución no permite una nueva inspección."})
        inspection = inspect_receipt(
            inspection_id=inspection.pk, restocked_quantity=restocked_quantity,
            defective_quantity=defective_quantity, user=user, note=note,
        )
        record._state.fields_cache["inspection"] = inspection
        if (
            inspection.received_quantity == inspection.expected_quantity
            and inspection.restocked_quantity + inspection.defective_quantity == inspection.expected_quantity
        ):
            record.status = ReturnRequest.Status.INSPECTED
            record.save(update_fields=["status", "updated_at"])
        if previous != (inspection.restocked_quantity, inspection.defective_quantity):
            _event(
                record, user, "INSPECT",
                f"Inspección acumulada: {inspection.restocked_quantity} unidades aptas y {inspection.defective_quantity} defectuosas.",
            )
            _notify(record, "La revisión de los productos devueltos fue actualizada.")
        return record
