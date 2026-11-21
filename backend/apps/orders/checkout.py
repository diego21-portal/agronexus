"""Server quotes and atomic, replayable confirmation of a purchase."""

import hashlib
import json
from datetime import datetime, timezone as datetime_timezone
from decimal import Decimal

from django.core import signing
from django.db import IntegrityError, transaction
from rest_framework.exceptions import APIException, ValidationError

from apps.carts.models import Cart
from apps.notifications.models import Notification
from apps.notifications.services import create_notification
from apps.payments.models import Payment
from apps.products.models import Product, StockMovement
from apps.products.services import change_stock
from apps.shipments.models import Shipment, ShipmentEvent
from apps.users.models import Address

from .models import Order, OrderItem


QUOTE_SIGNING_SALT = "checkout.quote.v1"
QUOTE_TTL_SECONDS = 300
MAX_MONEY = Decimal("9999999999.99")


class CheckoutError(APIException):
    """Preserve the JSON types of a replacement quote in an error response."""

    def __init__(self, code, detail, *, status_code=400, quote=None, include_quote=False):
        self.status_code = status_code
        self.detail = {"code": code, "detail": detail}
        if include_quote:
            self.detail["quote"] = quote


def validate_cart_item(item, product):
    if item.quantity <= 0:
        raise ValidationError({"cart": "La cantidad de cada producto debe ser mayor que cero."})
    if not product.is_active or product.status != Product.Status.PUBLISHED:
        raise ValidationError({"cart": f"El producto {product.name} ya no está disponible."})
    if not product.seller.is_active or not product.seller.user.is_active:
        raise ValidationError({"cart": f"El vendedor de {product.name} no está disponible."})
    if item.quantity > product.stock:
        raise ValidationError({"cart": f"No hay stock suficiente para {product.name}. Disponible: {product.stock}."})


def address_snapshot(address):
    return {
        "region_id": address.region_id,
        "region_name": address.region.name,
        "street": address.street,
        "number": address.number,
        "city": address.city,
        "province": address.province,
        "postal_code": address.postal_code,
        "reference": address.reference,
    }


def _money(value):
    return format(value, ".2f")


def _products(items, *, lock=False):
    queryset = Product.objects.select_related("seller__user")
    if lock:
        queryset = queryset.select_for_update(of=("self",))
    return {
        product.pk: product
        for product in queryset.filter(pk__in=[item.product_id for item in items]).order_by("pk")
    }


def _material_snapshot(*, user, cart, address, items, products, payment_method):
    if not items:
        raise ValidationError({"cart": "No tienes productos en el carrito."})
    quoted_items = []
    subtotal = Decimal("0.00")
    price_changed = False
    for item in items:
        product = products.get(item.product_id)
        if product is None:
            raise ValidationError({"cart": "Uno de los productos ya no está disponible."})
        validate_cart_item(item, product)
        total_price = product.current_price * item.quantity
        subtotal += total_price
        if subtotal > MAX_MONEY:
            raise ValidationError({"cart": "El importe supera el máximo permitido por compra."})
        price_changed = price_changed or item.unit_price != product.current_price
        quoted_items.append({
            "cart_item_id": item.pk,
            "product_id": product.pk,
            "product_name": product.name,
            "sku": product.sku,
            "seller_id": product.seller_id,
            "seller_name": product.seller.business_name,
            "quantity": item.quantity,
            "unit_price": _money(product.current_price),
            "total_price": _money(total_price),
        })
    discount_total = Decimal("0.00")
    shipping_cost = Decimal("0.00")
    return {
        "version": 1,
        "user_id": user.pk,
        "cart_id": cart.pk,
        "address_id": address.pk,
        "payment_method": payment_method,
        "items": quoted_items,
        "subtotal": _money(subtotal),
        "discount_total": _money(discount_total),
        "shipping_cost": _money(shipping_cost),
        "total": _money(subtotal - discount_total + shipping_cost),
        "currency": "ARS",
        "shipping_address_snapshot": address_snapshot(address),
    }, price_changed


