from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.complaints.models import ReturnRequest
from apps.notifications.models import Notification
from apps.notifications.services import create_notification
from apps.orders.models import Order
from apps.products.models import StockMovement
from apps.shipments.models import Shipment, ShipmentEvent

from .models import CancellationEvent, CancellationRequest, ReturnInspection
from .permissions import is_admin, is_own_seller


OPEN_STATUSES = {
    CancellationRequest.Status.REQUESTED, CancellationRequest.Status.RETURNING,
    CancellationRequest.Status.RECEIVED, CancellationRequest.Status.INSPECTED,
}
BLOCKING_STATUSES = OPEN_STATUSES | {CancellationRequest.Status.COMPLETED}
TRANSIT_STATUSES = {
    Shipment.Status.DISPATCHED, Shipment.Status.IN_TRANSIT,
    Shipment.Status.IN_DISTRIBUTION_CENTER, Shipment.Status.OUT_FOR_DELIVERY,
    Shipment.Status.DELIVERY_PROBLEM,
}


def latest_blocking_request(shipment):
    return next((case for case in shipment.cancellations.all() if case.status in BLOCKING_STATUSES), None)


def can_request_cancellation(shipment):
    if shipment.order.status in {Order.Status.CANCELLED, Order.Status.DELIVERED}:
        return False
    if shipment.seller_id is None or shipment.status not in TRANSIT_STATUSES | {
        Shipment.Status.CREATED, Shipment.Status.PREPARING,
    }:
        return False
    return latest_blocking_request(shipment) is None


def _event(case, user, action, description):
    CancellationEvent.objects.create(
        cancellation_request=case, status=case.status, action=action,
        description=description, created_by=user,
    )
    create_notification(
        user=case.user, title="Actualización de cancelación",
        message=description, notification_type=Notification.NotificationType.SYSTEM,
        related_object_type="CancellationRequest", related_object_id=case.pk,
        action_url="/account/cancellations",
    )


def _update_order(order):
    from apps.shipments.services import aggregate_order_status
    order.status = aggregate_order_status(order)
    order.save(update_fields=["status", "updated_at"])


def _cancel_outbound(shipment, user):
    # Una entrega que ocurrió mientras se tramitaba la solicitud conserva su
    # historia. El retorno comercial vive en el expediente vinculado.
    if shipment.status != Shipment.Status.DELIVERED:
        shipment.status = Shipment.Status.CANCELLED
        shipment.save(update_fields=["status", "updated_at"])
        ShipmentEvent.objects.create(
            shipment=shipment, status=Shipment.Status.CANCELLED,
            description="Cancelación completada; consulta el expediente de retorno.",
            created_by=user,
        )


def request_cancellation(*, shipment_id, user, reason):
    from apps.payments.services import refund_item
    from apps.products.services import change_stock

    reason = reason.strip()
    if not 10 <= len(reason) <= 1000:
        raise ValidationError({"reason": "Explica el motivo en entre 10 y 1000 caracteres."})
    outbound = Shipment.objects.filter(pk=shipment_id, order__user=user).first()
    if outbound is None:
        raise NotFound("No se encontró tu envío.")

    with transaction.atomic():
        order = Order.objects.select_for_update().get(pk=outbound.order_id)
        shipment = Shipment.objects.select_for_update().get(pk=outbound.pk)
        existing = shipment.cancellations.filter(status__in=BLOCKING_STATUSES).first()
        if existing:
            return existing, False
        if order.status in {Order.Status.CANCELLED, Order.Status.DELIVERED} or not can_request_cancellation(shipment):
            raise ValidationError({"shipment": "El envío no admite una nueva cancelación; si fue entregado, solicita una devolución."})

        items = list(order.items.filter(seller_id=shipment.seller_id).select_related("product").order_by("product_id", "pk"))
        if not items:
            raise ValidationError({"shipment": "El envío no tiene productos asociados."})
        if ReturnRequest.objects.filter(order_item__in=items).exists():
            raise ValidationError({"shipment": "Ya existe una devolución para estos productos; continúa ese expediente."})
        immediate = shipment.status in {Shipment.Status.CREATED, Shipment.Status.PREPARING}
        case = CancellationRequest.objects.create(
            shipment=shipment, user=user, reason=reason, is_pre_dispatch=immediate,
        )
        if immediate:
            # Todo se confirma o revierte junto: estado, inventario y pago.
            case.status = CancellationRequest.Status.COMPLETED
            case.resolved_at = timezone.now()
            case.resolved_by = user
            case.resolution = "Cancelación antes del despacho; productos liberados y reembolso simulado registrado."
            case.save()
            for item in items:
                if item.product_id is None:
                    raise ValidationError({"shipment": "Un producto fue eliminado; administración debe revisar el inventario antes de cancelar."})
                change_stock(
                    product_id=item.product_id, delta=item.quantity, user=user,
                    movement_type=StockMovement.MovementType.CANCELLATION,
                    reason=f"Cancelación {case.pk} de {order.order_number}.",
                    operation_key=f"cancel:{case.pk}:item:{item.pk}", order_item=item,
                )
                refund_item(
                    item, item.total_price, user, cancellation_request=case,
                    operation_key=f"cancel:{case.pk}:refund:{item.pk}", reason=case.resolution,
                )
            _cancel_outbound(shipment, user)
            _update_order(order)
            _event(case, user, "completed_before_dispatch", case.resolution)
        else:
            ReturnInspection.objects.bulk_create([
                ReturnInspection(cancellation_request=case, order_item=item, expected_quantity=item.quantity)
                for item in items
            ])
            _event(case, user, "requested", "El cliente solicitó cancelar el envío; se debe coordinar su intercepción o retorno.")
            create_notification(
                user=shipment.seller.user, title="Solicitud de cancelación en tránsito",
                message=f"El comprador solicita el retorno del envío {shipment.tracking_code}.",
                related_object_type="CancellationRequest", related_object_id=case.pk,
                action_url="/seller/cancellations",
            )
        return case, True


