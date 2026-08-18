import pytest

from apps.orders.models import Order
from apps.reviews.models import ProductReview
from apps.shipments.models import Shipment


def create_delivered_order(customer_client, seller_client, product, address):
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

    order = Order.objects.get(id=checkout_response.data["id"])
    shipment = Shipment.objects.get(order=order)

    seller_client.patch(
        f"/api/v1/seller/shipments/{shipment.id}/status/",
        {
            "status": "DELIVERED",
            "carrier": "Logística AgroNexus",
            "description": "Pedido entregado.",
            "location": "Mendoza",
        },
        format="json",
    )

    order.refresh_from_db()
    return order


@pytest.mark.django_db
def test_customer_can_add_product_to_favorites(customer_client, product):
    response = customer_client.post(
        "/api/v1/favorites/add/",
        {
            "product_id": product.id,
        },
        format="json",
    )

    assert response.status_code == 201

    list_response = customer_client.get("/api/v1/favorites/")
    assert list_response.status_code == 200
    assert len(list_response.data) == 1
    assert list_response.data[0]["product_id"] == product.id


@pytest.mark.django_db
def test_adding_same_favorite_does_not_duplicate(customer_client, product):
    customer_client.post(
        "/api/v1/favorites/add/",
        {
            "product_id": product.id,
        },
        format="json",
    )

    customer_client.post(
        "/api/v1/favorites/add/",
        {
            "product_id": product.id,
        },
        format="json",
    )

    response = customer_client.get("/api/v1/favorites/")

    assert response.status_code == 200
    assert len(response.data) == 1


@pytest.mark.django_db
def test_customer_can_create_question_and_seller_can_answer(
    customer_client,
    seller_client,
    product,
):
    question_response = customer_client.post(
        f"/api/v1/products/{product.slug}/questions/",
        {
            "question": "¿Este filtro sirve para maquinaria serie 5000?",
        },
        format="json",
    )

    assert question_response.status_code == 201
    assert question_response.data["status"] == "PENDING"

    question_id = question_response.data["id"]

    answer_response = seller_client.patch(
        f"/api/v1/seller/questions/{question_id}/answer/",
        {
            "answer": "Sí, sirve para esa serie. Recomendamos verificar el código original.",
            "is_public": True,
        },
        format="json",
    )

    assert answer_response.status_code == 200
    assert answer_response.data["status"] == "ANSWERED"

    public_response = customer_client.get(
        f"/api/v1/products/{product.slug}/questions/"
    )

    assert public_response.status_code == 200
    assert len(public_response.data) == 1


@pytest.mark.django_db
def test_customer_can_review_delivered_product(
    customer_client,
    seller_client,
    product,
    address,
):
    order = create_delivered_order(customer_client, seller_client, product, address)
    order_item = order.items.first()

    response = customer_client.post(
        f"/api/v1/products/{product.slug}/reviews/",
        {
            "order_item_id": order_item.id,
            "rating": 5,
            "comment": "Excelente producto, llegó en buen estado.",
        },
        format="json",
    )

    assert response.status_code == 201
    assert ProductReview.objects.filter(product=product, rating=5).exists()

    product.refresh_from_db()
    assert product.average_rating == 5
    assert product.total_reviews == 1


@pytest.mark.django_db
def test_customer_cannot_review_if_order_not_delivered(
    customer_client,
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

    order = Order.objects.get(id=checkout_response.data["id"])
    order_item = order.items.first()

    response = customer_client.post(
        f"/api/v1/products/{product.slug}/reviews/",
        {
            "order_item_id": order_item.id,
            "rating": 5,
            "comment": "Intento de reseña antes de entrega.",
        },
        format="json",
    )

    assert response.status_code == 400