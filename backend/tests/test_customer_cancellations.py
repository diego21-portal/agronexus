"""Customer cancellation and physical return regressions, using the real API."""

from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Barrier
from types import SimpleNamespace

import pytest
from django.db import close_old_connections, connection
from django.test import Client
from django.core.management import call_command
from django.core.management.base import CommandError
from rest_framework.test import APIClient

from apps.aftersales.models import CancellationRequest, ReturnInspection
from apps.orders.models import Order
from apps.payments.models import Payment, PaymentRefund
from apps.products.models import Product, StockMovement
from apps.sellers.models import SellerProfile
from apps.shipments.models import Shipment
from apps.users.models import User


pytestmark = pytest.mark.django_db
REASON = "Solicito cancelar los productos de este envío."


def test_partial_cancellation_keeps_the_other_sellers_dashboard_revenue(
    cancellation_purchase, customer_client, seller_profile, seller_client,
    cancellation_other_seller, admin_client,
):
    purchase = cancellation_purchase
    response = request_cancellation(customer_client, purchase.shipments[seller_profile.pk])
    assert response.status_code == 201, response.data
    other = cancellation_other_seller.client.get("/api/v1/seller/dashboard/")
    assert other.status_code == 200, other.data
    assert Decimal(str(other.data["sales"]["total_revenue"])) == Decimal("25000.00")
    own = seller_client.get("/api/v1/seller/dashboard/")
    assert own.data["orders"]["cancelled_orders"] == 1
    assert Decimal(str(own.data["sales"]["total_revenue"])) == 0
    admin = admin_client.get("/api/v1/admin/dashboard/")
    assert admin.status_code == 200, admin.data
    assert Decimal(str(admin.data["sales"]["total_revenue"])) == Decimal("25000.00")
    assert Decimal(str(admin.data["sales"]["refunded_amount"])) == Decimal("170000.00")


def test_shipping_refund_retries_do_not_duplicate_ledger_or_case_history(
    cancellation_single_purchase, customer_client, admin_client, seller_profile,
):
    purchase = cancellation_single_purchase
    order = purchase.order
    order.shipping_cost = Decimal("50.00")
    order.total += Decimal("50.00")
    order.save(update_fields=["shipping_cost", "total"])
    Payment.objects.filter(order=order).update(amount=order.total)
    response = request_cancellation(customer_client, purchase.shipments[seller_profile.pk])
    assert response.status_code == 201, response.data
    case = CancellationRequest.objects.get(pk=response.data["id"])
    first = case_action(admin_client, case, "refund_shipping", role="admin", amount="50.00",
                        operation_key="shipping-retry-proof", resolution="Se autorizó devolver el gasto original de envío.")
    assert first.status_code == 200, first.data
    count = case.events.count()
    second = case_action(admin_client, case, "refund_shipping", role="admin", amount="50.00",
                         operation_key="shipping-retry-proof", resolution="Se autorizó devolver el gasto original de envío.")
    assert second.status_code == 200, second.data
    assert case.events.count() == count
    assert PaymentRefund.objects.filter(cancellation_request=case, kind="SHIPPING").count() == 1


def test_admin_forms_preserve_inventory_history_and_financial_review_flags(
    cancellation_single_purchase, admin_user,
):
    purchase = cancellation_single_purchase
    payment = purchase.order.payment
    payment.refund_review_required = True
    payment.save(update_fields=["refund_review_required"])
    client = Client()
    client.force_login(admin_user)
    response = client.post(f"/admin/payments/payment/{payment.pk}/change/", {
        "refund_review_required": "", "amount": "0.00", "payment_method": "CASH_ON_DELIVERY", "_save": "Save",
    })
    assert response.status_code == 302
    payment.refresh_from_db()
    assert payment.refund_review_required is True
    assert payment.amount == Decimal("170000.00")
    assert payment.payment_method == "SIMULATED_CARD"
    product = next(iter(purchase.products.values()))
    movement_ids = set(StockMovement.objects.filter(product=product).values_list("pk", flat=True))
    response = client.post(f"/admin/products/product/{product.pk}/delete/", {"post": "yes"})
    assert response.status_code == 403
    assert Product.objects.filter(pk=product.pk).exists()
    assert set(StockMovement.objects.filter(product=product).values_list("pk", flat=True)) == movement_ids


