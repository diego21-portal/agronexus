"""The customer confirms a quoted purchase once, with immutable history."""

from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from decimal import Decimal
from queue import Queue
from threading import Barrier, Event
from time import monotonic, sleep, time
from unittest.mock import patch
from uuid import uuid4

import pytest
from django.core.exceptions import ValidationError
from django.db import close_old_connections, connection, transaction
from django.db.models.deletion import ProtectedError
from rest_framework.test import APIClient

from apps.carts.models import Cart
from apps.notifications.models import Notification
from apps.orders.models import Order, OrderItem
from apps.orders import checkout as checkout_service
from apps.orders.serializers import CheckoutSerializer
from apps.payments.models import Payment
from apps.products.models import Product, StockMovement
from apps.sellers.models import SellerProfile
from apps.shipments.models import Shipment
from apps.users.models import Address, User
from tests.checkout_helpers import CHECKOUT_URL, QUOTE_URL, prepare_checkout_payload


pytestmark = pytest.mark.django_db


@pytest.fixture
def quoted_cart(customer_client, customer_user, product, address):
    added = customer_client.post(
        "/api/v1/cart/items/", {"product_id": product.pk, "quantity": 2}, format="json",
    )
    assert added.status_code == 201, added.data
    return {
        "item_id": added.data["id"],
        "cart": Cart.objects.get(user=customer_user, status=Cart.Status.ACTIVE),
        "payload": prepare_checkout_payload(customer_client, address.pk),
    }


def effects():
    return {
        "orders": Order.objects.count(),
        "payments": Payment.objects.count(),
        "shipments": Shipment.objects.count(),
        "sales": StockMovement.objects.filter(movement_type=StockMovement.MovementType.SALE).count(),
        "notifications": Notification.objects.filter(notification_type=Notification.NotificationType.ORDER_CREATED).count(),
    }


def assert_no_purchase(product, original_stock=10):
    assert effects() == {"orders": 0, "payments": 0, "shipments": 0, "sales": 0, "notifications": 0}
    product.refresh_from_db()
    assert product.stock == original_stock


def confirm(client, payload):
    return client.post(CHECKOUT_URL, payload, format="json")


def test_quote_exposes_current_prices_address_and_does_not_purchase(quoted_cart, customer_client, product, address):
    Product.objects.filter(pk=product.pk).update(price=Decimal("90000.00"))
    response = customer_client.post(
        QUOTE_URL, {"address_id": address.pk, "payment_method": "SIMULATED_CARD"}, format="json",
    )
    assert response.status_code == 200, response.data
    quote = response.data
    assert quote["cart_id"] == quoted_cart["cart"].pk
    assert quote["items"][0]["product_id"] == product.pk
    assert quote["items"][0]["quantity"] == 2
    assert Decimal(quote["items"][0]["unit_price"]) == Decimal("90000.00")
    assert Decimal(quote["items"][0]["total_price"]) == Decimal("180000.00")
    assert Decimal(quote["total"]) == Decimal("180000.00")
    assert quote["shipping_address_snapshot"]["street"] == address.street
    assert quote["shipping_address_snapshot"]["region_id"] == address.region_id
    assert isinstance(quote["quote_token"], str) and quote["quote_token"]
    assert quote["expires_at"]
    assert_no_purchase(product)
    quoted_cart["cart"].refresh_from_db()
    assert quoted_cart["cart"].status == Cart.Status.ACTIVE


@pytest.mark.parametrize("path", [QUOTE_URL, CHECKOUT_URL])
def test_checkout_steps_require_authentication(path):
    response = APIClient().post(path, {"address_id": 1, "payment_method": "SIMULATED_CARD"}, format="json")
    assert response.status_code == 401


@pytest.mark.parametrize("missing", ["quote_token", "idempotency_key"])
def test_confirmation_requires_explicit_quote_and_key(quoted_cart, customer_client, product, missing):
    payload = {key: value for key, value in quoted_cart["payload"].items() if key != missing}
    response = confirm(customer_client, payload)
    assert response.status_code == 400, response.data
    assert missing in response.data
    assert_no_purchase(product)


def test_confirmation_requires_uuid_idempotency_key(quoted_cart, customer_client, product):
    response = confirm(customer_client, {**quoted_cart["payload"], "idempotency_key": "not-a-uuid"})
    assert response.status_code == 400
    assert_no_purchase(product)


