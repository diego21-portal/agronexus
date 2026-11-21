"""Regressions for independent fulfillment of a marketplace purchase."""

from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Barrier, Event
from types import SimpleNamespace

import pytest

from tests.checkout_helpers import checkout_with_quote
from django.db import IntegrityError, close_old_connections, connection, transaction
from rest_framework import serializers
from rest_framework.test import APIClient

from apps.complaints.models import ReturnRequest
from apps.notifications.models import Notification
from apps.orders.models import Order
from apps.payments.models import Payment
from apps.products.models import Product, StockMovement
from apps.reviews.models import ProductReview
from apps.sellers.models import SellerProfile
from apps.shipments.models import Shipment
from apps.shipments.serializers import ShipmentStatusUpdateSerializer
from apps.users.models import User


pytestmark = pytest.mark.django_db


@pytest.fixture
def other_seller(seller_profile):
    user = User.objects.create_user(
        email="segundo-envio@example.test",
        username="segundo-envio",
        role=User.Role.SELLER,
    )
    profile = SellerProfile.objects.create(
        user=user,
        business_name="Segundo vendedor de la compra",
        tax_id="SHIPMENT-SECOND",
        is_active=True,
        is_verified=True,
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return SimpleNamespace(user=user, profile=profile, client=client)


@pytest.fixture
def other_product(product, other_seller):
    return Product.objects.create(
        seller=other_seller.profile,
        category=product.category,
        brand=product.brand,
        region=product.region,
        name="Bomba del segundo vendedor",
        sku="SHIPMENT-SECOND-PRODUCT",
        description="Producto de un segundo vendedor en la misma compra.",
        price="12500.00",
        stock=10,
        status=Product.Status.PUBLISHED,
        is_active=True,
    )


@pytest.fixture
def purchase_factory(customer_client, address):
    def purchase(*products):
        for product in products:
            added = customer_client.post(
                "/api/v1/cart/items/",
                {"product_id": product.pk, "quantity": 1},
                format="json",
            )
            assert added.status_code == 201, added.data
        response = checkout_with_quote(customer_client, {"address_id": address.pk, "payment_method": "SIMULATED_CARD"})
        assert response.status_code == 201, response.data
        return SimpleNamespace(
            order=Order.objects.get(pk=response.data["id"]),
            response=response,
            products=products,
        )

    return purchase


@pytest.fixture
def shared_purchase(purchase_factory, product, other_product):
    return purchase_factory(product, other_product)


@pytest.fixture
def single_purchase(purchase_factory, product):
    return purchase_factory(product)


def seller_shipment(purchase, profile):
    # Follow the tracking code exposed to this seller. This also exercises the
    # old shared-shipment implementation when demonstrating the regression.
    client = APIClient()
    client.force_authenticate(user=profile.user)
    response = client.get(f"/api/v1/seller/orders/{purchase.order.pk}/")
    assert response.status_code == 200, response.data
    return Shipment.objects.get(
        order=purchase.order, tracking_code=response.data["tracking_code"],
    )


def patch_shipment(client, shipment, status=None, **fields):
    if status is not None:
        fields["status"] = status
    return client.patch(
        f"/api/v1/seller/shipments/{shipment.pk}/status/", fields, format="json",
    )


def shipment_notifications(order):
    return Notification.objects.filter(
        user=order.user,
        notification_type=Notification.NotificationType.SHIPMENT_UPDATED,
    )


def test_checkout_groups_products_by_seller_without_splitting_the_payment(
    purchase_factory, product, other_product,
):
    sibling = Product.objects.create(
        seller=product.seller,
        category=product.category,
        region=product.region,
        name="Otro producto del primer vendedor",
        sku="SHIPMENT-SAME-SELLER",
        description="Producto adicional del mismo vendedor.",
        price="200.00",
        stock=10,
        status=Product.Status.PUBLISHED,
        is_active=True,
    )
    purchase = purchase_factory(product, sibling, other_product)
    data = purchase.response.data

    assert "shipments" in data, "La compra debe exponer sus envíos por vendedor."
    assert len(data["shipments"]) == 2
    assert data["shipment"] is None
    assert purchase.order.shipment is None
    assert {shipment.seller_id for shipment in purchase.order.shipments.all()} == {
        product.seller_id, other_product.seller_id,
    }
    assert len({shipment["tracking_code"] for shipment in data["shipments"]}) == 2
    assert Payment.objects.filter(order=purchase.order).count() == 1
    assert purchase.order.payment.amount == Decimal("97700.00")
    assert purchase.order.items.count() == 3
    assert StockMovement.objects.filter(
        product__in=[product, sibling, other_product],
        movement_type=StockMovement.MovementType.SALE,
    ).count() == 3
    for bought_product in [product, sibling, other_product]:
        bought_product.refresh_from_db()
        assert bought_product.stock == 9


def test_single_seller_purchase_preserves_the_single_shipment_contract(single_purchase):
    shipment = Shipment.objects.get(order=single_purchase.order)
    data = single_purchase.response.data

    assert "shipments" in data
    assert len(data["shipments"]) == 1
    assert data["shipment"]["id"] == shipment.pk
    assert data["shipments"][0]["id"] == shipment.pk
    assert single_purchase.order.shipment.pk == shipment.pk


def test_database_rejects_a_second_shipment_for_the_same_order_and_seller(single_purchase):
    shipment = Shipment.objects.get(order=single_purchase.order)

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            Shipment.objects.create(order=single_purchase.order, seller=shipment.seller)

    assert Shipment.objects.filter(order=single_purchase.order).count() == 1


def test_customer_sees_each_sellers_tracking_and_unmixed_events(
    shared_purchase, seller_profile, other_seller, customer_client,
):
    first = seller_shipment(shared_purchase, seller_profile)
    second = seller_shipment(shared_purchase, other_seller.profile)
    first.events.create(status=first.status, description="Evento exclusivo del vendedor A")
    second.events.create(status=second.status, description="Evento exclusivo del vendedor B")
    order = shared_purchase.order

    for path in [f"/api/v1/orders/{order.pk}/", f"/api/v1/orders/{order.pk}/tracking/"]:
        response = customer_client.get(path)
        assert response.status_code == 200, response.data
        assert response.data["shipment"] is None
        by_id = {shipment["id"]: shipment for shipment in response.data["shipments"]}
        assert set(by_id) == {first.pk, second.pk}
        first_descriptions = {event["description"] for event in by_id[first.pk]["events"]}
        second_descriptions = {event["description"] for event in by_id[second.pk]["events"]}
        assert "Evento exclusivo del vendedor A" in first_descriptions
        assert "Evento exclusivo del vendedor B" not in first_descriptions
        assert "Evento exclusivo del vendedor B" in second_descriptions
        assert "Evento exclusivo del vendedor A" not in second_descriptions

    tracking = customer_client.get(f"/api/v1/orders/{order.pk}/tracking/").data
    assert tracking["order_id"] == order.pk
    assert tracking["order_number"] == order.order_number
    assert tracking["order_status"] == Order.Status.PAID


@pytest.mark.parametrize("missing", [False, True])
def test_foreign_and_missing_order_tracking_return_404(
    shared_purchase, second_customer_client, missing,
):
    order_pk = shared_purchase.order.pk + 10000 if missing else shared_purchase.order.pk
    response = second_customer_client.get(f"/api/v1/orders/{order_pk}/tracking/")
    assert response.status_code == 404


def test_seller_detail_returns_only_own_items_and_shipment(
    shared_purchase, seller_client, seller_profile, other_seller,
):
    own = seller_shipment(shared_purchase, seller_profile)
    foreign = seller_shipment(shared_purchase, other_seller.profile)
    own_item = shared_purchase.order.items.get(seller=seller_profile)

    response = seller_client.get(f"/api/v1/seller/orders/{shared_purchase.order.pk}/")

    assert response.status_code == 200, response.data
    assert {item["id"] for item in response.data["items"]} == {own_item.pk}
    assert response.data["seller_subtotal"] == "85000.00"
    assert response.data["status"] == Order.Status.PAID
    assert response.data["order_status"] == Order.Status.PAID
    assert response.data["shipment"]["id"] == own.pk
    assert foreign.tracking_code not in response.content.decode()


@pytest.mark.parametrize("first_seller", ["original", "other"])
def test_order_is_delivered_only_after_every_sellers_shipment_is_delivered(
    shared_purchase, seller_client, seller_profile, other_seller, first_seller,
):
    pairs = [(seller_client, seller_profile), (other_seller.client, other_seller.profile)]
    if first_seller == "other":
        pairs.reverse()
    first_client, first_profile = pairs[0]
    second_client, second_profile = pairs[1]
    first = seller_shipment(shared_purchase, first_profile)
    second = seller_shipment(shared_purchase, second_profile)
    second_event_count = second.events.count()

    response = patch_shipment(first_client, first, Shipment.Status.DELIVERED)

    assert response.status_code == 200, response.data
    shared_purchase.order.refresh_from_db()
    second.refresh_from_db()
    assert shared_purchase.order.status == Order.Status.PREPARING
    assert second.status == Shipment.Status.CREATED
    assert second.delivered_at is None
    assert second.events.count() == second_event_count
    assert shipment_notifications(shared_purchase.order).count() == 1

    local = first_client.get(f"/api/v1/seller/orders/{shared_purchase.order.pk}/")
    assert local.data["status"] == Order.Status.DELIVERED
    assert local.data["order_status"] == Order.Status.PREPARING

    response = patch_shipment(second_client, second, Shipment.Status.DELIVERED)
    assert response.status_code == 200, response.data
    shared_purchase.order.refresh_from_db()
    assert shared_purchase.order.status == Order.Status.DELIVERED
    assert shipment_notifications(shared_purchase.order).count() == 2


def test_global_shipping_progress_waits_for_the_slowest_seller(
    shared_purchase, seller_client, seller_profile, other_seller,
):
    first = seller_shipment(shared_purchase, seller_profile)
    second = seller_shipment(shared_purchase, other_seller.profile)

    assert patch_shipment(seller_client, first, Shipment.Status.DISPATCHED).status_code == 200
    shared_purchase.order.refresh_from_db()
    assert shared_purchase.order.status == Order.Status.PREPARING

    assert patch_shipment(other_seller.client, second, Shipment.Status.DISPATCHED).status_code == 200
    shared_purchase.order.refresh_from_db()
    assert shared_purchase.order.status == Order.Status.SHIPPED

    assert patch_shipment(seller_client, first, Shipment.Status.DELIVERED).status_code == 200
    shared_purchase.order.refresh_from_db()
    assert shared_purchase.order.status == Order.Status.SHIPPED

    assert patch_shipment(other_seller.client, second, Shipment.Status.DELIVERED).status_code == 200
    shared_purchase.order.refresh_from_db()
    assert shared_purchase.order.status == Order.Status.DELIVERED


def test_seller_dashboards_use_own_progress_and_keep_paid_sales_during_another_sellers_incident(
    shared_purchase, seller_client, seller_profile, other_seller,
):
    first = seller_shipment(shared_purchase, seller_profile)
    second = seller_shipment(shared_purchase, other_seller.profile)
    assert patch_shipment(seller_client, first, Shipment.Status.DELIVERED).status_code == 200

    own = seller_client.get("/api/v1/seller/dashboard/")
    other = other_seller.client.get("/api/v1/seller/dashboard/")
    assert own.status_code == other.status_code == 200
    assert own.data["orders"]["delivered_orders"] == 1
    assert own.data["orders"]["paid_orders"] == 0
    assert other.data["orders"]["delivered_orders"] == 0
    assert other.data["orders"]["paid_orders"] == 1
    assert own.data["recent_orders"][0]["status"] == Order.Status.DELIVERED
    assert other.data["recent_orders"][0]["status"] == Order.Status.PAID
    assert own.data["recent_orders"][0]["tracking_code"] == first.tracking_code
    assert other.data["recent_orders"][0]["tracking_code"] == second.tracking_code
    first_revenue = Decimal(str(own.data["sales"]["total_revenue"]))
    second_revenue = Decimal(str(other.data["sales"]["total_revenue"]))
    assert first_revenue == Decimal("85000.00")
    assert second_revenue == Decimal("12500.00")

    assert patch_shipment(
        other_seller.client, second, Shipment.Status.DELIVERY_PROBLEM,
    ).status_code == 200
    shared_purchase.order.refresh_from_db()
    assert shared_purchase.order.status == Order.Status.PROBLEM

    own = seller_client.get("/api/v1/seller/dashboard/")
    other = other_seller.client.get("/api/v1/seller/dashboard/")
    assert own.data["orders"]["delivered_orders"] == 1
    assert own.data["orders"]["problem_orders"] == 0
    assert other.data["orders"]["problem_orders"] == 1
    assert own.data["recent_orders"][0]["status"] == Order.Status.DELIVERED
    assert own.data["recent_orders"][0]["order_status"] == Order.Status.PROBLEM
    assert Decimal(str(own.data["sales"]["total_revenue"])) == first_revenue
    assert Decimal(str(other.data["sales"]["total_revenue"])) == second_revenue


def test_seller_cannot_write_another_sellers_shipment_in_the_same_order(
    shared_purchase, seller_client, other_seller,
):
    foreign = seller_shipment(shared_purchase, other_seller.profile)
    before = foreign.events.count()

    response = patch_shipment(seller_client, foreign, Shipment.Status.DELIVERED)

    assert response.status_code == 404
    foreign.refresh_from_db()
    shared_purchase.order.refresh_from_db()
    assert foreign.status == Shipment.Status.CREATED
    assert foreign.delivered_at is None
    assert foreign.events.count() == before
    assert shared_purchase.order.status == Order.Status.PAID
    assert not shipment_notifications(shared_purchase.order).exists()


@pytest.mark.parametrize("endpoint", ["shipment", "order"])
def test_delivered_part_cannot_be_reopened_while_the_other_seller_is_pending(
    shared_purchase, seller_client, seller_profile, endpoint,
):
    own = seller_shipment(shared_purchase, seller_profile)
    assert patch_shipment(seller_client, own, Shipment.Status.DELIVERED).status_code == 200
    shared_purchase.order.refresh_from_db()
    assert shared_purchase.order.status == Order.Status.PREPARING
    before = own.events.count()
    path = (
        f"/api/v1/seller/shipments/{own.pk}/status/" if endpoint == "shipment"
        else f"/api/v1/seller/orders/{shared_purchase.order.pk}/status/"
    )

    response = seller_client.patch(path, {"status": "PREPARING"}, format="json")

    assert response.status_code == 400
    own.refresh_from_db()
    shared_purchase.order.refresh_from_db()
    assert own.status == Shipment.Status.DELIVERED
    assert own.events.count() == before
    assert shared_purchase.order.status == Order.Status.PREPARING


@pytest.mark.parametrize(
    ("order_status", "shipment_status"),
    [
        (Order.Status.PREPARING, Shipment.Status.PREPARING),
        (Order.Status.SHIPPED, Shipment.Status.DISPATCHED),
        (Order.Status.PROBLEM, Shipment.Status.DELIVERY_PROBLEM),
    ],
)
def test_alternative_order_status_endpoint_updates_only_the_sellers_fulfillment(
    shared_purchase, seller_client, seller_profile, other_seller,
    order_status, shipment_status,
):
    own = seller_shipment(shared_purchase, seller_profile)
    foreign = seller_shipment(shared_purchase, other_seller.profile)
    foreign_events = foreign.events.count()
    response = seller_client.patch(
        f"/api/v1/seller/orders/{shared_purchase.order.pk}/status/",
        {"status": order_status}, format="json",
    )

    assert response.status_code == 200, response.data
    own.refresh_from_db()
    foreign.refresh_from_db()
    shared_purchase.order.refresh_from_db()
    assert own.status == shipment_status
    assert foreign.status == Shipment.Status.CREATED
    assert foreign.events.count() == foreign_events
    assert own.events.filter(status=shipment_status).count() == 1
    assert shared_purchase.order.status == (
        Order.Status.PROBLEM if order_status == Order.Status.PROBLEM else Order.Status.PREPARING
    )
    assert shipment_notifications(shared_purchase.order).count() == 1


def test_order_status_update_without_status_returns_validation_error(single_purchase, seller_client):
    shipment = Shipment.objects.get(order=single_purchase.order)
    before = shipment.events.count()

    response = seller_client.patch(
        f"/api/v1/seller/orders/{single_purchase.order.pk}/status/", {}, format="json",
    )

    assert response.status_code == 400
    assert "status" in response.data
    single_purchase.order.refresh_from_db()
    shipment.refresh_from_db()
    assert single_purchase.order.status == Order.Status.PAID
    assert shipment.status == Shipment.Status.CREATED
    assert shipment.events.count() == before
    assert not shipment_notifications(single_purchase.order).exists()


@pytest.mark.parametrize("endpoint", ["shipment", "order"])
def test_cancellation_is_rejected_without_changing_inventory_or_payment(
    single_purchase, seller_client, endpoint,
):
    order = single_purchase.order
    shipment = Shipment.objects.get(order=order)
    event_count = shipment.events.count()
    product = single_purchase.products[0]
    product.refresh_from_db()
    stock = product.stock
    path = (
        f"/api/v1/seller/shipments/{shipment.pk}/status/" if endpoint == "shipment"
        else f"/api/v1/seller/orders/{order.pk}/status/"
    )

    response = seller_client.patch(path, {"status": "CANCELLED"}, format="json")

    assert response.status_code == 400
    order.refresh_from_db()
    shipment.refresh_from_db()
    product.refresh_from_db()
    assert order.status == Order.Status.PAID
    assert shipment.status == Shipment.Status.CREATED
    assert order.payment.status == Payment.Status.APPROVED
    assert product.stock == stock
    assert shipment.events.count() == event_count
    assert not shipment_notifications(order).exists()


@pytest.mark.parametrize(
    ("initial", "backward"),
    [
        (Shipment.Status.IN_TRANSIT, Shipment.Status.PREPARING),
        (Shipment.Status.OUT_FOR_DELIVERY, Shipment.Status.DISPATCHED),
        (Shipment.Status.DELIVERY_PROBLEM, Shipment.Status.CREATED),
    ],
)
def test_shipment_cannot_move_backwards(single_purchase, seller_client, initial, backward):
    shipment = Shipment.objects.get(order=single_purchase.order)
    forward = patch_shipment(seller_client, shipment, initial)
    assert forward.status_code == 200, forward.data
    event_count = shipment.events.count()
    notification_count = shipment_notifications(single_purchase.order).count()

    response = patch_shipment(seller_client, shipment, backward)

    assert response.status_code == 400
    shipment.refresh_from_db()
    assert shipment.status == initial
    assert shipment.events.count() == event_count
    assert shipment_notifications(single_purchase.order).count() == notification_count


def test_order_status_endpoint_cannot_move_shipping_progress_backwards(
    single_purchase, seller_client,
):
    shipment = Shipment.objects.get(order=single_purchase.order)
    assert patch_shipment(seller_client, shipment, Shipment.Status.IN_TRANSIT).status_code == 200
    before = shipment.events.count()

    response = seller_client.patch(
        f"/api/v1/seller/orders/{single_purchase.order.pk}/status/",
        {"status": Order.Status.PREPARING}, format="json",
    )

    assert response.status_code == 400
    shipment.refresh_from_db()
    assert shipment.status == Shipment.Status.IN_TRANSIT
    assert shipment.events.count() == before


@pytest.mark.parametrize(
    "payload",
    [
        {"status": Shipment.Status.PREPARING},
        {"carrier": "Transportista posterior a la entrega"},
        {"estimated_delivery_date": "2030-01-01"},
        {},
    ],
)
def test_delivered_shipment_rejects_status_and_metadata_updates(
    single_purchase, seller_client, payload,
):
    shipment = Shipment.objects.get(order=single_purchase.order)
    delivered = patch_shipment(seller_client, shipment, Shipment.Status.DELIVERED)
    assert delivered.status_code == 200, delivered.data
    shipment.refresh_from_db()
    original = (shipment.status, shipment.carrier, shipment.estimated_delivery_date, shipment.delivered_at)
    event_count = shipment.events.count()
    notification_count = shipment_notifications(single_purchase.order).count()

    response = seller_client.patch(
        f"/api/v1/seller/shipments/{shipment.pk}/status/", payload, format="json",
    )

    assert response.status_code == 400
    shipment.refresh_from_db()
    assert (shipment.status, shipment.carrier, shipment.estimated_delivery_date, shipment.delivered_at) == original
    assert shipment.events.count() == event_count
    assert shipment_notifications(single_purchase.order).count() == notification_count


@pytest.mark.parametrize("terminal_order_status", [Order.Status.CANCELLED, Order.Status.DELIVERED])
@pytest.mark.parametrize("endpoint", ["shipment", "order"])
def test_terminal_order_blocks_updates_even_if_its_shipment_was_left_open(
    single_purchase, seller_client, terminal_order_status, endpoint,
):
    order = single_purchase.order
    shipment = Shipment.objects.get(order=order)
    Order.objects.filter(pk=order.pk).update(status=terminal_order_status)
    path = (
        f"/api/v1/seller/shipments/{shipment.pk}/status/" if endpoint == "shipment"
        else f"/api/v1/seller/orders/{order.pk}/status/"
    )
    before = shipment.events.count()

    response = seller_client.patch(path, {"status": "PREPARING"}, format="json")

    assert response.status_code == 400
    shipment.refresh_from_db()
    order.refresh_from_db()
    assert shipment.status == Shipment.Status.CREATED
    assert order.status == terminal_order_status
    assert shipment.events.count() == before


def test_repeating_active_status_does_not_duplicate_events_or_notifications(
    single_purchase, seller_client,
):
    shipment = Shipment.objects.get(order=single_purchase.order)
    first = patch_shipment(seller_client, shipment, Shipment.Status.PREPARING)
    assert first.status_code == 200, first.data
    first_events = shipment.events.count()
    first_notifications = shipment_notifications(single_purchase.order).count()

    second = patch_shipment(seller_client, shipment, Shipment.Status.PREPARING)

    assert second.status_code == 200, second.data
    assert shipment.events.count() == first_events
    assert shipment_notifications(single_purchase.order).count() == first_notifications


def test_prevalidated_update_rechecks_a_shipment_delivered_by_another_request(
    single_purchase, seller_client, seller_user,
):
    shipment = Shipment.objects.get(order=single_purchase.order)
    stale = ShipmentStatusUpdateSerializer(
        instance=shipment,
        data={"status": Shipment.Status.PREPARING},
        partial=True,
        context={"request": SimpleNamespace(user=seller_user)},
    )
    stale.is_valid(raise_exception=True)
    delivered = patch_shipment(seller_client, shipment, Shipment.Status.DELIVERED)
    assert delivered.status_code == 200, delivered.data
    event_count = shipment.events.count()

    with pytest.raises(serializers.ValidationError):
        stale.save()

    shipment.refresh_from_db()
    assert shipment.status == Shipment.Status.DELIVERED
    assert shipment.events.count() == event_count


def test_customer_can_review_only_the_delivered_part_of_a_shared_purchase(
    shared_purchase, seller_client, seller_profile, other_seller, customer_client,
):
    own = seller_shipment(shared_purchase, seller_profile)
    assert patch_shipment(seller_client, own, Shipment.Status.DELIVERED).status_code == 200
    shared_purchase.order.refresh_from_db()
    assert shared_purchase.order.status != Order.Status.DELIVERED

    for profile, expected_status in [(seller_profile, 201), (other_seller.profile, 400)]:
        item = shared_purchase.order.items.get(seller=profile)
        response = customer_client.post(
            f"/api/v1/products/{item.product.slug}/reviews/",
            {"order_item_id": item.pk, "rating": 5, "comment": "Reseña tras recibir este producto."},
            format="json",
        )
        assert response.status_code == expected_status, response.data
        assert ProductReview.objects.filter(order_item=item).exists() == (expected_status == 201)


def test_customer_can_return_only_the_delivered_part_of_a_shared_purchase(
    shared_purchase, seller_client, seller_profile, other_seller, customer_client,
):
    own = seller_shipment(shared_purchase, seller_profile)
    assert patch_shipment(seller_client, own, Shipment.Status.DELIVERED).status_code == 200
    shared_purchase.order.refresh_from_db()
    assert shared_purchase.order.status != Order.Status.DELIVERED

    for profile, expected_status in [(seller_profile, 201), (other_seller.profile, 400)]:
        item = shared_purchase.order.items.get(seller=profile)
        response = customer_client.post(
            f"/api/v1/order-items/{item.pk}/returns/",
            {
                "reason": ReturnRequest.Reason.DEFECTIVE_PRODUCT,
                "description": "Solicito devolución de este producto recibido con una falla.",
                "quantity": 1,
            },
            format="json",
        )
        assert response.status_code == expected_status, response.data
        assert ReturnRequest.objects.filter(order_item=item).exists() == (expected_status == 201)


def test_customer_order_marks_delivery_separately_for_each_item(
    shared_purchase, seller_client, seller_profile, other_seller, customer_client,
):
    own = seller_shipment(shared_purchase, seller_profile)
    assert patch_shipment(seller_client, own, Shipment.Status.DELIVERED).status_code == 200

    response = customer_client.get(f"/api/v1/orders/{shared_purchase.order.pk}/")

    assert response.status_code == 200
    items = {item["seller"]: item for item in response.data["items"]}
    assert items[seller_profile.pk]["is_delivered"] is True
    assert items[seller_profile.pk]["delivery_status"] == Shipment.Status.DELIVERED
    assert items[other_seller.profile.pk]["is_delivered"] is False
    assert items[other_seller.profile.pk]["delivery_status"] == Shipment.Status.CREATED


def concurrent_shipment_requests(monkeypatch, calls, *, deliver_first=False):
    """Finish validation for all requests before either starts its update."""
    barrier = Barrier(len(calls))
    delivered = Event()
    original_validate = ShipmentStatusUpdateSerializer.validate
    original_update = ShipmentStatusUpdateSerializer.update

    def validate_together(self, attrs):
        attrs = original_validate(self, attrs)
        barrier.wait(timeout=15)
        return attrs

    def controlled_update(self, instance, validated_data):
        status = validated_data.get("status")
        if deliver_first and status != Shipment.Status.DELIVERED:
            assert delivered.wait(timeout=15), "La entrega concurrente no terminó."
        try:
            return original_update(self, instance, validated_data)
        finally:
            if status == Shipment.Status.DELIVERED:
                delivered.set()

    monkeypatch.setattr(ShipmentStatusUpdateSerializer, "validate", validate_together)
    monkeypatch.setattr(ShipmentStatusUpdateSerializer, "update", controlled_update)

    def submit(call):
        user_pk, shipment_pk, status = call
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(user=User.objects.get(pk=user_pk))
            response = client.patch(
                f"/api/v1/seller/shipments/{shipment_pk}/status/",
                {"status": status}, format="json",
            )
            return response.status_code
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=len(calls)) as executor:
        return list(executor.map(submit, calls))


