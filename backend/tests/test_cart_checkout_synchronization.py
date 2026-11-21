"""Cart mutations must respect checkout's parent-cart transaction boundary."""

from concurrent.futures import ThreadPoolExecutor
from queue import Queue
from threading import Barrier, Event, local
from time import monotonic
from types import SimpleNamespace

import pytest
from django.db import close_old_connections, connection
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.carts import services
from apps.carts.models import Cart, CartItem
from apps.carts.serializers import CartItemCreateSerializer, CartItemUpdateSerializer
from apps.orders.models import Order
from apps.products.models import Product, StockMovement
from tests.checkout_helpers import prepare_checkout_payload


pytestmark = pytest.mark.django_db


def add_item(client, product, quantity=1):
    response = client.post(
        "/api/v1/cart/items/", {"product_id": product.pk, "quantity": quantity}, format="json",
    )
    assert response.status_code == 201, response.data
    return CartItem.objects.get(pk=response.data["id"])


@pytest.mark.parametrize("operation", ["add", "update"])
def test_prevalidated_mutation_cannot_rewrite_a_cart_after_checkout(
    customer_client, customer_user, product, address, operation,
):
    item = add_item(customer_client, product)
    context = {"request": SimpleNamespace(user=customer_user)}
    if operation == "add":
        mutation = CartItemCreateSerializer(
            data={"product_id": product.pk, "quantity": 1}, context=context,
        )
    else:
        mutation = CartItemUpdateSerializer(item, data={"quantity": 3}, context=context)
    mutation.is_valid(raise_exception=True)

    payload = prepare_checkout_payload(customer_client, address.pk)
    bought = customer_client.post("/api/v1/checkout/", payload, format="json")
    assert bought.status_code == 201, bought.data

    with pytest.raises(services.CartAlreadyProcessed):
        mutation.save()

    item.refresh_from_db()
    product.refresh_from_db()
    assert item.quantity == 1
    assert item.cart.status == Cart.Status.ORDERED
    assert Order.objects.get(pk=bought.data["id"]).items.get().quantity == 1
    assert product.stock == 9
    assert StockMovement.objects.filter(order_item__order_id=bought.data["id"]).get().quantity == -1


def test_add_revalidates_the_product_after_serializer_validation(customer_user, product):
    cart = Cart.objects.create(user=customer_user)
    mutation = CartItemCreateSerializer(
        data={"product_id": product.pk, "quantity": 1},
        context={"request": SimpleNamespace(user=customer_user)},
    )
    mutation.is_valid(raise_exception=True)
    Product.objects.filter(pk=product.pk).update(is_active=False)

    with pytest.raises(ValidationError):
        mutation.save()

    assert not cart.items.exists()
    product.refresh_from_db()
    assert product.stock == 10


def test_empty_quantity_patch_is_a_controlled_validation_error(customer_client, product):
    item = add_item(customer_client, product)

    response = customer_client.patch(f"/api/v1/cart/items/{item.pk}/", {}, format="json")

    assert response.status_code == 400
    item.refresh_from_db()
    assert item.quantity == 1


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("operations", [("get", "add"), ("add", "add")])
def test_concurrent_cart_creation_uses_one_active_cart(customer_user, product, operations):
    if connection.vendor != "postgresql":
        pytest.skip("La selección concurrente del carrito se verifica con PostgreSQL.")
    barrier = Barrier(2)

    def call(operation):
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(customer_user)
            barrier.wait(timeout=15)
            if operation == "get":
                response = client.get("/api/v1/cart/")
            else:
                response = client.post(
                    "/api/v1/cart/items/", {"product_id": product.pk, "quantity": 1}, format="json",
                )
            return operation, response.status_code
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(call, operations))

    assert all(status == (200 if operation == "get" else 201) for operation, status in results)
    cart = Cart.objects.get(user=customer_user, status=Cart.Status.ACTIVE)
    assert cart.items.get().quantity == operations.count("add")
    product.refresh_from_db()
    assert product.stock == 10  # Adding to a cart does not reserve inventory.


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("operation", ["delete", "clear"])
def test_checkout_waits_for_the_parent_cart_before_confirming_a_concurrent_removal(
    customer_client, customer_user, product, address, monkeypatch, operation,
):
    if connection.vendor != "postgresql":
        pytest.skip("Los bloqueos del carrito se verifican con PostgreSQL.")
    item = add_item(customer_client, product)
    payload = prepare_checkout_payload(customer_client, address.pk)
    entered = Event()
    release = Event()
    role = local()
    backend_pids = Queue()
    original_lock = services._locked_cart

    def pause_mutation(*args, **kwargs):
        cart = original_lock(*args, **kwargs)
        if getattr(role, "pause", False):
            entered.set()
            assert release.wait(timeout=20), "La prueba no liberó la mutación del carrito."
        return cart

    monkeypatch.setattr(services, "_locked_cart", pause_mutation)

    def mutate():
        close_old_connections()
        try:
            role.pause = True
            client = APIClient()
            client.force_authenticate(customer_user)
            path = f"/api/v1/cart/items/{item.pk}/delete/" if operation == "delete" else "/api/v1/cart/clear/"
            return client.delete(path).status_code
        finally:
            close_old_connections()

    def confirm():
        close_old_connections()
        try:
            connection.ensure_connection()
            backend_pids.put(connection.connection.info.backend_pid)
            client = APIClient()
            client.force_authenticate(customer_user)
            return client.post("/api/v1/checkout/", payload, format="json").status_code
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        mutation = executor.submit(mutate)
        try:
            assert entered.wait(timeout=15)
            checkout = executor.submit(confirm)
            pid = backend_pids.get(timeout=15)
            deadline = monotonic() + 10
            with connection.cursor() as cursor:
                while monotonic() < deadline:
                    assert not checkout.done(), "Checkout confirmó mientras la eliminación seguía pendiente."
                    cursor.execute("SELECT wait_event_type FROM pg_stat_activity WHERE pid = %s", [pid])
                    state = cursor.fetchone()
                    if state and state[0] == "Lock":
                        break
                    Event().wait(0.02)
                else:
                    pytest.fail("Checkout no esperó el bloqueo del carrito.")
        finally:
            release.set()
        assert mutation.result(timeout=15) == (204 if operation == "delete" else 200)
        assert checkout.result(timeout=15) in {400, 409}

    assert not Order.objects.filter(user=customer_user).exists()
    assert not item.cart.items.exists()
    product.refresh_from_db()
    assert product.stock == 10