@pytest.mark.parametrize("payment_method", [choice for choice, _ in Payment.PaymentMethod.choices])
def test_quote_and_confirmation_use_real_payment_enums(quoted_cart, customer_client, address, payment_method):
    payload = prepare_checkout_payload(customer_client, address.pk, payment_method)
    response = confirm(customer_client, payload)
    assert response.status_code == 201, response.data
    assert Payment.objects.get(order_id=response.data["id"]).payment_method == payment_method


@pytest.mark.parametrize("path", [QUOTE_URL, CHECKOUT_URL])
def test_checkout_does_not_accept_frontend_only_payment_names(quoted_cart, customer_client, product, path):
    response = customer_client.post(path, {**quoted_cart["payload"], "payment_method": "CARD"}, format="json")
    assert response.status_code == 400
    assert_no_purchase(product)


def test_tampered_quote_is_rejected_without_any_purchase(quoted_cart, customer_client, product):
    token = quoted_cart["payload"]["quote_token"]
    changed = token[:-5] + ("a" if token[-5] != "a" else "b") + token[-4:]
    response = confirm(customer_client, {**quoted_cart["payload"], "quote_token": changed})
    assert response.status_code == 400
    assert response.data["code"] == "quote_invalid"
    assert_no_purchase(product)


def test_quote_expires_before_first_confirmation(quoted_cart, customer_client, product):
    with patch("django.core.signing.time.time", return_value=time() + 301):
        response = confirm(customer_client, quoted_cart["payload"])
    assert response.status_code == 400, response.data
    assert response.data["code"] == "quote_expired"
    assert_no_purchase(product)


def test_another_customer_cannot_confirm_a_signed_quote(
    quoted_cart, second_customer_client, second_customer_user, address, product,
):
    other_address = Address.objects.create(
        user=second_customer_user, region=address.region, street="Otra calle", number="24",
        city="Mendoza", province="Mendoza",
    )
    response = confirm(second_customer_client, {**quoted_cart["payload"], "address_id": other_address.pk})
    assert response.status_code == 400, response.data
    assert response.data["code"] == "quote_invalid"
    assert_no_purchase(product)


def test_quote_rejects_another_customers_address(quoted_cart, second_customer_client, address, product):
    response = second_customer_client.post(
        QUOTE_URL, {"address_id": address.pk, "payment_method": "SIMULATED_CARD"}, format="json",
    )
    assert response.status_code == 400
    assert_no_purchase(product)


@pytest.mark.parametrize("param", ["address_id", "payment_method"])
def test_signed_quote_cannot_be_applied_to_different_parameters(
    quoted_cart, customer_client, customer_user, address, product, param,
):
    replacement = "SIMULATED_BANK_TRANSFER"
    if param == "address_id":
        replacement = Address.objects.create(
            user=customer_user, region=address.region, street="Destino distinto", number="8",
            city="Mendoza", province="Mendoza",
        ).pk
    response = confirm(customer_client, {**quoted_cart["payload"], param: replacement})
    assert response.status_code == 400, response.data
    assert_no_purchase(product)


@pytest.mark.parametrize("change", [
    "price", "discount", "product_name", "sku", "seller_name", "quantity", "address", "cart_emptied",
    "inactive_product", "inactive_seller", "inactive_seller_user", "inactive_address", "stock_shortage",
])
def test_material_changes_require_a_new_review_without_purchase(
    quoted_cart, customer_client, product, address, change,
):
    original_stock = 10
    if change == "price":
        Product.objects.filter(pk=product.pk).update(price=Decimal("95000.00"))
    elif change == "discount":
        Product.objects.filter(pk=product.pk).update(discount_price=Decimal("80000.00"))
    elif change == "product_name":
        Product.objects.filter(pk=product.pk).update(name="Nombre corregido antes de confirmar")
    elif change == "sku":
        Product.objects.filter(pk=product.pk).update(sku="CONFIRMED-NEW-SKU")
    elif change == "seller_name":
        SellerProfile.objects.filter(pk=product.seller_id).update(business_name="Nombre actualizado de la tienda")
    elif change == "quantity":
        edited = customer_client.patch(
            f"/api/v1/cart/items/{quoted_cart['item_id']}/", {"quantity": 3}, format="json",
        )
        assert edited.status_code == 200, edited.data
    elif change == "address":
        edited = customer_client.patch(
            f"/api/v1/users/me/addresses/{address.pk}/", {"street": "Dirección corregida"}, format="json",
        )
        assert edited.status_code == 200, edited.data
    elif change == "cart_emptied":
        assert customer_client.delete(f"/api/v1/cart/items/{quoted_cart['item_id']}/delete/").status_code == 204
    elif change == "inactive_product":
        Product.objects.filter(pk=product.pk).update(is_active=False)
    elif change == "inactive_seller":
        SellerProfile.objects.filter(pk=product.seller_id).update(is_active=False)
    elif change == "inactive_seller_user":
        User.objects.filter(pk=product.seller.user_id).update(is_active=False)
    elif change == "inactive_address":
        Address.objects.filter(pk=address.pk).update(is_active=False)
    else:
        original_stock = 1
        Product.objects.filter(pk=product.pk).update(stock=original_stock)

    response = confirm(customer_client, quoted_cart["payload"])
    assert response.status_code == 409, response.data
    assert response.data["code"] == "quote_changed"
    assert "quote" in response.data
    if change in {"price", "discount", "product_name", "sku", "seller_name", "quantity", "address"}:
        assert response.data["quote"]["quote_token"]
    else:
        assert response.data["quote"] is None
    assert_no_purchase(product, original_stock)