def _quote_response(material, price_changed):
    token = signing.dumps(material, salt=QUOTE_SIGNING_SALT, compress=True)
    signed_at = signing.b62_decode(token.rsplit(":", 2)[1])
    expires_at = datetime.fromtimestamp(signed_at + QUOTE_TTL_SECONDS, tz=datetime_timezone.utc)
    public_fields = (
        "cart_id", "items", "subtotal", "discount_total", "shipping_cost", "total",
        "currency", "shipping_address_snapshot",
    )
    return {
        "quote_token": token,
        "expires_at": expires_at.isoformat().replace("+00:00", "Z"),
        **{field: material[field] for field in public_fields},
        "price_changed": price_changed,
    }


def create_quote(*, user, address_id, payment_method):
    """Read current values; issuing a quote never reserves or writes anything."""
    address = Address.objects.select_related("region").filter(
        pk=address_id, user=user, is_active=True,
    ).first()
    if address is None:
        raise ValidationError({"address_id": "La dirección seleccionada no existe o no te pertenece."})
    cart = Cart.objects.filter(user=user, status=Cart.Status.ACTIVE).first()
    if cart is None:
        raise ValidationError({"cart": "No tienes productos en el carrito."})
    if Order.objects.filter(source_cart_id=cart.pk).exists():
        raise ValidationError({"cart": "Este carrito ya fue convertido en una compra."})
    items = list(cart.items.order_by("product_id", "pk"))
    material, price_changed = _material_snapshot(
        user=user, cart=cart, address=address, items=items,
        products=_products(items), payment_method=payment_method,
    )
    return _quote_response(material, price_changed)


def read_quote(*, token, user, address_id, payment_method, verify_age=True):
    try:
        material = signing.loads(
            token, salt=QUOTE_SIGNING_SALT,
            max_age=QUOTE_TTL_SECONDS if verify_age else None,
        )
    except signing.SignatureExpired as exc:
        raise CheckoutError("quote_expired", "La cotización venció. Solicita una nueva antes de confirmar.") from exc
    except (signing.BadSignature, ValueError, TypeError, UnicodeDecodeError) as exc:
        raise CheckoutError("quote_invalid", "La cotización no es válida para esta compra.") from exc
    if (
        not isinstance(material, dict)
        or material.get("version") != 1
        or material.get("user_id") != user.pk
        or material.get("address_id") != address_id
        or material.get("payment_method") != payment_method
        or not isinstance(material.get("cart_id"), int)
        or isinstance(material.get("cart_id"), bool)
        or material["cart_id"] <= 0
    ):
        raise CheckoutError("quote_invalid", "La cotización no es válida para esta compra.")
    return material


