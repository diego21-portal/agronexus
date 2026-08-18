import pytest

from apps.carts.models import Cart
from apps.orders.models import Order
from apps.payments.models import Payment
from apps.products.models import Product, StockMovement
from apps.shipments.models import Shipment


@pytest.mark.django_db
def test_customer_can_add_product_to_cart(customer_client, product):
    response = customer_client.post(
        "/api/v1/cart/items/",
        {
            "product_id": product.id,
            "quantity": 2,
        },
        format="json",
    )

    assert response.status_code == 201
    assert response.data["quantity"] == 2
    assert response.data["product_id"] == product.id


@pytest.mark.django_db
def test_customer_cannot_add_more_than_stock(customer_client, product):
    response = customer_client.post(
        "/api/v1/cart/items/",
        {
            "product_id": product.id,
            "quantity": product.stock + 1,
        },
        format="json",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_customer_can_update_cart_item_quantity(customer_client, product):
    create_response = customer_client.post(
        "/api/v1/cart/items/",
        {
            "product_id": product.id,
            "quantity": 1,
        },
        format="json",
    )

    item_id = create_response.data["id"]

    update_response = customer_client.patch(
        f"/api/v1/cart/items/{item_id}/",
        {
            "quantity": 3,
        },
        format="json",
    )

    assert update_response.status_code == 200
    assert update_response.data["quantity"] == 3


@pytest.mark.django_db
def test_checkout_creates_order_payment_shipment_and_stock_movement(
    customer_client,
    customer_user,
    seller_user,
    product,
    address,
):
    customer_client.post(
        "/api/v1/cart/items/",
        {
            "product_id": product.id,
            "quantity": 2,
        },
        format="json",
    )

    response = customer_client.post(
        "/api/v1/checkout/",
        {
            "address_id": address.id,
            "payment_method": "SIMULATED_CARD",
        },
        format="json",
    )

    assert response.status_code == 201

    order = Order.objects.get(id=response.data["id"])
    product.refresh_from_db()

    assert order.user == customer_user
    assert order.status == Order.Status.PAID
    assert order.items.count() == 1
    assert Payment.objects.filter(order=order, status=Payment.Status.APPROVED).exists()
    assert Shipment.objects.filter(order=order, status=Shipment.Status.CREATED).exists()
    assert product.stock == 8
    assert StockMovement.objects.filter(
        product=product,
        movement_type=StockMovement.MovementType.SALE,
        quantity=-2,
    ).exists()

    old_cart = Cart.objects.get(user=customer_user, status=Cart.Status.ORDERED)
    assert old_cart.items.count() == 1


@pytest.mark.django_db
def test_after_checkout_cart_endpoint_returns_new_active_cart(
    customer_client,
    customer_user,
    product,
    address,
):
    customer_client.post(
        "/api/v1/cart/items/",
        {
            "product_id": product.id,
            "quantity": 1,
        },
        format="json",
    )

    customer_client.post(
        "/api/v1/checkout/",
        {
            "address_id": address.id,
            "payment_method": "SIMULATED_CARD",
        },
        format="json",
    )

    response = customer_client.get("/api/v1/cart/")

    assert response.status_code == 200
    assert response.data["status"] == Cart.Status.ACTIVE
    assert response.data["items_count"] == 0


@pytest.mark.django_db
def test_customer_can_list_only_own_orders(customer_client, second_customer_client, product, address):
    customer_client.post(
        "/api/v1/cart/items/",
        {
            "product_id": product.id,
            "quantity": 1,
        },
        format="json",
    )

    checkout_response = customer_client.post(
        "/api/v1/checkout/",
        {
            "address_id": address.id,
            "payment_method": "SIMULATED_CARD",
        },
        format="json",
    )

    assert checkout_response.status_code == 201

    customer_orders = customer_client.get("/api/v1/orders/")
    other_customer_orders = second_customer_client.get("/api/v1/orders/")

    assert customer_orders.status_code == 200
    assert len(customer_orders.data) == 1

    assert other_customer_orders.status_code == 200
    assert len(other_customer_orders.data) == 0


@pytest.mark.django_db
def test_seller_can_update_shipment_status(
    customer_client,
    seller_client,
    product,
    address,
):
    customer_client.post(
        "/api/v1/cart/items/",
        {
            "product_id": product.id,
            "quantity": 1,
        },
        format="json",
    )

    checkout_response = customer_client.post(
        "/api/v1/checkout/",
        {
            "address_id": address.id,
            "payment_method": "SIMULATED_CARD",
        },
        format="json",
    )

    order_id = checkout_response.data["id"]
    shipment = Shipment.objects.get(order_id=order_id)

    response = seller_client.patch(
        f"/api/v1/seller/shipments/{shipment.id}/status/",
        {
            "status": "DELIVERED",
            "carrier": "Logística AgroNexus",
            "description": "El pedido fue entregado.",
            "location": "Mendoza",
        },
        format="json",
    )

    assert response.status_code == 200

    shipment.refresh_from_db()
    order = Order.objects.get(id=order_id)

    assert shipment.status == Shipment.Status.DELIVERED
    assert order.status == Order.Status.DELIVERED
    assert shipment.events.filter(status=Shipment.Status.DELIVERED).exists()