def test_requoted_price_must_be_confirmed_explicitly(quoted_cart, customer_client, product):
    Product.objects.filter(pk=product.pk).update(price=Decimal("95000.00"))
    changed = confirm(customer_client, quoted_cart["payload"])
    assert changed.status_code == 409, changed.data
    assert_no_purchase(product)
    replacement = changed.data["quote"]
    confirmed = confirm(customer_client, {
        **quoted_cart["payload"], "quote_token": replacement["quote_token"], "idempotency_key": str(uuid4()),
    })
    assert confirmed.status_code == 201, confirmed.data
    assert Decimal(confirmed.data["total"]) == Decimal("190000.00")


def test_available_stock_changes_do_not_reserve_or_invalidate_agreed_price(quoted_cart, customer_client, product):
    # Another operation used some units, but enough remain for this quote.
    Product.objects.filter(pk=product.pk).update(stock=5)
    response = confirm(customer_client, quoted_cart["payload"])
    assert response.status_code == 201, response.data
    product.refresh_from_db()
    assert product.stock == 3


def test_client_amounts_cannot_override_server_quote(quoted_cart, customer_client):
    response = confirm(customer_client, {
        **quoted_cart["payload"], "total": "0.01", "subtotal": "0.01", "shipping_cost": "-100.00",
        "items": [{"unit_price": "0.01", "quantity": 1}],
    })
    assert response.status_code == 201, response.data
    order = Order.objects.get(pk=response.data["id"])
    assert order.total == Decimal("170000.00")
    assert order.items.get().quantity == 2
    assert order.payment.amount == order.total


def test_retry_returns_the_order_without_repeating_stock_payment_or_notifications(quoted_cart, customer_client, product):
    first = confirm(customer_client, quoted_cart["payload"])
    assert first.status_code == 201, first.data
    counts = effects()
    second = confirm(customer_client, quoted_cart["payload"])
    assert second.status_code == 200, second.data
    assert second.data["id"] == first.data["id"]
    assert effects() == counts == {"orders": 1, "payments": 1, "shipments": 1, "sales": 1, "notifications": 2}
    assert StockMovement.objects.get(movement_type=StockMovement.MovementType.SALE).quantity == -2
    product.refresh_from_db()
    assert product.stock == 8


def test_retry_after_quote_expiry_still_returns_committed_order(quoted_cart, customer_client):
    first = confirm(customer_client, quoted_cart["payload"])
    assert first.status_code == 201, first.data
    counts = effects()
    with patch("django.core.signing.time.time", return_value=time() + 301):
        retried = confirm(customer_client, quoted_cart["payload"])
    assert retried.status_code == 200, retried.data
    assert retried.data["id"] == first.data["id"]
    assert effects() == counts


def test_retry_does_not_purchase_new_active_cart(quoted_cart, customer_client, customer_user, product):
    first = confirm(customer_client, quoted_cart["payload"])
    added = customer_client.post(
        "/api/v1/cart/items/", {"product_id": product.pk, "quantity": 1}, format="json",
    )
    assert added.status_code == 201, added.data
    new_cart = Cart.objects.get(user=customer_user, status=Cart.Status.ACTIVE)
    retried = confirm(customer_client, quoted_cart["payload"])
    assert retried.status_code == 200 and retried.data["id"] == first.data["id"]
    new_cart.refresh_from_db()
    assert new_cart.status == Cart.Status.ACTIVE
    assert new_cart.items.get().quantity == 1
    assert Order.objects.count() == 1
    product.refresh_from_db()
    assert product.stock == 8