@pytest.mark.django_db(transaction=True)
def test_concurrent_deliveries_keep_the_correct_global_order_state(
    shared_purchase, seller_user, seller_profile, other_seller, monkeypatch,
):
    if connection.vendor != "postgresql":
        pytest.skip("Los bloqueos concurrentes se comprueban con PostgreSQL.")
    first = seller_shipment(shared_purchase, seller_profile)
    second = seller_shipment(shared_purchase, other_seller.profile)

    statuses = concurrent_shipment_requests(monkeypatch, [
        (seller_user.pk, first.pk, Shipment.Status.DELIVERED),
        (other_seller.user.pk, second.pk, Shipment.Status.DELIVERED),
    ])

    assert statuses == [200, 200]
    shared_purchase.order.refresh_from_db()
    first.refresh_from_db()
    second.refresh_from_db()
    assert shared_purchase.order.status == Order.Status.DELIVERED
    assert first.status == second.status == Shipment.Status.DELIVERED
    assert first.events.filter(status=Shipment.Status.DELIVERED).count() == 1
    assert second.events.filter(status=Shipment.Status.DELIVERED).count() == 1
    assert shipment_notifications(shared_purchase.order).count() == 2


@pytest.mark.django_db(transaction=True)
def test_concurrent_duplicate_status_creates_only_one_event_and_notification(
    single_purchase, seller_user, monkeypatch,
):
    if connection.vendor != "postgresql":
        pytest.skip("Los bloqueos concurrentes se comprueban con PostgreSQL.")
    shipment = Shipment.objects.get(order=single_purchase.order)
    call = (seller_user.pk, shipment.pk, Shipment.Status.PREPARING)

    statuses = concurrent_shipment_requests(monkeypatch, [call, call])

    assert statuses == [200, 200]
    shipment.refresh_from_db()
    assert shipment.status == Shipment.Status.PREPARING
    assert shipment.events.filter(status=Shipment.Status.PREPARING).count() == 1
    assert shipment_notifications(single_purchase.order).count() == 1


@pytest.mark.django_db(transaction=True)
def test_concurrent_prevalidated_update_cannot_reopen_a_delivered_shipment(
    single_purchase, seller_user, monkeypatch,
):
    if connection.vendor != "postgresql":
        pytest.skip("Los bloqueos concurrentes se comprueban con PostgreSQL.")
    shipment = Shipment.objects.get(order=single_purchase.order)

    statuses = concurrent_shipment_requests(monkeypatch, [
        (seller_user.pk, shipment.pk, Shipment.Status.DELIVERED),
        (seller_user.pk, shipment.pk, Shipment.Status.PREPARING),
    ], deliver_first=True)

    assert statuses == [200, 400]
    shipment.refresh_from_db()
    single_purchase.order.refresh_from_db()
    assert shipment.status == Shipment.Status.DELIVERED
    assert single_purchase.order.status == Order.Status.DELIVERED
    assert shipment.events.filter(status=Shipment.Status.DELIVERED).count() == 1
    assert not shipment.events.filter(status=Shipment.Status.PREPARING).exists()
    assert shipment_notifications(single_purchase.order).count() == 1
