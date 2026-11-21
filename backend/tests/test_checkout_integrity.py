from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from types import SimpleNamespace
from uuid import uuid4

import pytest
from django.db import close_old_connections, connection
from rest_framework.exceptions import APIException
from rest_framework.test import APIClient

from apps.carts.models import Cart
from apps.orders.models import Order
from apps.orders.serializers import CheckoutSerializer
from apps.payments.models import Payment
from apps.products.models import Product, StockMovement
from apps.shipments.models import Shipment
from apps.users.models import Address, User
from tests.checkout_helpers import prepare_checkout_payload


pytestmark = pytest.mark.django_db


def prepare_checkout(client, user, product, address):
    response = client.post(
        "/api/v1/cart/items/",
        {"product_id": product.pk, "quantity": 1},
        format="json",
    )
    assert response.status_code == 201

    checkout = CheckoutSerializer(
        data=prepare_checkout_payload(client, address.pk),
        context={"request": SimpleNamespace(user=user)},
    )
    checkout.is_valid(raise_exception=True)
    return checkout


def assert_purchase_was_not_created(product):
    product.refresh_from_db()
    assert product.stock == 10
    assert not Order.objects.exists()
    assert not Payment.objects.exists()
    assert not Shipment.objects.exists()
    assert not StockMovement.objects.filter(
        movement_type=StockMovement.MovementType.SALE,
    ).exists()


def test_prevalidated_checkout_cannot_reuse_processed_cart(
    customer_client, customer_user, product, address,
):
    first = prepare_checkout(customer_client, customer_user, product, address)
    second = CheckoutSerializer(
        data={**first.initial_data, "idempotency_key": str(uuid4())},
        context={"request": SimpleNamespace(user=customer_user)},
    )
    second.is_valid(raise_exception=True)

    order = first.save()

    with pytest.raises(APIException) as error:
        second.save()

    assert error.value.status_code == 409
    assert error.value.detail["code"] == "quote_changed"
    assert Order.objects.count() == 1
    assert Payment.objects.filter(order=order).count() == 1
    assert Shipment.objects.filter(order=order).count() == 1
    assert StockMovement.objects.filter(
        movement_type=StockMovement.MovementType.SALE,
    ).count() == 1
    product.refresh_from_db()
    assert product.stock == 9


@pytest.mark.parametrize("change", ["inactive", "archived"])
def test_checkout_rechecks_product_availability_after_validation(
    customer_client, customer_user, product, address, change,
):
    checkout = prepare_checkout(customer_client, customer_user, product, address)

    if change == "inactive":
        Product.objects.filter(pk=product.pk).update(is_active=False)
    else:
        Product.objects.filter(pk=product.pk).update(status=Product.Status.ARCHIVED)

    with pytest.raises(APIException) as error:
        checkout.save()

    assert error.value.status_code == 409
    assert error.value.detail["code"] == "quote_changed"
    assert_purchase_was_not_created(product)


def test_checkout_rejects_cart_emptied_after_validation(
    customer_client, customer_user, product, address,
):
    checkout = prepare_checkout(customer_client, customer_user, product, address)
    Cart.objects.get(user=customer_user, status=Cart.Status.ACTIVE).items.all().delete()

    with pytest.raises(APIException) as error:
        checkout.save()

    assert error.value.status_code == 409
    assert error.value.detail["code"] == "quote_changed"
    assert_purchase_was_not_created(product)


def test_checkout_rechecks_address_after_validation(
    customer_client, customer_user, product, address,
):
    checkout = prepare_checkout(customer_client, customer_user, product, address)
    Address.objects.filter(pk=address.pk).update(is_active=False)

    with pytest.raises(APIException) as error:
        checkout.save()

    assert error.value.status_code == 409
    assert error.value.detail["code"] == "quote_changed"
    assert_purchase_was_not_created(product)


@pytest.mark.parametrize("disabled_account", ["seller_profile", "seller_user"])
def test_checkout_rechecks_seller_after_validation(
    customer_client, customer_user, product, address, disabled_account,
):
    checkout = prepare_checkout(customer_client, customer_user, product, address)

    account = (
        product.seller
        if disabled_account == "seller_profile"
        else product.seller.user
    )
    account.is_active = False
    account.save(update_fields=["is_active"])

    with pytest.raises(APIException) as error:
        checkout.save()

    assert error.value.status_code == 409
    assert error.value.detail["code"] == "quote_changed"
    assert_purchase_was_not_created(product)


def submit_checkouts_concurrently(monkeypatch, buyers):
    """Both requests must finish validation before either starts creating an order."""
    barrier = Barrier(len(buyers))
    original_validate = CheckoutSerializer.validate

    def synchronized_validate(self, attrs):
        data = original_validate(self, attrs)
        barrier.wait(timeout=10)
        return data

    monkeypatch.setattr(CheckoutSerializer, "validate", synchronized_validate)

    def submit(buyer):
        user_id, payload = buyer
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(user=User.objects.get(pk=user_id))
            response = client.post(
                "/api/v1/checkout/",
                payload,
                format="json",
            )
            return response.status_code
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=len(buyers)) as executor:
        return list(executor.map(submit, buyers))


@pytest.mark.django_db(transaction=True)
def test_concurrent_requests_create_only_one_order_for_the_same_cart(
    customer_client, customer_user, product, address, monkeypatch,
):
    if connection.vendor != "postgresql":
        pytest.skip("La concurrencia del checkout se comprueba con PostgreSQL.")

    first = prepare_checkout(customer_client, customer_user, product, address)
    buyer = (customer_user.pk, first.initial_data)
    other = (customer_user.pk, {**first.initial_data, "idempotency_key": str(uuid4())})

    statuses = submit_checkouts_concurrently(monkeypatch, [buyer, other])

    assert sorted(statuses) == [201, 409]
    assert Order.objects.filter(user=customer_user).count() == 1
    assert Payment.objects.count() == 1
    assert Shipment.objects.count() == 1
    product.refresh_from_db()
    assert product.stock == 9
    assert Cart.objects.filter(user=customer_user, status=Cart.Status.ORDERED).count() == 1
    assert StockMovement.objects.filter(
        product=product,
        movement_type=StockMovement.MovementType.SALE,
    ).count() == 1


@pytest.mark.django_db(transaction=True)
def test_concurrent_buyers_cannot_purchase_the_same_last_unit(
    customer_client, customer_user, second_customer_client, second_customer_user,
    product, address, monkeypatch,
):
    if connection.vendor != "postgresql":
        pytest.skip("La concurrencia del checkout se comprueba con PostgreSQL.")

    product.stock = 1
    product.save(update_fields=["stock"])
    other_address = Address.objects.create(
        user=second_customer_user,
        region=address.region,
        street="Belgrano",
        number="456",
        city="Mendoza",
        province="Mendoza",
    )
    first = prepare_checkout(customer_client, customer_user, product, address)
    second = prepare_checkout(second_customer_client, second_customer_user, product, other_address)

    statuses = submit_checkouts_concurrently(
        monkeypatch,
        [(customer_user.pk, first.initial_data), (second_customer_user.pk, second.initial_data)],
    )

    assert sorted(statuses) == [201, 409]
    assert Order.objects.count() == 1
    assert Payment.objects.count() == 1
    assert Shipment.objects.count() == 1
    product.refresh_from_db()
    assert product.stock == 0
    assert product.status == Product.Status.OUT_OF_STOCK
    assert StockMovement.objects.filter(
        product=product,
        movement_type=StockMovement.MovementType.SALE,
    ).count() == 1
