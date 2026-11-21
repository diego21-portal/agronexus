"""Serialize active-cart changes with checkout's parent-cart lock."""

from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework.exceptions import APIException, NotFound, ValidationError

from apps.products.models import Product

from .models import Cart, CartItem


class CartAlreadyProcessed(APIException):
    status_code = 409
    default_detail = "El carrito ya fue procesado. Actualiza el carrito antes de continuar."
    default_code = "cart_processed"


def _locked_cart(user, *, cart_id=None, create=False):
    # Serializing selection/creation on the owner prevents two simultaneous
    # requests from creating independent active carts. NO KEY UPDATE does not
    # conflict with checkout's new Order.user foreign-key check.
    get_user_model().objects.select_for_update(no_key=True).get(pk=user.pk)
    if cart_id is None:
        cart = Cart.objects.select_for_update().filter(
            user=user, status=Cart.Status.ACTIVE,
        ).first()
    else:
        cart = Cart.objects.select_for_update().filter(pk=cart_id, user=user).first()
    if cart is None:
        if not create:
            return None
        cart = Cart.objects.create(user=user, status=Cart.Status.ACTIVE)
    if cart.status != Cart.Status.ACTIVE:
        raise CartAlreadyProcessed()
    return cart


def validate_product(product, quantity):
    if not isinstance(quantity, int) or isinstance(quantity, bool) or quantity <= 0:
        raise ValidationError({"quantity": "La cantidad debe ser un entero mayor que cero."})
    if not product.is_active:
        raise ValidationError({"product_id": "El producto no está activo."})
    if product.status != Product.Status.PUBLISHED:
        raise ValidationError({"product_id": "El producto no está publicado."})
    if not product.seller.is_active or not product.seller.user.is_active:
        raise ValidationError({"product_id": "El vendedor no está disponible."})
    if product.stock <= 0:
        raise ValidationError({"product_id": "El producto no tiene stock disponible."})
    if quantity > product.stock:
        raise ValidationError({"quantity": "La cantidad supera el stock disponible."})


def _locked_product(product_id):
    product = Product.objects.select_for_update(of=("self",)).select_related(
        "seller__user",
    ).filter(pk=product_id).first()
    if product is None:
        raise ValidationError({"product_id": "El producto ya no está disponible."})
    return product


@transaction.atomic
def get_active_cart(user):
    cart = _locked_cart(user, create=True)
    # Populate the response while mutations still wait on the parent row.
    return Cart.objects.prefetch_related("items__product").get(pk=cart.pk)


@transaction.atomic
def add_cart_item(*, user, product_id, quantity, cart_id=None):
    cart = _locked_cart(user, cart_id=cart_id, create=cart_id is None)
    if cart is None:
        raise CartAlreadyProcessed()
    item = CartItem.objects.select_for_update().filter(cart=cart, product_id=product_id).first()
    product = _locked_product(product_id)
    total_quantity = quantity + (item.quantity if item else 0)
    validate_product(product, total_quantity)
    if item is None:
        return CartItem.objects.create(
            cart=cart, product=product, quantity=quantity, unit_price=product.current_price,
        )
    item.product = product
    item.quantity = total_quantity
    item.unit_price = product.current_price
    item.save(update_fields=["quantity", "unit_price", "updated_at"])
    return item


@transaction.atomic
def update_cart_item(*, user, item_id, cart_id, quantity):
    cart = _locked_cart(user, cart_id=cart_id)
    if cart is None:
        raise NotFound("El ítem no existe en tu carrito.")
    item = CartItem.objects.select_for_update().filter(pk=item_id, cart=cart).first()
    if item is None:
        raise NotFound("El ítem no existe en tu carrito.")
    product = _locked_product(item.product_id)
    validate_product(product, quantity)
    item.product = product
    item.quantity = quantity
    item.unit_price = product.current_price
    item.save(update_fields=["quantity", "unit_price", "updated_at"])
    return item


@transaction.atomic
def delete_cart_item(*, user, item_id):
    cart = _locked_cart(user)
    if cart is None:
        raise NotFound("El ítem no existe en tu carrito.")
    item = CartItem.objects.select_for_update().filter(pk=item_id, cart=cart).first()
    if item is None:
        raise NotFound("El ítem no existe en tu carrito.")
    item.delete()


@transaction.atomic
def clear_cart(user):
    cart = _locked_cart(user)
    if cart is not None:
        cart.items.all().delete()
