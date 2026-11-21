"""A received parcel, sellable stock and a refund are different facts."""

from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Barrier

import pytest

from tests.checkout_helpers import checkout_with_quote
from django.db import close_old_connections, connection
from rest_framework import serializers
from rest_framework.test import APIClient

from apps.aftersales.models import CancellationRequest, ReturnInspection
from apps.complaints.models import ReturnRequest
from apps.complaints.serializers import ReturnRequestStatusUpdateSerializer
from apps.notifications.models import Notification
from apps.orders.models import Order
from apps.payments.models import Payment, PaymentRefund
from apps.products.models import StockMovement
from apps.sellers.models import SellerProfile
from apps.shipments.models import Shipment
from apps.users.models import User


pytestmark = pytest.mark.django_db


@pytest.fixture
def return_case(customer_client, seller_client, product, address):
    added = customer_client.post(
        "/api/v1/cart/items/", {"product_id": product.pk, "quantity": 2}, format="json",
    )
    assert added.status_code == 201
    checkout = checkout_with_quote(customer_client, {"address_id": address.pk, "payment_method": "SIMULATED_CARD"})
    assert checkout.status_code == 201, checkout.data
    order = Order.objects.get(pk=checkout.data["id"])
    shipment = Shipment.objects.get(order=order)
    delivered = seller_client.patch(
        f"/api/v1/seller/shipments/{shipment.pk}/status/",
        {"status": "DELIVERED"}, format="json",
    )
    assert delivered.status_code == 200, delivered.data
    item = order.items.get()
    requested = customer_client.post(
        f"/api/v1/order-items/{item.pk}/returns/",
        {
            "reason": "DEFECTIVE_PRODUCT", "quantity": 2,
            "description": "Los productos recibidos requieren una revisión por una falla.",
        }, format="json",
    )
    assert requested.status_code == 201, requested.data
    return ReturnRequest.objects.get(pk=requested.data["id"])


def update_status(client, record, status=None, **payload):
    if status is not None:
        payload["status"] = status
    return client.patch(
        f"/api/v1/admin/returns/{record.pk}/status/", payload, format="json",
    )


def approve(client, record):
    response = update_status(
        client, record, "APPROVED", approved_refund_amount=str(record.requested_refund_amount),
    )
    assert response.status_code == 200, response.data
    return response


def receive(client, record, quantity, *, prefix="seller", note=""):
    return client.post(
        f"/api/v1/{prefix}/returns/{record.pk}/receive/",
        {"received_quantity": quantity, "note": note}, format="json",
    )


def inspect(client, record, restocked, defective, *, prefix="seller", note="Resultado de inspección física."):
    return client.post(
        f"/api/v1/{prefix}/returns/{record.pk}/inspect/",
        {"restocked_quantity": restocked, "defective_quantity": defective, "note": note},
        format="json",
    )


def fully_inspect(admin_client, seller_client, record, *, restocked=0):
    approve(admin_client, record)
    receipt = receive(seller_client, record, record.quantity)
    assert receipt.status_code == 200, receipt.data
    checked = inspect(seller_client, record, restocked, record.quantity - restocked)
    assert checked.status_code == 200, checked.data
    return checked


def notification_count(record):
    return Notification.objects.filter(
        related_object_type="ReturnRequest", related_object_id=record.pk,
        notification_type=Notification.NotificationType.RETURN_UPDATED,
    ).count()


@pytest.mark.parametrize("target", ["PRODUCT_RECEIVED", "INSPECTED", "REFUNDED", "CLOSED"])
def test_request_cannot_skip_receipt_and_inspection(return_case, admin_client, target):
    response = update_status(admin_client, return_case, target)

    assert response.status_code == 400
    return_case.refresh_from_db()
    assert return_case.status == ReturnRequest.Status.REQUESTED
    assert not ReturnInspection.objects.filter(return_request=return_case).exists()
    assert not PaymentRefund.objects.filter(return_request=return_case).exists()