def withdraw_cancellation(*, case_id, user):
    reference = CancellationRequest.objects.filter(pk=case_id, user=user).select_related("shipment").first()
    if reference is None:
        raise NotFound("No se encontró tu solicitud.")
    with transaction.atomic():
        Order.objects.select_for_update().get(pk=reference.shipment.order_id)
        case = CancellationRequest.objects.select_for_update().get(pk=case_id)
        if case.status == CancellationRequest.Status.WITHDRAWN:
            return case
        if case.status != CancellationRequest.Status.REQUESTED:
            raise ValidationError({"status": "Solo puedes desistir antes de que se confirme el retorno."})
        case.status = CancellationRequest.Status.WITHDRAWN
        case.save(update_fields=["status", "updated_at"])
        _event(case, user, "withdrawn", "El cliente desistió antes de confirmar el retorno.")
        return case


def process_cancellation(*, case_id, user, action, items=None, resolution="", amount=None, operation_key=None):
    from apps.aftersales.inventory import inspect_receipt, record_receipt
    from apps.payments.services import refund_item, refund_shipping

    reference = CancellationRequest.objects.select_related("shipment").filter(pk=case_id).first()
    if reference is None or not (is_admin(user) or is_own_seller(user, reference.shipment.seller_id)):
        raise NotFound("No se encontró la solicitud asignada.")
    if action in {"complete", "reject", "refund_shipping"} and not is_admin(user):
        raise PermissionDenied("Administración debe autorizar esta resolución financiera.")

    with transaction.atomic():
        order = Order.objects.select_for_update().get(pk=reference.shipment.order_id)
        shipment = Shipment.objects.select_for_update().get(pk=reference.shipment_id)
        case = CancellationRequest.objects.select_for_update().get(pk=case_id)
        if action == "refund_shipping":
            if case.status != CancellationRequest.Status.COMPLETED:
                raise ValidationError({"status": "Completa primero el expediente de cancelación."})
            if amount is None or Decimal(amount) <= 0 or not operation_key or len(resolution.strip()) < 10:
                raise ValidationError({"amount": "Indica importe positivo, clave de operación y motivo de al menos 10 caracteres."})
            already_recorded = case.refunds.filter(operation_key=operation_key).exists()
            refund_shipping(
                order, user, Decimal(amount), operation_key, cancellation_request=case, reason=resolution.strip(),
            )
            if not already_recorded:
                _event(case, user, "refund_shipping", f"Administración registró un reembolso simulado de gastos de envío por {Decimal(amount):.2f}.")
            return case
        if action == "start_return":
            if case.status == CancellationRequest.Status.RETURNING:
                return case
            if case.status != CancellationRequest.Status.REQUESTED:
                raise ValidationError({"status": "Solo una solicitud pendiente puede iniciar el retorno."})
            case.status = CancellationRequest.Status.RETURNING
            text = resolution.strip() or "El responsable confirmó la gestión del retorno; el stock sigue fuera de disponibilidad."
        elif action in {"receive", "inspect"}:
            allowed = (
                {CancellationRequest.Status.RETURNING, CancellationRequest.Status.RECEIVED}
                if action == "receive" else {CancellationRequest.Status.RETURNING, CancellationRequest.Status.RECEIVED, CancellationRequest.Status.INSPECTED}
            )
            if case.status not in allowed:
                raise ValidationError({"status": "La recepción o inspección no corresponde al estado actual."})
            if not items:
                raise ValidationError({"items": "Indica las cantidades de los productos."})
            inspections = {row.order_item_id: row for row in case.inspections.select_related("order_item").all()}
            ids = [row["order_item"] for row in items]
            if len(ids) != len(set(ids)) or not set(ids) <= set(inspections):
                raise ValidationError({"items": "Los productos deben ser únicos y pertenecer a este retorno."})
            changed = False
            for row in items:
                inspection = inspections[row["order_item"]]
                before = (inspection.received_quantity, inspection.restocked_quantity, inspection.defective_quantity)
                if action == "receive":
                    if "received_quantity" not in row:
                        raise ValidationError({"items": "Indica la cantidad recibida acumulada."})
                    record_receipt(inspection_id=inspection.pk, received_quantity=row["received_quantity"], user=user, note=resolution)
                else:
                    if not {"restocked_quantity", "defective_quantity"} <= row.keys():
                        raise ValidationError({"items": "Indica cantidades aptas y defectuosas acumuladas."})
                    inspect_receipt(
                        inspection_id=inspection.pk, restocked_quantity=row["restocked_quantity"],
                        defective_quantity=row["defective_quantity"], user=user, note=resolution,
                    )
                inspection.refresh_from_db()
                changed |= before != (inspection.received_quantity, inspection.restocked_quantity, inspection.defective_quantity)
            rows = list(case.inspections.all())
            if action == "receive" and all(row.received_quantity == row.expected_quantity for row in rows):
                case.status = CancellationRequest.Status.RECEIVED
            elif action == "inspect" and all(
                row.restocked_quantity + row.defective_quantity == row.expected_quantity for row in rows
            ):
                case.status = CancellationRequest.Status.INSPECTED
            if not changed:
                return case
            text = "Se registraron las cantidades recibidas; permanecen pendientes de revisión." if action == "receive" else "Se registró la inspección y el destino de las unidades recibidas."
        elif action == "complete":
            if case.status == CancellationRequest.Status.COMPLETED:
                return case
            if case.status != CancellationRequest.Status.INSPECTED:
                raise ValidationError({"status": "Completa la recepción e inspección antes de resolver el reembolso."})
            inspections = list(case.inspections.select_related("order_item").all())
            if not inspections or any(row.received_quantity != row.expected_quantity or row.quarantined_quantity for row in inspections):
                raise ValidationError({"status": "Quedan unidades sin recibir o revisar."})
            for row in inspections:
                refund_item(
                    row.order_item, row.order_item.total_price, user, cancellation_request=case,
                    operation_key=f"cancel:{case.pk}:refund:{row.order_item_id}",
                    reason=resolution.strip()[:255] or "Reembolso simulado tras recibir e inspeccionar el retorno.",
                )
            case.status = CancellationRequest.Status.COMPLETED
            case.resolved_at = timezone.now()
            case.resolved_by = user
            _cancel_outbound(shipment, user)
            # Guardar la resolución comercial antes de recalcular el conjunto.
            case.save()
            _update_order(order)
            text = resolution.strip() or "Cancelación completada con reembolso simulado de los productos."
        elif action == "reject":
            if case.status == CancellationRequest.Status.REJECTED:
                return case
            if case.status != CancellationRequest.Status.REQUESTED or len(resolution.strip()) < 10:
                raise ValidationError({"resolution": "Solo se puede rechazar una solicitud pendiente, explicando el motivo."})
            case.status = CancellationRequest.Status.REJECTED
            case.resolved_at = timezone.now()
            case.resolved_by = user
            text = resolution.strip()
        else:
            raise ValidationError({"action": "Acción no permitida."})

        if resolution.strip():
            case.resolution = resolution.strip()
        case.save()
        _event(case, user, action, text)
        return case