@pytest.mark.parametrize("replacement", ["payment_method", "address_id", "quote_token"])
def test_committed_key_cannot_be_reused_for_different_payload(
    quoted_cart, customer_client, customer_user, address, replacement,
):
    first = confirm(customer_client, quoted_cart["payload"])
    assert first.status_code == 201, first.data
    counts = effects()
    changed = {**quoted_cart["payload"]}
    if replacement == "payment_method":
        changed[replacement] = "SIMULATED_BANK_TRANSFER"
    elif replacement == "address_id":
        changed[replacement] = Address.objects.create(
            user=customer_user, region=address.region, street="Destino distinto", number="99",
            city="Mendoza", province="Mendoza",
        ).pk
    else:
        changed[replacement] = "a different signed purchase would be a different request"
    response = confirm(customer_client, changed)
    assert response.status_code == 409, response.data
    assert response.data["code"] == "idempotency_conflict"
    assert effects() == counts


def test_same_key_has_independent_scope_for_each_customer(
    quoted_cart, customer_client, second_customer_client, second_customer_user, address, product,
):
    other_address = Address.objects.create(
        user=second_customer_user, region=address.region, street="Segundo cliente", number="9",
        city="Mendoza", province="Mendoza",
    )
    added = second_customer_client.post(
        "/api/v1/cart/items/", {"product_id": product.pk, "quantity": 1}, format="json",
    )
    assert added.status_code == 201
    other_payload = prepare_checkout_payload(
        second_customer_client, other_address.pk, idempotency_key=quoted_cart["payload"]["idempotency_key"],
    )
    first = confirm(customer_client, quoted_cart["payload"])
    other = confirm(second_customer_client, other_payload)
    assert first.status_code == other.status_code == 201
    assert first.data["id"] != other.data["id"]
    assert Order.objects.count() == Payment.objects.count() == 2


def test_order_records_source_cart_and_checkout_address_snapshot(quoted_cart, customer_client, address):
    response = confirm(customer_client, quoted_cart["payload"])
    assert response.status_code == 201, response.data
    order = Order.objects.get(pk=response.data["id"])
    assert order.source_cart_id == quoted_cart["cart"].pk
    assert str(order.checkout_key) == quoted_cart["payload"]["idempotency_key"]
    assert order.checkout_fingerprint
    assert order.shipping_address_snapshot_source == Order.AddressSnapshotSource.CHECKOUT
    assert order.shipping_address_snapshot["street"] == address.street
    assert response.data["shipping_address_snapshot"] == order.shipping_address_snapshot
    assert response.data["shipping_address_snapshot_source"] == "CHECKOUT"


def test_purchase_preserves_its_source_cart(quoted_cart, customer_client):
    response = confirm(customer_client, quoted_cart["payload"])
    assert response.status_code == 201, response.data
    with pytest.raises(ProtectedError):
        quoted_cart["cart"].delete()
    assert Order.objects.filter(pk=response.data["id"]).exists()
    assert Cart.objects.filter(pk=quoted_cart["cart"].pk).exists()


def test_address_book_edit_or_deactivation_cannot_rewrite_a_purchase(quoted_cart, customer_client, address):
    purchased = confirm(customer_client, quoted_cart["payload"])
    assert purchased.status_code == 201
    original = deepcopy(purchased.data["shipping_address_snapshot"])
    edited = customer_client.patch(
        f"/api/v1/users/me/addresses/{address.pk}/", {"street": "Nueva calle", "number": "999"}, format="json",
    )
    assert edited.status_code == 200
    assert customer_client.delete(f"/api/v1/users/me/addresses/{address.pk}/").status_code == 204
    fetched = customer_client.get(f"/api/v1/orders/{purchased.data['id']}/")
    assert fetched.status_code == 200
    assert fetched.data["shipping_address_snapshot"] == original
    retried = confirm(customer_client, quoted_cart["payload"])
    assert retried.status_code == 200
    assert retried.data["shipping_address_snapshot"] == original