@pytest.mark.parametrize("target", ["UNDER_REVIEW", "RECEIVED"])
def test_frontend_aliases_are_not_silently_accepted(return_case, admin_client, target):
    assert update_status(admin_client, return_case, target).status_code == 400


@pytest.mark.parametrize("amount", ["-0.01", "170000.01", "8500000.00"])
def test_approved_refund_cannot_exceed_the_original_purchase(return_case, admin_client, amount):
    response = update_status(
        admin_client, return_case, "APPROVED", approved_refund_amount=amount,
    )

    assert response.status_code == 400
    return_case.refresh_from_db()
    assert return_case.status == ReturnRequest.Status.REQUESTED
    assert return_case.approved_refund_amount == Decimal("0.00")
    assert not ReturnInspection.objects.filter(return_request=return_case).exists()


def test_partial_receipt_stays_quarantined_and_does_not_restock(
    return_case, admin_client, seller_client, product,
):
    approved = approve(admin_client, return_case)
    assert approved.data["inspection"]["received_quantity"] == 0
    assert approved.data["can_receive"] is True
    product.refresh_from_db()
    stock = product.stock

    response = receive(seller_client, return_case, 1)

    assert response.status_code == 200, response.data
    assert response.data["status"] == "APPROVED"
    assert response.data["inspection"]["quarantined_quantity"] == 1
    assert response.data["can_inspect"] is True
    assert response.data["allowed_statuses"] == []
    product.refresh_from_db()
    assert product.stock == stock
    assert not PaymentRefund.objects.filter(return_request=return_case).exists()
    assert not StockMovement.objects.filter(movement_type=StockMovement.MovementType.RETURN).exists()
    assert update_status(admin_client, return_case, "REFUNDED").status_code == 400


def test_defective_receipt_can_be_refunded_without_becoming_sellable(
    return_case, admin_client, seller_client, product,
):
    fully_inspect(admin_client, seller_client, return_case)
    product.refresh_from_db()
    stock = product.stock
    original_amount = return_case.order_item.order.payment.amount

    response = update_status(admin_client, return_case, "REFUNDED")

    assert response.status_code == 200, response.data
    assert response.data["status"] == "REFUNDED"
    payment = Payment.objects.get(order=return_case.order_item.order)
    assert payment.status == Payment.Status.REFUNDED
    assert payment.amount == original_amount
    assert payment.refunded_amount == Decimal("170000.00")
    assert PaymentRefund.objects.filter(return_request=return_case).count() == 1
    product.refresh_from_db()
    assert product.stock == stock == 8
    assert not StockMovement.objects.filter(movement_type=StockMovement.MovementType.RETURN).exists()


def test_only_sellable_inspected_units_return_to_inventory_once(
    return_case, admin_client, seller_client, product,
):
    fully_inspect(admin_client, seller_client, return_case, restocked=1)
    inspection = ReturnInspection.objects.get(return_request=return_case)
    original_notifications = notification_count(return_case)
    original_events = return_case.events.count()

    repeated_receipt = receive(seller_client, return_case, 2)
    repeated_inspection = inspect(seller_client, return_case, 1, 1)

    assert repeated_receipt.status_code == repeated_inspection.status_code == 200
    product.refresh_from_db()
    assert product.stock == 9
    assert inspection.restocked_quantity == inspection.defective_quantity == 1
    assert inspection.quarantined_quantity == 0
    movements = StockMovement.objects.filter(
        movement_type=StockMovement.MovementType.RETURN, order_item=return_case.order_item,
    )
    assert movements.count() == 1
    assert movements.get().quantity == 1
    assert notification_count(return_case) == original_notifications
    assert return_case.events.count() == original_events


def test_inspection_requires_receipt_and_written_evidence(return_case, admin_client, seller_client):
    approve(admin_client, return_case)
    assert inspect(seller_client, return_case, 1, 0).status_code == 400
    assert receive(seller_client, return_case, 2).status_code == 200
    assert inspect(seller_client, return_case, 1, 1, note="").status_code == 400
    assert inspect(seller_client, return_case, 2, 1).status_code == 400
    return_case.refresh_from_db()
    assert return_case.status == ReturnRequest.Status.PRODUCT_RECEIVED


