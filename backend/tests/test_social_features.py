import pytest

from tests.checkout_helpers import checkout_with_quote

from apps.orders.models import Order
from apps.notifications.models import Notification
from apps.questions.models import ProductQuestion
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

    checkout_response = checkout_with_quote(customer_client, {
            "address_id": address.id,
            "payment_method": "SIMULATED_CARD",
        })

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
    notification = Notification.objects.get(
        notification_type=Notification.NotificationType.QUESTION_CREATED,
        related_object_id=question_id,
    )
    assert notification.action_url == "/seller/questions"

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
    assert answer_response.data["answered_by_name"] == "Vendedor Demo"

    public_response = customer_client.get(
        f"/api/v1/products/{product.slug}/questions/"
    )

    assert public_response.status_code == 200
    assert len(public_response.data) == 1
    assert public_response.data[0]["answered_by_name"] == "Vendedor Demo"


@pytest.mark.django_db
@pytest.mark.parametrize("payload", [{}, {"is_public": False}])
def test_answer_action_requires_text_even_for_partial_updates(
    customer_client, seller_client, product, payload,
):
    created = customer_client.post(
        f"/api/v1/products/{product.slug}/questions/",
        {"question": "¿Este filtro sirve para mi maquinaria?"},
        format="json",
    )
    assert created.status_code == 201
    question = ProductQuestion.objects.get(pk=created.data["id"])
    before = {
        "answer": question.answer,
        "status": question.status,
        "is_public": question.is_public,
        "answered_by_id": question.answered_by_id,
        "answered_at": question.answered_at,
        "updated_at": question.updated_at,
    }

    response = seller_client.patch(
        f"/api/v1/seller/questions/{question.pk}/answer/", payload, format="json",
    )

    assert response.status_code == 400
    assert "answer" in response.data
    question.refresh_from_db()
    assert {field: getattr(question, field) for field in before} == before
    assert not Notification.objects.filter(
        notification_type=Notification.NotificationType.QUESTION_ANSWERED,
        related_object_id=question.pk,
    ).exists()


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

    checkout_response = checkout_with_quote(customer_client, {
            "address_id": address.id,
            "payment_method": "SIMULATED_CARD",
        })

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