def test_unrecorded_address_origin_is_reported_as_unknown(customer_user, address):
    legacy = Order.objects.create(user=customer_user, shipping_address=address)
    assert legacy.shipping_address_snapshot is None
    assert legacy.shipping_address_snapshot_source == "LEGACY_UNKNOWN"
    assert legacy.source_cart_id is None
    assert legacy.checkout_key is None


@pytest.mark.parametrize("field,value", [
    ("total", Decimal("0.01")), ("subtotal", Decimal("0.01")),
    ("shipping_address_snapshot", {"street": "Rewritten history"}),
])
def test_normal_order_save_cannot_edit_historical_amounts_or_snapshot(quoted_cart, customer_client, field, value):
    response = confirm(customer_client, quoted_cart["payload"])
    order = Order.objects.get(pk=response.data["id"])
    original = deepcopy(getattr(order, field))
    setattr(order, field, value)
    with pytest.raises(ValidationError):
        order.save(update_fields=[field])
    order.refresh_from_db()
    assert getattr(order, field) == original


def test_normal_order_save_cannot_change_original_address(quoted_cart, customer_client, customer_user, address):
    response = confirm(customer_client, quoted_cart["payload"])
    order = Order.objects.get(pk=response.data["id"])
    other = Address.objects.create(
        user=customer_user, region=address.region, street="Destino posterior", number="7",
        city="Mendoza", province="Mendoza",
    )
    order.shipping_address = other
    with pytest.raises(ValidationError):
        order.save(update_fields=["shipping_address"])
    order.refresh_from_db()
    assert order.shipping_address_id == address.pk


@pytest.mark.parametrize("field,value", [
    ("quantity", 99), ("unit_price", Decimal("0.01")),
    ("total_price", Decimal("0.01")), ("product_name", "A different purchased product"),
])
def test_normal_order_item_save_cannot_edit_purchase_history(quoted_cart, customer_client, field, value):
    response = confirm(customer_client, quoted_cart["payload"])
    item = OrderItem.objects.get(order_id=response.data["id"])
    original = getattr(item, field)
    setattr(item, field, value)
    with pytest.raises(ValidationError):
        item.save(update_fields=[field])
    item.refresh_from_db()
    assert getattr(item, field) == original


@pytest.mark.parametrize("model,action", [
    ("order", "change"), ("order", "delete"), ("order", "add"),
    ("orderitem", "change"), ("orderitem", "delete"), ("orderitem", "add"),
])
def test_django_admin_cannot_rewrite_or_delete_purchases(quoted_cart, customer_client, admin_client, admin_user, model, action):
    response = confirm(customer_client, quoted_cart["payload"])
    order = Order.objects.get(pk=response.data["id"])
    item = order.items.get()
    object_id = order.pk if model == "order" else item.pk
    counts = effects()
    admin_client.force_login(admin_user)
    path = f"/admin/orders/{model}/add/" if action == "add" else f"/admin/orders/{model}/{object_id}/{action}/"
    denied = admin_client.post(path, {"total": "0.01", "quantity": 99, "post": "yes"})
    assert denied.status_code == 403
    assert effects() == counts
    order.refresh_from_db()
    item.refresh_from_db()
    assert order.total == Decimal("170000.00")
    assert item.quantity == 2


def _thread_confirmation(user_id, payload, pid_queue=None):
    close_old_connections()
    try:
        client = APIClient()
        client.force_authenticate(user=User.objects.get(pk=user_id))
        if pid_queue is not None:
            with connection.cursor() as cursor:
                cursor.execute("SELECT pg_backend_pid()")
                pid_queue.put(cursor.fetchone()[0])
        response = confirm(client, payload)
        return response.status_code, response.data
    finally:
        close_old_connections()


@pytest.mark.django_db(transaction=True)
def test_simultaneous_same_confirmation_returns_one_order(quoted_cart, customer_user, product, monkeypatch):
    if connection.vendor != "postgresql":
        pytest.skip("Idempotent checkout races require PostgreSQL row locks.")
    barrier = Barrier(2)
    original = CheckoutSerializer.validate

    def synchronize(self, attrs):
        result = original(self, attrs)
        barrier.wait(timeout=15)
        return result

    monkeypatch.setattr(CheckoutSerializer, "validate", synchronize)
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(_thread_confirmation, customer_user.pk, quoted_cart["payload"]) for _ in range(2)]
        results = [future.result(timeout=30) for future in futures]
    assert sorted(status for status, _ in results) == [200, 201]
    assert results[0][1]["id"] == results[1][1]["id"]
    assert effects() == {"orders": 1, "payments": 1, "shipments": 1, "sales": 1, "notifications": 2}
    product.refresh_from_db()
    assert product.stock == 8