def test_seed_refuses_to_erase_linked_demo_order_history(cancellation_single_purchase):
    purchase = cancellation_single_purchase
    purchase.order.order_number = "AGX-DEMO-PROTECTED"
    purchase.order.save(update_fields=["order_number"])
    movement_ids = set(StockMovement.objects.values_list("pk", flat=True))
    with pytest.raises(CommandError, match="historial"):
        call_command("seed_demo", reset=True)
    assert Order.objects.filter(pk=purchase.order.pk).exists()
    assert set(StockMovement.objects.values_list("pk", flat=True)) == movement_ids


@pytest.mark.parametrize("terminal_status", [Order.Status.DELIVERED, Order.Status.CANCELLED])
def test_new_cancellation_cannot_restock_an_inconsistent_finalized_order(
    cancellation_single_purchase, customer_client, seller_profile, terminal_status,
):
    purchase = cancellation_single_purchase
    Order.objects.filter(pk=purchase.order.pk).update(status=terminal_status)
    movement_count = StockMovement.objects.count()
    response = request_cancellation(customer_client, purchase.shipments[seller_profile.pk])
    assert response.status_code == 400
    assert not CancellationRequest.objects.exists()
    assert not PaymentRefund.objects.exists()
    assert StockMovement.objects.count() == movement_count