def request_fingerprint(*, user, address_id, payment_method, quote_token, idempotency_key):
    material = {
        "user_id": user.pk,
        "address_id": address_id,
        "payment_method": payment_method,
        "quote_token": quote_token,
        "idempotency_key": str(idempotency_key),
    }
    return hashlib.sha256(json.dumps(material, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def find_replay(*, user, idempotency_key, fingerprint):
    order = Order.objects.filter(user=user, checkout_key=idempotency_key).first()
    if order is not None and order.checkout_fingerprint != fingerprint:
        raise CheckoutError(
            "idempotency_conflict", "La referencia ya se utilizó con otros datos de compra.", status_code=409,
        )
    return order


def _changed_quote(*, user, address_id, payment_method):
    try:
        replacement = create_quote(user=user, address_id=address_id, payment_method=payment_method)
    except ValidationError:
        replacement = None
    return CheckoutError(
        "quote_changed", "La compra cambió. Revisa la cotización y confirma nuevamente.",
        status_code=409, quote=replacement, include_quote=True,
    )


def _create_purchase(*, user, cart, address, items, products, material, idempotency_key, fingerprint):
    order = Order.objects.create(
        user=user, shipping_address=address,
        shipping_address_snapshot=material["shipping_address_snapshot"],
        shipping_address_snapshot_source=Order.AddressSnapshotSource.CHECKOUT,
        source_cart=cart, checkout_key=idempotency_key, checkout_fingerprint=fingerprint,
        status=Order.Status.PAID, subtotal=Decimal(material["subtotal"]),
        discount_total=Decimal(material["discount_total"]),
        shipping_cost=Decimal(material["shipping_cost"]), total=Decimal(material["total"]),
    )
    for item, quoted in zip(items, material["items"], strict=True):
        product = products[item.product_id]
        order_item = OrderItem.objects.create(
            order=order, product=product, seller=product.seller,
            product_name=quoted["product_name"], sku=quoted["sku"], quantity=quoted["quantity"],
            unit_price=Decimal(quoted["unit_price"]), total_price=Decimal(quoted["total_price"]),
        )
        change_stock(
            product_id=product.pk, delta=-item.quantity, user=user,
            movement_type=StockMovement.MovementType.SALE,
            reason=f"Venta generada por orden {order.order_number}.",
            operation_key=f"sale:{order.pk}:item:{order_item.pk}", order_item=order_item,
        )
    payment = Payment.objects.create(
        order=order, payment_method=material["payment_method"],
        status=Payment.Status.PENDING, amount=order.total,
    )
    payment.approve()
    sellers = {product.seller_id: product.seller for product in products.values()}
    for seller_id in sorted(sellers):
        shipment = Shipment.objects.create(order=order, seller_id=seller_id, status=Shipment.Status.CREATED)
        ShipmentEvent.objects.create(
            shipment=shipment, status=Shipment.Status.CREATED,
            description="La compra fue registrada y el envío del vendedor fue creado.",
            location=material["shipping_address_snapshot"]["city"], created_by=user,
        )
    cart.status = Cart.Status.ORDERED
    cart.save(update_fields=["status", "updated_at"])
    create_notification(
        user=user, title="Compra confirmada", message=f"Tu compra {order.order_number} fue confirmada correctamente.",
        notification_type=Notification.NotificationType.ORDER_CREATED,
        related_object_type="Order", related_object_id=order.pk, action_url=f"/account/orders/{order.pk}",
    )
    for seller_id in sorted(sellers):
        create_notification(
            user=sellers[seller_id].user, title="Nuevo pedido recibido",
            message=f"Recibiste una nueva venta en la orden {order.order_number}.",
            notification_type=Notification.NotificationType.ORDER_CREATED,
            related_object_type="Order", related_object_id=order.pk, action_url=f"/seller/orders/{order.pk}",
        )
    return order


def confirm_checkout(*, user, address_id, payment_method, quote_token, idempotency_key, fingerprint, quoted):
    """Serialize cart confirmation and recover identical HTTP retries safely."""
    existing = find_replay(user=user, idempotency_key=idempotency_key, fingerprint=fingerprint)
    if existing is not None:
        return existing, False
    try:
        with transaction.atomic():
            # Lock in the same order as the cart's mutation services: parent
            # first, then address, items and sorted product rows.
            cart = Cart.objects.select_for_update().filter(pk=quoted["cart_id"], user=user).first()
            existing = find_replay(user=user, idempotency_key=idempotency_key, fingerprint=fingerprint)
            if existing is not None:
                return existing, False
            if (
                cart is None
                or cart.status != Cart.Status.ACTIVE
                or Order.objects.filter(source_cart_id=cart.pk).exists()
            ):
                raise _changed_quote(user=user, address_id=address_id, payment_method=payment_method)
            address = Address.objects.select_for_update(of=("self",)).select_related("region").filter(
                pk=address_id, user=user, is_active=True,
            ).first()
            if address is None:
                raise _changed_quote(user=user, address_id=address_id, payment_method=payment_method)
            items = list(cart.items.select_for_update().order_by("product_id", "pk"))
            products = _products(items, lock=True)
            # Waiting for either cart or product locks must not extend a quote.
            quoted = read_quote(token=quote_token, user=user, address_id=address_id, payment_method=payment_method)
            try:
                current, _ = _material_snapshot(
                    user=user, cart=cart, address=address, items=items,
                    products=products, payment_method=payment_method,
                )
            except ValidationError as exc:
                raise _changed_quote(user=user, address_id=address_id, payment_method=payment_method) from exc
            if current != quoted:
                raise _changed_quote(user=user, address_id=address_id, payment_method=payment_method)
            return _create_purchase(
                user=user, cart=cart, address=address, items=items, products=products, material=quoted,
                idempotency_key=idempotency_key, fingerprint=fingerprint,
            ), True
    except IntegrityError:
        # A repeated key on another legacy cart can race past the initial
        # lookup. The unique constraint chooses its winner; its loser rolls
        # back before looking up the committed purchase.
        existing = find_replay(user=user, idempotency_key=idempotency_key, fingerprint=fingerprint)
        if existing is not None:
            return existing, False
        raise