@pytest.mark.django_db(transaction=True)
def test_price_changed_after_request_validation_is_rechecked_under_locks(
    quoted_cart, customer_user, product, monkeypatch,
):
    if connection.vendor != "postgresql":
        pytest.skip("The checkout/catalog race requires PostgreSQL row locks.")
    validated, resume = Event(), Event()
    original = CheckoutSerializer.validate

    def pause(self, attrs):
        result = original(self, attrs)
        validated.set()
        assert resume.wait(timeout=15)
        return result

    monkeypatch.setattr(CheckoutSerializer, "validate", pause)
    with ThreadPoolExecutor(max_workers=1) as pool:
        pending = pool.submit(_thread_confirmation, customer_user.pk, quoted_cart["payload"])
        try:
            assert validated.wait(timeout=15)
            Product.objects.filter(pk=product.pk).update(price=Decimal("95000.00"))
        finally:
            resume.set()
        status, data = pending.result(timeout=30)
    assert status == 409, data
    assert data["code"] == "quote_changed"
    assert_no_purchase(product)


@pytest.mark.django_db(transaction=True)
def test_quote_expiring_while_waiting_for_product_lock_is_not_confirmed(
    quoted_cart, customer_user, product, monkeypatch,
):
    if connection.vendor != "postgresql":
        pytest.skip("Expiry during lock waits requires PostgreSQL row locks.")
    waiting = Event()
    clock = [time()]
    original = checkout_service._products

    def observe_product_lock(items, *, lock=False):
        if lock:
            waiting.set()
        return original(items, lock=lock)

    monkeypatch.setattr(checkout_service, "_products", observe_product_lock)
    monkeypatch.setattr("django.core.signing.time.time", lambda: clock[0])
    with ThreadPoolExecutor(max_workers=1) as pool:
        with transaction.atomic():
            Product.objects.select_for_update().get(pk=product.pk)
            pending = pool.submit(_thread_confirmation, customer_user.pk, quoted_cart["payload"])
            assert waiting.wait(timeout=15)
            clock[0] += 301
        status, data = pending.result(timeout=30)
    assert status == 400, data
    assert data["code"] == "quote_expired"
    assert_no_purchase(product)


@pytest.mark.django_db(transaction=True)
def test_expired_retry_waits_for_an_uncommitted_identical_purchase(
    quoted_cart, customer_user, product, monkeypatch,
):
    if connection.vendor != "postgresql":
        pytest.skip("An in-flight retry must wait for the PostgreSQL cart lock.")
    inserted, release = Event(), Event()
    retry_pid = Queue(maxsize=1)
    clock = [time()]
    original = checkout_service._create_purchase

    def pause_before_commit(**kwargs):
        order = original(**kwargs)
        inserted.set()
        assert release.wait(timeout=20)
        return order

    monkeypatch.setattr(checkout_service, "_create_purchase", pause_before_commit)
    monkeypatch.setattr("django.core.signing.time.time", lambda: clock[0])
    with ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(_thread_confirmation, customer_user.pk, quoted_cart["payload"])
        try:
            assert inserted.wait(timeout=15)
            clock[0] += 301
            retry = pool.submit(_thread_confirmation, customer_user.pk, quoted_cart["payload"], retry_pid)
            pid = retry_pid.get(timeout=10)
            deadline = monotonic() + 10
            observed_lock = False
            while monotonic() < deadline:
                with connection.cursor() as cursor:
                    cursor.execute("SELECT wait_event_type FROM pg_stat_activity WHERE pid = %s", [pid])
                    row = cursor.fetchone()
                if row and row[0] == "Lock":
                    observed_lock = True
                    break
                if retry.done():
                    break
                sleep(0.01)
            assert observed_lock, "The retry must wait for the pending cart confirmation before resolving expiry."
        finally:
            release.set()
        first_status, first_data = first.result(timeout=30)
        retry_status, retry_data = retry.result(timeout=30)
    assert first_status == 201, first_data
    assert retry_status == 200, retry_data
    assert retry_data["id"] == first_data["id"]
    assert effects() == {"orders": 1, "payments": 1, "shipments": 1, "sales": 1, "notifications": 2}
    product.refresh_from_db()
    assert product.stock == 8
