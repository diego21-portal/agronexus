from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from apps.notifications.models import Notification
from apps.notifications.services import create_notification
from apps.orders.models import Order

from .models import Shipment, ShipmentEvent


TRANSIT_STATUSES = {
    Shipment.Status.DISPATCHED,
    Shipment.Status.IN_TRANSIT,
    Shipment.Status.IN_DISTRIBUTION_CENTER,
    Shipment.Status.OUT_FOR_DELIVERY,
}
PROGRESS = {
    Shipment.Status.CREATED: 0,
    Shipment.Status.PREPARING: 1,
    Shipment.Status.DISPATCHED: 2,
    Shipment.Status.IN_TRANSIT: 3,
    Shipment.Status.IN_DISTRIBUTION_CENTER: 4,
    Shipment.Status.OUT_FOR_DELIVERY: 5,
    Shipment.Status.DELIVERED: 6,
}


def seller_order_status(shipment, fallback):
    if shipment is None or shipment.status == Shipment.Status.CREATED:
        if fallback in {Order.Status.PENDING, Order.Status.CONFIRMED, Order.Status.PAID, Order.Status.CANCELLED}:
            return fallback
        return Order.Status.PAID
    if shipment.status in TRANSIT_STATUSES:
        return Order.Status.SHIPPED
    return {
        Shipment.Status.PREPARING: Order.Status.PREPARING,
        Shipment.Status.DELIVERED: Order.Status.DELIVERED,
        Shipment.Status.DELIVERY_PROBLEM: Order.Status.PROBLEM,
        Shipment.Status.CANCELLED: Order.Status.CANCELLED,
    }[shipment.status]


def aggregate_order_status(order):
    """La orden solo avanza de fase cuando lo hacen todos sus envíos."""
    statuses = set(order.shipments.values_list("status", flat=True))
    if statuses == {Shipment.Status.DELIVERED}:
        return Order.Status.DELIVERED
    if statuses == {Shipment.Status.CANCELLED}:
        return Order.Status.CANCELLED
    if statuses & {Shipment.Status.DELIVERY_PROBLEM, Shipment.Status.CANCELLED}:
        return Order.Status.PROBLEM
    if statuses and statuses <= TRANSIT_STATUSES | {Shipment.Status.DELIVERED}:
        return Order.Status.SHIPPED
    if statuses - {Shipment.Status.CREATED}:
        return Order.Status.PREPARING
    return order.status


def update_seller_shipment(*, shipment_id, order_id, user, changes):
    """Ambas rutas del vendedor pasan por el mismo bloqueo y validación."""
    changes = dict(changes)
    description = changes.pop("description", "")
    location = changes.pop("location", "")

    with transaction.atomic():
        # El bloqueo común serializa también actualizaciones de vendedores
        # distintos y evita perder el estado agregado de la última entrega.
        order = Order.objects.select_for_update().get(pk=order_id)
        shipment = (
            Shipment.objects.select_for_update(of=("self",))
            .filter(pk=shipment_id, order=order, seller__user=user)
            .first()
        )
        if shipment is None:
            raise NotFound("No se encontró el envío del vendedor.")

        if order.status in {Order.Status.CANCELLED, Order.Status.DELIVERED}:
            raise ValidationError({"status": "No se puede modificar una orden finalizada."})
        if shipment.status in {Shipment.Status.DELIVERED, Shipment.Status.CANCELLED}:
            raise ValidationError({"status": "No se puede modificar un envío finalizado."})

        old_status = shipment.status
        new_status = changes.get("status", old_status)
        if new_status == Shipment.Status.CANCELLED:
            raise ValidationError({
                "status": "La cancelación requiere gestionar inventario y reembolso; no está habilitada en esta operación."
            })
        if new_status not in PROGRESS and new_status != Shipment.Status.DELIVERY_PROBLEM:
            raise ValidationError({"status": "Estado de envío no permitido."})
        if new_status == Shipment.Status.CREATED and old_status != Shipment.Status.CREATED:
            raise ValidationError({"status": "Un envío iniciado no puede volver a creado."})
        if (
            new_status != old_status
            and old_status in PROGRESS
            and new_status in PROGRESS
            and PROGRESS[new_status] < PROGRESS[old_status]
        ):
            raise ValidationError({"status": "El envío no puede retroceder a una fase anterior."})

        for field, value in changes.items():
            setattr(shipment, field, value)
        if new_status == Shipment.Status.DELIVERED:
            shipment.delivered_at = timezone.now()
        shipment.save()

        if old_status != new_status:
            ShipmentEvent.objects.create(
                shipment=shipment,
                status=new_status,
                description=description or f"El envío cambió a estado {new_status}.",
                location=location,
                created_by=user,
            )
            order.status = aggregate_order_status(order)
            order.save(update_fields=["status", "updated_at"])
            create_notification(
                user=order.user,
                title="Actualización de envío",
                message=f"El envío {shipment.tracking_code} de tu orden {order.order_number} cambió a {new_status}.",
                notification_type=Notification.NotificationType.SHIPMENT_UPDATED,
                related_object_type="Shipment",
                related_object_id=shipment.id,
                action_url=f"/account/orders/{order.id}/tracking",
            )
        return shipment
