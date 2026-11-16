"""Stock changes share one lock and one audit record."""

from django.db import transaction
from rest_framework.exceptions import PermissionDenied, ValidationError

from .models import Product, StockMovement


def _check_stock_actor(product, user, movement_type, order_item):
    if not user or not user.is_authenticated or not user.is_active:
        raise PermissionDenied("La operación requiere un usuario activo.")

    is_admin = getattr(user, "effective_role", user.role) in {"ADMIN", "SUPER_ADMIN"}
    owns_product = product.seller.user_id == user.pk and product.seller.is_active
    if movement_type in {
        StockMovement.MovementType.SALE,
        StockMovement.MovementType.RETURN,
        StockMovement.MovementType.CANCELLATION,
    }:
        if order_item is None or not order_item.pk or order_item.product_id != product.pk or order_item.seller_id != product.seller_id:
            raise ValidationError({"order_item": "El movimiento debe corresponder a un producto comprado."})
        owns_purchase = order_item.order.user_id == user.pk
        if not (is_admin or owns_product or owns_purchase):
            raise PermissionDenied("No puedes modificar el inventario de esta compra.")
    elif not (is_admin or owns_product):
        raise PermissionDenied("No puedes modificar el inventario de este vendedor.")


def change_stock(*, product_id, delta, user, movement_type, reason, operation_key=None, order_item=None):
    """Apply a relative change once, preserving stock history and publication."""
    if not isinstance(reason, str) or len(reason) > 255:
        raise ValidationError({"reason": "El motivo debe tener como máximo 255 caracteres."})
    if operation_key is not None and (not isinstance(operation_key, str) or len(operation_key) > 160):
        raise ValidationError({"operation_key": "La referencia debe tener como máximo 160 caracteres."})
    operation_key = operation_key or None
    if not isinstance(delta, int) or isinstance(delta, bool) or delta == 0:
        raise ValidationError({"quantity": "La cantidad debe ser un entero distinto de cero."})
    if movement_type not in StockMovement.MovementType.values:
        raise ValidationError({"movement_type": "Tipo de movimiento no permitido."})
    if movement_type in {
        StockMovement.MovementType.INITIAL, StockMovement.MovementType.RESTOCK,
        StockMovement.MovementType.RETURN, StockMovement.MovementType.CANCELLATION,
    } and delta < 0:
        raise ValidationError({"quantity": "Este movimiento requiere una cantidad positiva."})
    if movement_type == StockMovement.MovementType.SALE and delta > 0:
        raise ValidationError({"quantity": "Una venta debe descontar unidades."})
    if movement_type in {
        StockMovement.MovementType.SALE,
        StockMovement.MovementType.RETURN,
        StockMovement.MovementType.CANCELLATION,
    } and not operation_key:
        raise ValidationError({"operation_key": "La operación de compra debe tener una referencia única."})
    if movement_type == StockMovement.MovementType.SALE and (
        order_item is None or order_item.quantity != -delta
    ):
        raise ValidationError({"order_item": "La venta debe descontar exactamente las unidades del ítem comprado."})

    with transaction.atomic():
        product = Product.objects.select_for_update(of=("self",)).select_related("seller").get(pk=product_id)
        _check_stock_actor(product, user, movement_type, order_item)
        if operation_key:
            previous = StockMovement.objects.filter(operation_key=operation_key).first()
            if previous is not None:
                if (previous.product_id, previous.quantity, previous.movement_type, previous.order_item_id) != (
                    product.pk, delta, movement_type, getattr(order_item, "pk", None),
                ):
                    raise ValidationError({"operation_key": "La referencia ya se utilizó para otra operación."})
                # Use the current product, not an old stock snapshot.
                previous.product = product
                return previous

        old_stock = product.stock
        new_stock = old_stock + delta
        if new_stock < 0:
            raise ValidationError({"quantity": "El movimiento no puede dejar el stock en negativo."})
        if new_stock > 2147483647:
            raise ValidationError({"quantity": "La cantidad supera el límite de inventario permitido."})
        product.stock = new_stock
        if new_stock == 0 and product.status == Product.Status.PUBLISHED:
            product.status = Product.Status.OUT_OF_STOCK
        elif new_stock > 0 and product.status == Product.Status.OUT_OF_STOCK and product.is_active:
            product.status = Product.Status.PUBLISHED
        product.save(update_fields=["stock", "status", "updated_at"])
        movement = StockMovement.objects.create(
            product=product, movement_type=movement_type, quantity=delta,
            previous_stock=old_stock, new_stock=new_stock, reason=reason,
            created_by=user, operation_key=operation_key, order_item=order_item,
        )

        from apps.notifications.models import Notification
        from apps.notifications.services import create_notification

        if new_stock == 0:
            create_notification(
                user=product.seller.user, title="Producto agotado",
                message=f"El producto {product.name} quedó sin stock.",
                notification_type=Notification.NotificationType.PRODUCT_OUT_OF_STOCK,
                related_object_type="Product", related_object_id=product.id,
                action_url=f"/seller/products/{product.id}",
            )
        elif product.minimum_stock > 0 and new_stock <= product.minimum_stock:
            create_notification(
                user=product.seller.user, title="Stock bajo",
                message=f"El producto {product.name} está por debajo del stock mínimo.",
                notification_type=Notification.NotificationType.STOCK_LOW,
                related_object_type="Product", related_object_id=product.id,
                action_url=f"/seller/products/{product.id}",
            )
        return movement