def test_received_quantities_cannot_exceed_authorization_or_move_backwards(
    return_case, admin_client, seller_client,
):
    approve(admin_client, return_case)
    assert receive(seller_client, return_case, 3).status_code == 400
    assert receive(seller_client, return_case, 1).status_code == 200
    assert receive(seller_client, return_case, 0).status_code == 400
    assert inspect(seller_client, return_case, 1, 0).status_code == 200
    assert inspect(seller_client, return_case, 0, 1).status_code == 400


def test_repeating_a_refund_never_returns_money_or_notifies_twice(
    return_case, admin_client, seller_client,
):
    fully_inspect(admin_client, seller_client, return_case)
    assert update_status(admin_client, return_case, "REFUNDED").status_code == 200
    original_notifications = notification_count(return_case)
    original_events = return_case.events.count()

    retry = update_status(admin_client, return_case, "REFUNDED")

    assert retry.status_code == 200, retry.data
    assert PaymentRefund.objects.filter(return_request=return_case).count() == 1
    assert notification_count(return_case) == original_notifications
    assert return_case.events.count() == original_events
    assert update_status(
        admin_client, return_case, "REFUNDED", approved_refund_amount="1.00",
    ).status_code == 400
    assert update_status(admin_client, return_case, "APPROVED").status_code == 400


def test_partial_refund_preserves_original_payment_and_closes_only_after_refund(
    return_case, admin_client, seller_client,
):
    fully_inspect(admin_client, seller_client, return_case)
    response = update_status(
        admin_client, return_case, "REFUNDED", approved_refund_amount="50000.00",
    )
    assert response.status_code == 200, response.data
    payment = Payment.objects.get(order=return_case.order_item.order)
    assert payment.status == Payment.Status.PARTIALLY_REFUNDED
    assert payment.amount == Decimal("170000.00")
    assert payment.refunded_amount == Decimal("50000.00")
    assert payment.refundable_amount == Decimal("120000.00")
    assert update_status(admin_client, return_case, "CLOSED").status_code == 200
    assert update_status(admin_client, return_case, "INSPECTED").status_code == 400


def test_customer_and_foreign_seller_cannot_confirm_physical_events(
    return_case, admin_client, customer_client,
):
    approve(admin_client, return_case)
    foreign_user = User.objects.create_user(
        email="foreign-return@example.test", username="foreign-return", role=User.Role.SELLER,
    )
    SellerProfile.objects.create(
        user=foreign_user, business_name="Otro vendedor", tax_id="RETURN-FOREIGN", is_active=True,
    )
    foreign_client = APIClient()
    foreign_client.force_authenticate(user=foreign_user)

    assert receive(customer_client, return_case, 2).status_code == 403
    assert inspect(customer_client, return_case, 0, 2).status_code == 403
    assert receive(foreign_client, return_case, 2).status_code == 404
    assert inspect(foreign_client, return_case, 0, 2).status_code == 404
    assert update_status(foreign_client, return_case, "REFUNDED").status_code == 403
    assert update_status(customer_client, return_case, "REFUNDED").status_code == 403


def test_public_receipt_details_exclude_internal_notes_and_actor_emails(
    return_case, admin_client, seller_client, customer_client, admin_user,
):
    approve(admin_client, return_case)
    response = receive(
        admin_client, return_case, 2, prefix="admin", note="Recepción interna reservada.",
    )
    assert response.status_code == 200
    response = inspect(
        admin_client, return_case, 0, 2, prefix="admin", note="Inspección interna reservada.",
    )
    assert response.status_code == 200
    for client, path in [
        (customer_client, "/api/v1/users/me/returns/"),
        (seller_client, "/api/v1/seller/returns/"),
    ]:
        result = client.get(path)
        assert result.status_code == 200
        assert result.data[0]["inspection"]["defective_quantity"] == 2
        assert "admin_note" not in result.data[0]
        assert "resolved_by_email" not in result.data[0]
        assert "reservada" not in result.content.decode()
        assert admin_user.email not in result.content.decode()