@pytest.fixture
def cancellation_other_seller(seller_profile):
    user = User.objects.create_user(
        username="cancellation-other-seller", email="cancel-other@example.test",
        role=User.Role.SELLER,
    )
    seller = SellerProfile.objects.create(
        user=user, business_name="Bombas del segundo vendedor",
        tax_id="CANCELLATION-SECOND", is_active=True, is_verified=True,
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return SimpleNamespace(user=user, profile=seller, client=client)


@pytest.fixture
def cancellation_other_product(product, cancellation_other_seller):
    return Product.objects.create(
        seller=cancellation_other_seller.profile,
        category=product.category, brand=product.brand, region=product.region,
        name="Bomba para comprobar una cancelación parcial",
        sku="CANCELLATION-SECOND-PRODUCT", price="12500.00", stock=10,
        description="El segundo vendedor conserva su venta y su propio envío.",
        status=Product.Status.PUBLISHED, is_active=True,
    )


@pytest.fixture
def cancellation_purchase_factory(customer_client, address):
    def purchase(*products):
        for product in products:
            response = customer_client.post(
                "/api/v1/cart/items/",
                {"product_id": product.pk, "quantity": 2}, format="json",
            )
            assert response.status_code == 201, response.data
        response = customer_client.post(
            "/api/v1/checkout/",
            {"address_id": address.pk, "payment_method": "SIMULATED_CARD"},
            format="json",
        )
        assert response.status_code == 201, response.data
        order = Order.objects.get(pk=response.data["id"])
        return SimpleNamespace(
            order=order,
            products={product.seller_id: product for product in products},
            items={item.seller_id: item for item in order.items.all()},
            shipments={shipment.seller_id: shipment for shipment in order.shipments.all()},
        )

    return purchase


@pytest.fixture
def cancellation_purchase(cancellation_purchase_factory, product, cancellation_other_product):
    return cancellation_purchase_factory(product, cancellation_other_product)


@pytest.fixture
def cancellation_single_purchase(cancellation_purchase_factory, product):
    return cancellation_purchase_factory(product)


def request_cancellation(client, shipment, **extra):
    return client.post(
        f"/api/v1/shipments/{shipment.pk}/cancellation/",
        {"reason": REASON, **extra}, format="json",
    )


def advance_shipment(client, shipment, status):
    return client.patch(
        f"/api/v1/seller/shipments/{shipment.pk}/status/",
        {"status": status}, format="json",
    )


def case_action(client, cancellation, action, *, role="seller", items=None, **fields):
    data = {"action": action, **fields}
    if action == "inspect" and "resolution" not in fields:
        data["resolution"] = "Inspección física de las unidades recibidas."
    if items is not None:
        data["items"] = items
    return client.post(
        f"/api/v1/{role}/cancellations/{cancellation.pk}/action/", data, format="json",
    )


def start_in_transit_case(purchase, profile, seller_client, customer_client):
    shipment = purchase.shipments[profile.pk]
    advanced = advance_shipment(seller_client, shipment, Shipment.Status.IN_TRANSIT)
    assert advanced.status_code == 200, advanced.data
    created = request_cancellation(customer_client, shipment)
    assert created.status_code == 201, created.data
    return CancellationRequest.objects.get(pk=created.data["id"])


def inspected_case(purchase, profile, seller_client, customer_client, *, restock=1, defective=1):
    cancellation = start_in_transit_case(purchase, profile, seller_client, customer_client)
    started = case_action(seller_client, cancellation, "start_return")
    assert started.status_code == 200, started.data
    item = purchase.items[profile.pk]
    received = case_action(
        seller_client, cancellation, "receive",
        items=[{"order_item": item.pk, "received_quantity": 2}],
    )
    assert received.status_code == 200, received.data
    inspected = case_action(
        seller_client, cancellation, "inspect",
        items=[{"order_item": item.pk, "restocked_quantity": restock, "defective_quantity": defective}],
    )
    assert inspected.status_code == 200, inspected.data
    cancellation.refresh_from_db()
    assert cancellation.status == CancellationRequest.Status.INSPECTED
    return cancellation


@pytest.mark.parametrize("initial_status", [Shipment.Status.CREATED, Shipment.Status.PREPARING])
def test_before_dispatch_cancellation_restores_only_its_sellers_stock_and_money(
    cancellation_purchase, seller_profile, seller_client, customer_client,
    cancellation_other_seller, initial_status,
):
    purchase = cancellation_purchase
    own = purchase.shipments[seller_profile.pk]
    foreign = purchase.shipments[cancellation_other_seller.profile.pk]
    if initial_status != Shipment.Status.CREATED:
        assert advance_shipment(seller_client, own, initial_status).status_code == 200
    original_paid = purchase.order.payment.amount
    foreign_events = foreign.events.count()

    response = request_cancellation(customer_client, own)

    assert response.status_code == 201, response.data
    case = CancellationRequest.objects.get(pk=response.data["id"])
    assert case.status == CancellationRequest.Status.COMPLETED
    assert case.is_pre_dispatch is True
    own.refresh_from_db()
    foreign.refresh_from_db()
    own_product = purchase.products[seller_profile.pk]
    foreign_product = purchase.products[cancellation_other_seller.profile.pk]
    own_product.refresh_from_db()
    foreign_product.refresh_from_db()
    purchase.order.refresh_from_db()
    payment = Payment.objects.get(order=purchase.order)
    assert own.status == Shipment.Status.CANCELLED
    assert own_product.stock == 10
    assert foreign_product.stock == 8
    assert foreign.status == Shipment.Status.CREATED
    assert foreign.events.count() == foreign_events
    assert payment.amount == original_paid == Decimal("195000.00")
    assert payment.refunded_amount == Decimal("170000.00")
    assert payment.status == Payment.Status.PARTIALLY_REFUNDED
    assert purchase.order.status == Order.Status.PAID
    assert PaymentRefund.objects.filter(cancellation_request=case).count() == 1
    assert StockMovement.objects.filter(
        order_item=purchase.items[seller_profile.pk],
        movement_type=StockMovement.MovementType.CANCELLATION,
        quantity=2,
    ).count() == 1
    detail = customer_client.get(f"/api/v1/orders/{purchase.order.pk}/")
    assert detail.status_code == 200
    assert detail.data["has_cancellations"] is True
    assert Decimal(str(detail.data["refunded_amount"])) == Decimal("170000.00")


def test_repeating_completed_cancellation_does_not_repeat_stock_refund_or_events(
    cancellation_single_purchase, seller_profile, customer_client,
):
    purchase = cancellation_single_purchase
    shipment = purchase.shipments[seller_profile.pk]
    first = request_cancellation(customer_client, shipment)
    assert first.status_code == 201, first.data
    case = CancellationRequest.objects.get(pk=first.data["id"])
    events = case.events.count()
    movements = StockMovement.objects.filter(order_item=purchase.items[seller_profile.pk]).count()

    second = request_cancellation(customer_client, shipment)

    assert second.status_code == 200, second.data
    assert second.data["id"] == first.data["id"]
    assert case.events.count() == events
    assert CancellationRequest.objects.filter(shipment=shipment).count() == 1
    assert PaymentRefund.objects.filter(cancellation_request=case).count() == 1
    assert StockMovement.objects.filter(order_item=purchase.items[seller_profile.pk]).count() == movements
    product = purchase.products[seller_profile.pk]
    product.refresh_from_db()
    assert product.stock == 10


def test_cancelling_every_seller_finishes_the_order_and_refunds_the_original_payment(
    cancellation_purchase, customer_client,
):
    purchase = cancellation_purchase
    original_paid = purchase.order.payment.amount
    for shipment in purchase.shipments.values():
        response = request_cancellation(customer_client, shipment)
        assert response.status_code == 201, response.data

    purchase.order.refresh_from_db()
    payment = Payment.objects.get(order=purchase.order)
    assert purchase.order.status == Order.Status.CANCELLED
    assert payment.status == Payment.Status.REFUNDED
    assert payment.amount == original_paid
    assert payment.refunded_amount == original_paid
    assert payment.refundable_amount == Decimal("0.00")
    for product in purchase.products.values():
        product.refresh_from_db()
        assert product.stock == 10


@pytest.mark.parametrize("status", [
    Shipment.Status.DISPATCHED, Shipment.Status.IN_TRANSIT,
    Shipment.Status.IN_DISTRIBUTION_CENTER, Shipment.Status.OUT_FOR_DELIVERY,
])
def test_in_transit_request_records_intent_without_pretending_stock_or_refund(
    cancellation_single_purchase, seller_profile, seller_client, customer_client, status,
):
    purchase = cancellation_single_purchase
    shipment = purchase.shipments[seller_profile.pk]
    assert advance_shipment(seller_client, shipment, status).status_code == 200
    events = shipment.events.count()
    before_stock_movements = StockMovement.objects.count()

    response = request_cancellation(customer_client, shipment)

    assert response.status_code == 201, response.data
    case = CancellationRequest.objects.get(pk=response.data["id"])
    assert case.status == CancellationRequest.Status.REQUESTED
    assert case.is_pre_dispatch is False
    shipment.refresh_from_db()
    product = purchase.products[seller_profile.pk]
    product.refresh_from_db()
    payment = Payment.objects.get(order=purchase.order)
    assert shipment.status == status
    assert shipment.events.count() == events
    assert product.stock == 8
    assert StockMovement.objects.count() == before_stock_movements
    assert payment.status == Payment.Status.APPROVED
    assert payment.refunded_amount == Decimal("0.00")
    assert not PaymentRefund.objects.filter(cancellation_request=case).exists()


def test_another_customer_cannot_request_or_withdraw_the_purchase_cancellation(
    cancellation_single_purchase, seller_profile, seller_client, customer_client,
    second_customer_client,
):
    purchase = cancellation_single_purchase
    shipment = purchase.shipments[seller_profile.pk]
    foreign = request_cancellation(second_customer_client, shipment)
    assert foreign.status_code == 404
    assert not CancellationRequest.objects.exists()
    case = start_in_transit_case(purchase, seller_profile, seller_client, customer_client)

    withdrawn = second_customer_client.post(
        f"/api/v1/cancellations/{case.pk}/withdraw/", {}, format="json",
    )

    assert withdrawn.status_code == 404
    case.refresh_from_db()
    assert case.status == CancellationRequest.Status.REQUESTED
    own_list = customer_client.get("/api/v1/users/me/cancellations/")
    foreign_list = second_customer_client.get("/api/v1/users/me/cancellations/")
    assert own_list.status_code == foreign_list.status_code == 200
    assert [entry["id"] for entry in own_list.data] == [case.pk]
    assert foreign_list.data == []


@pytest.mark.parametrize("reason", ["", "corto", "x" * 1001])
def test_invalid_cancellation_reason_is_rejected_before_any_side_effect(
    cancellation_single_purchase, seller_profile, customer_client, reason,
):
    purchase = cancellation_single_purchase
    shipment = purchase.shipments[seller_profile.pk]
    response = request_cancellation(customer_client, shipment, reason=reason)

    assert response.status_code == 400
    assert not CancellationRequest.objects.exists()
    assert not PaymentRefund.objects.exists()
    product = purchase.products[seller_profile.pk]
    product.refresh_from_db()
    shipment.refresh_from_db()
    assert product.stock == 8
    assert shipment.status == Shipment.Status.CREATED


def test_customer_can_withdraw_pending_case_and_submit_a_new_one_without_reusing_history(
    cancellation_single_purchase, seller_profile, seller_client, customer_client,
):
    purchase = cancellation_single_purchase
    case = start_in_transit_case(purchase, seller_profile, seller_client, customer_client)
    withdrawn = customer_client.post(f"/api/v1/cancellations/{case.pk}/withdraw/", {}, format="json")
    assert withdrawn.status_code == 200, withdrawn.data
    case.refresh_from_db()
    assert case.status == CancellationRequest.Status.WITHDRAWN
    original_events = case.events.count()

    next_case = request_cancellation(customer_client, purchase.shipments[seller_profile.pk])

    assert next_case.status_code == 201, next_case.data
    assert next_case.data["id"] != case.pk
    assert case.events.count() == original_events
    assert CancellationRequest.objects.count() == 2
    assert PaymentRefund.objects.count() == 0
    product = purchase.products[seller_profile.pk]
    product.refresh_from_db()
    assert product.stock == 8


def test_customer_cannot_withdraw_after_physical_return_has_started(
    cancellation_single_purchase, seller_profile, seller_client, customer_client,
):
    case = start_in_transit_case(cancellation_single_purchase, seller_profile, seller_client, customer_client)
    assert case_action(seller_client, case, "start_return").status_code == 200
    response = customer_client.post(f"/api/v1/cancellations/{case.pk}/withdraw/", {}, format="json")

    assert response.status_code == 400
    case.refresh_from_db()
    assert case.status == CancellationRequest.Status.RETURNING


def test_only_own_seller_sees_and_manages_the_return_and_public_readers_do_not_see_internal_notes(
    cancellation_purchase, seller_profile, seller_client, customer_client,
    cancellation_other_seller, admin_client, admin_user,
):
    case = start_in_transit_case(cancellation_purchase, seller_profile, seller_client, customer_client)
    case.admin_note = "Nota interna financiera de la cancelación."
    case.resolved_by = admin_user
    case.save(update_fields=["admin_note", "resolved_by"])

    foreign = case_action(cancellation_other_seller.client, case, "start_return")
    assert foreign.status_code == 404
    own = seller_client.get("/api/v1/seller/cancellations/")
    other = cancellation_other_seller.client.get("/api/v1/seller/cancellations/")
    buyer = customer_client.get("/api/v1/users/me/cancellations/")
    administrator = admin_client.get("/api/v1/admin/cancellations/")
    assert own.status_code == other.status_code == buyer.status_code == administrator.status_code == 200
    assert [entry["id"] for entry in own.data] == [case.pk]
    assert other.data == []
    for public_response in [own, buyer]:
        assert "admin_note" not in public_response.data[0]
        assert "resolved_by_email" not in public_response.data[0]
        assert case.admin_note not in public_response.content.decode()
    assert administrator.data[0]["admin_note"] == case.admin_note


def test_physical_receipt_and_inspection_control_stock_separately_from_refund(
    cancellation_purchase, seller_profile, seller_client, customer_client,
    cancellation_other_seller, admin_client,
):
    purchase = cancellation_purchase
    case = start_in_transit_case(purchase, seller_profile, seller_client, customer_client)
    item = purchase.items[seller_profile.pk]
    product = purchase.products[seller_profile.pk]
    assert case_action(seller_client, case, "start_return").status_code == 200
    one_received = [{"order_item": item.pk, "received_quantity": 1}]

    received = case_action(seller_client, case, "receive", items=one_received)

    assert received.status_code == 200, received.data
    case.refresh_from_db()
    inspection = ReturnInspection.objects.get(cancellation_request=case, order_item=item)
    product.refresh_from_db()
    assert case.status == CancellationRequest.Status.RETURNING
    assert inspection.received_quantity == inspection.quarantined_quantity == 1
    assert product.stock == 8
    assert not PaymentRefund.objects.filter(cancellation_request=case).exists()

    partial_inspection = case_action(
        seller_client, case, "inspect",
        items=[{"order_item": item.pk, "restocked_quantity": 0, "defective_quantity": 1}],
    )
    assert partial_inspection.status_code == 200, partial_inspection.data
    inspection.refresh_from_db()
    case.refresh_from_db()
    product.refresh_from_db()
    assert case.status == CancellationRequest.Status.RETURNING
    assert inspection.defective_quantity == 1
    assert inspection.quarantined_quantity == 0
    assert product.stock == 8

    all_received = [{"order_item": item.pk, "received_quantity": 2}]
    first = case_action(seller_client, case, "receive", items=all_received)
    assert first.status_code == 200, first.data
    events = case.events.count()
    repeated = case_action(seller_client, case, "receive", items=all_received)
    assert repeated.status_code == 200, repeated.data
    assert case.events.count() == events
    case.refresh_from_db()
    assert case.status == CancellationRequest.Status.RECEIVED
    product.refresh_from_db()
    assert product.stock == 8

    disposition = [{"order_item": item.pk, "restocked_quantity": 1, "defective_quantity": 1}]
    inspected = case_action(seller_client, case, "inspect", items=disposition)
    assert inspected.status_code == 200, inspected.data
    inspection.refresh_from_db()
    product.refresh_from_db()
    case.refresh_from_db()
    assert case.status == CancellationRequest.Status.INSPECTED
    assert inspection.restocked_quantity == inspection.defective_quantity == 1
    assert inspection.quarantined_quantity == 0
    assert product.stock == 9
    assert not PaymentRefund.objects.filter(cancellation_request=case).exists()
    events = case.events.count()
    repeated = case_action(seller_client, case, "inspect", items=disposition)
    assert repeated.status_code == 200, repeated.data
    assert case.events.count() == events
    product.refresh_from_db()
    assert product.stock == 9

    # Refunds use the purchased snapshot, even when the catalogue price changes.
    product.price = Decimal("999.00")
    product.save(update_fields=["price", "updated_at"])
    completed = case_action(admin_client, case, "complete", role="admin", resolution="Retorno revisado y reembolsado.")
    assert completed.status_code == 200, completed.data
    case.refresh_from_db()
    product.refresh_from_db()
    payment = Payment.objects.get(order=purchase.order)
    assert case.status == CancellationRequest.Status.COMPLETED
    assert product.stock == 9
    assert payment.refunded_amount == Decimal("170000.00")
    assert payment.amount == Decimal("195000.00")
    foreign = purchase.shipments[cancellation_other_seller.profile.pk]
    foreign.refresh_from_db()
    assert foreign.status == Shipment.Status.CREATED


def test_defective_returned_units_never_enter_available_stock(
    cancellation_single_purchase, seller_profile, seller_client, customer_client, admin_client,
):
    case = inspected_case(
        cancellation_single_purchase, seller_profile, seller_client, customer_client,
        restock=0, defective=2,
    )
    response = case_action(admin_client, case, "complete", role="admin", resolution="Unidades defectuosas recibidas.")

    assert response.status_code == 200, response.data
    product = cancellation_single_purchase.products[seller_profile.pk]
    product.refresh_from_db()
    assert product.stock == 8
    assert Payment.objects.get(order=cancellation_single_purchase.order).refunded_amount == Decimal("170000.00")


@pytest.mark.parametrize("action", ["receive", "inspect", "complete"])
def test_return_cannot_skip_required_physical_steps(
    cancellation_single_purchase, seller_profile, seller_client, customer_client, admin_client, action,
):
    purchase = cancellation_single_purchase
    case = start_in_transit_case(purchase, seller_profile, seller_client, customer_client)
    item = purchase.items[seller_profile.pk]
    if action == "receive":
        payload = [{"order_item": item.pk, "received_quantity": 2}]
    elif action == "inspect":
        payload = [{"order_item": item.pk, "restocked_quantity": 2, "defective_quantity": 0}]
    else:
        payload = None

    response = case_action(admin_client, case, action, role="admin", items=payload)

    assert response.status_code == 400
    case.refresh_from_db()
    assert case.status == CancellationRequest.Status.REQUESTED
    product = purchase.products[seller_profile.pk]
    product.refresh_from_db()
    assert product.stock == 8
    assert not PaymentRefund.objects.filter(cancellation_request=case).exists()


@pytest.mark.parametrize("action", ["complete", "reject"])
def test_own_seller_cannot_authorize_financial_resolution(
    cancellation_single_purchase, seller_profile, seller_client, customer_client, action,
):
    case = inspected_case(cancellation_single_purchase, seller_profile, seller_client, customer_client)
    response = case_action(seller_client, case, action, resolution="Intento de resolución financiera.")

    assert response.status_code == 403
    case.refresh_from_db()
    assert case.status == CancellationRequest.Status.INSPECTED
    assert not PaymentRefund.objects.filter(cancellation_request=case).exists()


def test_foreign_order_item_cannot_be_received_into_another_sellers_case(
    cancellation_purchase, seller_profile, seller_client, customer_client, cancellation_other_seller,
):
    purchase = cancellation_purchase
    case = start_in_transit_case(purchase, seller_profile, seller_client, customer_client)
    assert case_action(seller_client, case, "start_return").status_code == 200
    foreign_item = purchase.items[cancellation_other_seller.profile.pk]
    response = case_action(
        seller_client, case, "receive",
        items=[{"order_item": foreign_item.pk, "received_quantity": 2}],
    )

    assert response.status_code == 400
    assert not ReturnInspection.objects.filter(cancellation_request=case, received_quantity__gt=0).exists()


@pytest.mark.parametrize("received_quantity", [-1, 3])
def test_receipt_cannot_record_negative_or_unpurchased_units(
    cancellation_single_purchase, seller_profile, seller_client, customer_client, received_quantity,
):
    purchase = cancellation_single_purchase
    case = start_in_transit_case(purchase, seller_profile, seller_client, customer_client)
    assert case_action(seller_client, case, "start_return").status_code == 200
    item = purchase.items[seller_profile.pk]
    response = case_action(
        seller_client, case, "receive",
        items=[{"order_item": item.pk, "received_quantity": received_quantity}],
    )

    assert response.status_code == 400
    assert not ReturnInspection.objects.filter(cancellation_request=case, received_quantity__gt=0).exists()


def test_pending_request_does_not_erase_a_delivery_and_can_continue_as_a_return(
    cancellation_purchase, seller_profile, seller_client, customer_client, admin_client,
):
    purchase = cancellation_purchase
    case = start_in_transit_case(purchase, seller_profile, seller_client, customer_client)
    shipment = purchase.shipments[seller_profile.pk]
    delivered = advance_shipment(seller_client, shipment, Shipment.Status.DELIVERED)
    assert delivered.status_code == 200, delivered.data
    shipment.refresh_from_db()
    delivered_at = shipment.delivered_at
    assert case_action(seller_client, case, "start_return").status_code == 200
    item = purchase.items[seller_profile.pk]
    received = case_action(seller_client, case, "receive", items=[{"order_item": item.pk, "received_quantity": 2}])
    assert received.status_code == 200, received.data
    inspected = case_action(seller_client, case, "inspect", items=[{"order_item": item.pk, "restocked_quantity": 0, "defective_quantity": 2}])
    assert inspected.status_code == 200, inspected.data
    completed = case_action(admin_client, case, "complete", role="admin", resolution="Devolución posterior a la entrega.")
    assert completed.status_code == 200, completed.data

    shipment.refresh_from_db()
    assert shipment.status == Shipment.Status.DELIVERED
    assert shipment.delivered_at == delivered_at
    assert shipment.events.filter(status=Shipment.Status.DELIVERED).count() == 1


def test_outgoing_shipment_cannot_advance_once_its_physical_return_has_started(
    cancellation_single_purchase, seller_profile, seller_client, customer_client,
):
    purchase = cancellation_single_purchase
    case = start_in_transit_case(purchase, seller_profile, seller_client, customer_client)
    assert case_action(seller_client, case, "start_return").status_code == 200
    shipment = purchase.shipments[seller_profile.pk]
    events = shipment.events.count()

    response = advance_shipment(seller_client, shipment, Shipment.Status.DELIVERED)

    assert response.status_code == 400
    shipment.refresh_from_db()
    assert shipment.status == Shipment.Status.IN_TRANSIT
    assert shipment.events.count() == events


def test_delivered_product_uses_returns_instead_of_opening_a_new_cancellation(
    cancellation_single_purchase, seller_profile, seller_client, customer_client,
):
    purchase = cancellation_single_purchase
    shipment = purchase.shipments[seller_profile.pk]
    assert advance_shipment(seller_client, shipment, Shipment.Status.DELIVERED).status_code == 200
    response = request_cancellation(customer_client, shipment)

    assert response.status_code == 400
    assert not CancellationRequest.objects.exists()


def test_delivered_during_cancellation_does_not_allow_a_second_return_process(
    cancellation_single_purchase, seller_profile, seller_client, customer_client,
):
    purchase = cancellation_single_purchase
    start_in_transit_case(purchase, seller_profile, seller_client, customer_client)
    shipment = purchase.shipments[seller_profile.pk]
    assert advance_shipment(seller_client, shipment, Shipment.Status.DELIVERED).status_code == 200
    item = purchase.items[seller_profile.pk]

    response = customer_client.post(
        f"/api/v1/order-items/{item.pk}/returns/",
        {"reason": "DEFECTIVE_PRODUCT", "description": "El retorno ya se gestiona en la cancelación.", "quantity": 1},
        format="json",
    )

    assert response.status_code == 400


def test_insufficient_refundable_payment_rolls_back_the_entire_immediate_cancellation(
    cancellation_single_purchase, seller_profile, customer_client,
):
    purchase = cancellation_single_purchase
    shipment = purchase.shipments[seller_profile.pk]
    Payment.objects.filter(order=purchase.order).update(amount=Decimal("100.00"))
    before_movements = StockMovement.objects.count()
    before_events = shipment.events.count()

    response = request_cancellation(customer_client, shipment)

    assert response.status_code == 400
    shipment.refresh_from_db()
    product = purchase.products[seller_profile.pk]
    product.refresh_from_db()
    assert shipment.status == Shipment.Status.CREATED
    assert product.stock == 8
    assert StockMovement.objects.count() == before_movements
    assert shipment.events.count() == before_events
    assert not CancellationRequest.objects.exists()
    assert not PaymentRefund.objects.exists()


def concurrent_calls(calls):
    barrier = Barrier(len(calls))

    def submit(call):
        close_old_connections()
        try:
            user_pk, method, path, body = call
            client = APIClient()
            client.force_authenticate(user=User.objects.get(pk=user_pk))
            barrier.wait(timeout=15)
            response = getattr(client, method)(path, body, format="json")
            return response.status_code
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=len(calls)) as executor:
        return list(executor.map(submit, calls))


