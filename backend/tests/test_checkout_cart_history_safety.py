"""Consumed carts stay historical even when administrative paths are attempted."""

from copy import deepcopy
from uuid import uuid4

import pytest
from django.contrib import admin
from django.test import RequestFactory

from apps.carts.admin import CartItemInline
from apps.carts.models import Cart
from apps.notifications.models import Notification
from apps.orders.models import Order
from apps.payments.models import Payment
from apps.products.models import StockMovement
from apps.shipments.models import Shipment
from tests.checkout_helpers import CHECKOUT_URL, QUOTE_URL, prepare_checkout_payload


pytestmark = pytest.mark.django_db


@pytest.fixture
def purchased_cart(customer_client, customer_user, product, address):
    added = customer_client.post(
        "/api/v1/cart/items/", {"product_id": product.pk, "quantity": 2}, format="json",
    )
    assert added.status_code == 201, added.data
    cart = Cart.objects.get(user=customer_user, status=Cart.Status.ACTIVE)
    payload = prepare_checkout_payload(customer_client, address.pk)
    purchased = customer_client.post(CHECKOUT_URL, payload, format="json")
    assert purchased.status_code == 201, purchased.data
    cart.refresh_from_db()
    return cart, payload, purchased.data


def purchase_effects():
    return {
        "orders": Order.objects.count(),
        "payments": Payment.objects.count(),
        "shipments": Shipment.objects.count(),
        "sales": StockMovement.objects.filter(movement_type=StockMovement.MovementType.SALE).count(),
        "notifications": Notification.objects.count(),
    }


def test_reactivated_consumed_cart_cannot_be_quoted_or_purchased_again(
    purchased_cart, customer_client, product,
):
    cart, payload, purchase = purchased_cart
    Cart.objects.filter(pk=cart.pk).update(status=Cart.Status.ACTIVE)
    original_cart = Cart.objects.values().get(pk=cart.pk)
    original_items = list(cart.items.values())
    original_purchase = deepcopy(purchase)
    original_effects = purchase_effects()
    product.refresh_from_db()
    original_stock = product.stock

    quoted = customer_client.post(
        QUOTE_URL,
        {"address_id": payload["address_id"], "payment_method": payload["payment_method"]},
        format="json",
    )
    assert quoted.status_code == 400, quoted.data
    assert "cart" in quoted.data

    repeated = customer_client.post(
        CHECKOUT_URL, {**payload, "idempotency_key": str(uuid4())}, format="json",
    )
    assert repeated.status_code == 409, repeated.data
    assert repeated.data["code"] == "quote_changed"
    assert repeated.data["quote"] is None

    replay = customer_client.post(CHECKOUT_URL, payload, format="json")
    assert replay.status_code == 200, replay.data
    assert replay.data == original_purchase
    assert purchase_effects() == original_effects
    assert Cart.objects.values().get(pk=cart.pk) == original_cart
    assert list(cart.items.values()) == original_items
    product.refresh_from_db()
    assert product.stock == original_stock


@pytest.mark.parametrize("model", ["cart", "cartitem"])
@pytest.mark.parametrize("action", ["add", "change", "delete"])
def test_cart_admin_cannot_bypass_cart_or_purchase_serialization(
    purchased_cart, admin_client, admin_user, model, action,
):
    cart, _, _ = purchased_cart
    item = cart.items.get()
    original_cart = Cart.objects.values().get(pk=cart.pk)
    original_items = list(cart.items.values())
    original_effects = purchase_effects()
    object_id = cart.pk if model == "cart" else item.pk
    path = f"/admin/carts/{model}/add/" if action == "add" else f"/admin/carts/{model}/{object_id}/{action}/"
    admin_client.force_login(admin_user)

    denied = admin_client.post(path, {
        "status": Cart.Status.ACTIVE, "quantity": 99, "unit_price": "0.01", "post": "yes",
        "items-TOTAL_FORMS": 1, "items-INITIAL_FORMS": 1,
        "items-0-id": item.pk, "items-0-quantity": 99, "items-0-DELETE": "on",
    })

    assert denied.status_code == 403
    assert Cart.objects.values().get(pk=cart.pk) == original_cart
    assert list(cart.items.values()) == original_items
    assert purchase_effects() == original_effects


def test_cart_admin_keeps_inline_read_only_for_active_and_consumed_carts(
    purchased_cart, admin_user,
):
    cart, _, _ = purchased_cart
    request = RequestFactory().get(f"/admin/carts/cart/{cart.pk}/change/")
    request.user = admin_user
    inline = CartItemInline(Cart, admin.site)

    for status in (Cart.Status.ACTIVE, Cart.Status.ORDERED):
        cart.status = status
        assert not inline.has_add_permission(request, cart)
        assert not inline.has_change_permission(request, cart)
        assert not inline.has_delete_permission(request, cart)


def test_customer_purchase_notification_links_to_account_order_history(
    purchased_cart, customer_user,
):
    _, _, purchase = purchased_cart
    notification = Notification.objects.get(
        user=customer_user,
        notification_type=Notification.NotificationType.ORDER_CREATED,
        related_object_id=purchase["id"],
    )
    assert notification.action_url == f"/account/orders/{purchase['id']}"