def test_stale_approval_cannot_reopen_a_rejected_return(return_case, admin_client, admin_user):
    from types import SimpleNamespace

    stale = ReturnRequestStatusUpdateSerializer(
        instance=return_case, data={"status": "APPROVED"}, partial=True,
        context={"request": SimpleNamespace(user=admin_user)},
    )
    stale.is_valid(raise_exception=True)
    assert update_status(admin_client, return_case, "REJECTED").status_code == 200

    with pytest.raises(serializers.ValidationError):
        stale.save()
    return_case.refresh_from_db()
    assert return_case.status == ReturnRequest.Status.REJECTED
    assert not ReturnInspection.objects.filter(return_request=return_case).exists()


def test_a_legacy_approval_requires_explicit_new_receipt_before_refunding(
    return_case, admin_client, seller_client, product,
):
    ReturnRequest.objects.filter(pk=return_case.pk).update(status=ReturnRequest.Status.APPROVED)
    assert not ReturnInspection.objects.filter(return_request=return_case).exists()
    assert update_status(admin_client, return_case, "REFUNDED").status_code == 400

    response = receive(seller_client, return_case, 2)

    assert response.status_code == 200, response.data
    assert response.data["inspection"]["received_quantity"] == 2
    assert response.data["inspection"]["restocked_quantity"] == 0
    assert response.data["status"] == "PRODUCT_RECEIVED"
    product.refresh_from_db()
    assert product.stock == 8


def test_cancellation_and_return_cannot_handle_the_same_products(
    customer_client, seller_client, product, address, customer_user,
):
    customer_client.post(
        "/api/v1/cart/items/", {"product_id": product.pk, "quantity": 1}, format="json",
    )
    checkout = checkout_with_quote(customer_client, {"address_id": address.pk, "payment_method": "SIMULATED_CARD"})
    order = Order.objects.get(pk=checkout.data["id"])
    shipment = Shipment.objects.get(order=order)
    seller_client.patch(
        f"/api/v1/seller/shipments/{shipment.pk}/status/", {"status": "DELIVERED"}, format="json",
    )
    CancellationRequest.objects.create(
        shipment=shipment, user=customer_user, status="REQUESTED", reason="Solicitud creada antes de la entrega.",
    )

    response = customer_client.post(
        f"/api/v1/order-items/{order.items.get().pk}/returns/",
        {"reason": "DEFECTIVE_PRODUCT", "description": "Solicitud sobre una compra ya en cancelación.", "quantity": 1},
        format="json",
    )

    assert response.status_code == 400
    assert not ReturnRequest.objects.filter(order_item__order=order).exists()


@pytest.mark.django_db(transaction=True)
def test_concurrent_refund_requests_create_one_ledger_and_notification(
    return_case, admin_client, seller_client, admin_user, monkeypatch,
):
    if connection.vendor != "postgresql":
        pytest.skip("La coordinación del reembolso se comprueba con PostgreSQL.")
    fully_inspect(admin_client, seller_client, return_case)
    before = notification_count(return_case)
    barrier = Barrier(2)
    original_validate = ReturnRequestStatusUpdateSerializer.validate

    def together(self, attrs):
        result = original_validate(self, attrs)
        barrier.wait(timeout=15)
        return result

    monkeypatch.setattr(ReturnRequestStatusUpdateSerializer, "validate", together)

    def submit(_):
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(user=User.objects.get(pk=admin_user.pk))
            return update_status(client, return_case, "REFUNDED").status_code
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        statuses = list(executor.map(submit, range(2)))

    assert statuses == [200, 200]
    assert PaymentRefund.objects.filter(return_request=return_case).count() == 1
    assert notification_count(return_case) == before + 1