@pytest.mark.django_db(transaction=True)
def test_concurrent_duplicate_customer_cancellation_restores_stock_and_money_only_once(
    cancellation_single_purchase, seller_profile, customer_user,
):
    if connection.vendor != "postgresql":
        pytest.skip("La cancelación concurrente se comprueba con PostgreSQL.")
    purchase = cancellation_single_purchase
    shipment = purchase.shipments[seller_profile.pk]
    call = (customer_user.pk, "post", f"/api/v1/shipments/{shipment.pk}/cancellation/", {"reason": REASON})

    statuses = concurrent_calls([call, call])

    assert sorted(statuses) == [200, 201]
    assert CancellationRequest.objects.filter(shipment=shipment).count() == 1
    assert PaymentRefund.objects.filter(payment__order=purchase.order).count() == 1
    product = purchase.products[seller_profile.pk]
    product.refresh_from_db()
    assert product.stock == 10
    assert Payment.objects.get(order=purchase.order).refunded_amount == Decimal("170000.00")


@pytest.mark.django_db(transaction=True)
def test_cancellation_competing_with_dispatch_preserves_the_actual_physical_outcome(
    cancellation_single_purchase, seller_profile, customer_user, seller_user,
):
    if connection.vendor != "postgresql":
        pytest.skip("La cancelación frente a despacho se comprueba con PostgreSQL.")
    purchase = cancellation_single_purchase
    shipment = purchase.shipments[seller_profile.pk]
    statuses = concurrent_calls([
        (customer_user.pk, "post", f"/api/v1/shipments/{shipment.pk}/cancellation/", {"reason": REASON}),
        (seller_user.pk, "patch", f"/api/v1/seller/shipments/{shipment.pk}/status/", {"status": Shipment.Status.DISPATCHED}),
    ])

    assert statuses[0] == 201
    case = CancellationRequest.objects.get(shipment=shipment)
    shipment.refresh_from_db()
    product = purchase.products[seller_profile.pk]
    product.refresh_from_db()
    payment = Payment.objects.get(order=purchase.order)
    if statuses[1] == 200:
        assert case.status == CancellationRequest.Status.REQUESTED
        assert shipment.status == Shipment.Status.DISPATCHED
        assert product.stock == 8
        assert payment.refunded_amount == Decimal("0.00")
    else:
        assert statuses[1] == 400
        assert case.status == CancellationRequest.Status.COMPLETED
        assert shipment.status == Shipment.Status.CANCELLED
        assert product.stock == 10
        assert payment.refunded_amount == Decimal("170000.00")


@pytest.mark.django_db(transaction=True)
def test_concurrent_financial_completion_records_one_refund_without_restocking_again(
    cancellation_single_purchase, seller_profile, seller_client, customer_client, admin_user,
):
    if connection.vendor != "postgresql":
        pytest.skip("El reembolso concurrente se comprueba con PostgreSQL.")
    purchase = cancellation_single_purchase
    case = inspected_case(purchase, seller_profile, seller_client, customer_client)
    call = (
        admin_user.pk, "post", f"/api/v1/admin/cancellations/{case.pk}/action/",
        {"action": "complete", "resolution": "Retorno comprobado por administración."},
    )

    statuses = concurrent_calls([call, call])

    assert statuses == [200, 200]
    assert PaymentRefund.objects.filter(cancellation_request=case).count() == 1
    assert Payment.objects.get(order=purchase.order).refunded_amount == Decimal("170000.00")
    product = purchase.products[seller_profile.pk]
    product.refresh_from_db()
    assert product.stock == 9
