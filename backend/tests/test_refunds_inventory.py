from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Barrier
from types import SimpleNamespace

import pytest
from django.db import close_old_connections, connection
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.aftersales.inventory import inspect_receipt, record_receipt
from apps.aftersales.models import CancellationRequest, ReturnInspection
from apps.complaints.models import ReturnRequest
from apps.orders.models import Order, OrderItem
from apps.payments.models import Payment, PaymentRefund
from apps.payments.serializers import PaymentSerializer
from apps.payments.services import refund_item, refund_shipping
from apps.products.models import StockMovement
from apps.shipments.models import Shipment
from apps.users.models import User


pytestmark = pytest.mark.django_db


@pytest.fixture
def financial_purchase(customer_user, seller_profile, product, address):
    # Prices are purchase snapshots, deliberately different from the catalog.
    order = Order.objects.create(
        user=customer_user, shipping_address=address, status=Order.Status.PAID,
        subtotal="300.00", shipping_cost="30.00", total="330.00",
    )
    item = OrderItem.objects.create(
        order=order, product=product, seller=seller_profile,
        product_name=product.name, sku=product.sku,
        quantity=3, unit_price="100.00", total_price="300.00",
    )
    payment = Payment.objects.create(
        order=order, payment_method=Payment.PaymentMethod.SIMULATED_CARD,
        status=Payment.Status.APPROVED, amount="330.00",
    )
    shipment = Shipment.objects.create(order=order, seller=seller_profile, status=Shipment.Status.IN_TRANSIT)
    cancellation = CancellationRequest.objects.create(
        shipment=shipment, user=customer_user, status=CancellationRequest.Status.INSPECTED,
        reason="Cancelación de la compra durante el transporte.",
    )
    inspection = ReturnInspection.objects.create(
        cancellation_request=cancellation, order_item=item, expected_quantity=3,
    )
    # Refresh Decimal values initialized from string arguments.
    item.refresh_from_db()
    payment.refresh_from_db()
    return SimpleNamespace(
        order=order, item=item, payment=payment, shipment=shipment,
        cancellation=cancellation, inspection=inspection, product=product,
    )


def test_partial_refund_preserves_original_payment_and_has_private_audit(financial_purchase, admin_user):
    purchase = financial_purchase
    refund = refund_item(
        purchase.item, "100.00", admin_user, cancellation_request=purchase.cancellation,
        reason="Nota interna financiera que no debe salir al comprador.",
    )
    purchase.payment.refresh_from_db()

    assert refund.amount == Decimal("100.00")
    assert purchase.payment.amount == Decimal("330.00")
    assert purchase.payment.status == Payment.Status.PARTIALLY_REFUNDED
    assert purchase.payment.refunded_amount == Decimal("100.00")
    assert purchase.payment.refundable_amount == Decimal("230.00")
    public = PaymentSerializer(purchase.payment).data
    assert public["refunded_amount"] == "100.00"
    assert public["refundable_amount"] == "230.00"
    assert "created_by" not in public["refunds"][0]
    assert "reason" not in public["refunds"][0]
    assert "Nota interna" not in str(public)


def test_refund_retry_with_a_new_key_still_has_only_one_source_entry(financial_purchase, admin_user):
    purchase = financial_purchase
    first = refund_item(purchase.item, "150.00", admin_user, cancellation_request=purchase.cancellation, operation_key="first-click")
    second = refund_item(purchase.item, "150.00", admin_user, cancellation_request=purchase.cancellation, operation_key="browser-retry")

    assert first.pk == second.pk
    assert PaymentRefund.objects.count() == 1
    with pytest.raises(ValidationError):
        refund_item(purchase.item, "160.00", admin_user, cancellation_request=purchase.cancellation)
    assert PaymentRefund.objects.count() == 1


def test_product_refund_uses_bought_price_and_rejects_excess(financial_purchase, admin_user):
    purchase = financial_purchase
    with pytest.raises(ValidationError):
        refund_item(purchase.item, "300.01", admin_user, cancellation_request=purchase.cancellation)
    assert not PaymentRefund.objects.exists()
    purchase.payment.refresh_from_db()
    assert purchase.payment.status == Payment.Status.APPROVED


@pytest.mark.parametrize("amount", ["-1", "NaN", "Infinity", "1.001", "10000000000", "1e99999"])
def test_invalid_refund_amounts_are_controlled_errors(financial_purchase, admin_user, amount):
    with pytest.raises(ValidationError):
        refund_item(financial_purchase.item, amount, admin_user, cancellation_request=financial_purchase.cancellation)
    assert not PaymentRefund.objects.exists()


def test_cancellation_and_return_share_the_item_refund_budget(financial_purchase, customer_user, admin_user):
    purchase = financial_purchase
    refund_item(purchase.item, "200.00", admin_user, cancellation_request=purchase.cancellation)
    record = ReturnRequest.objects.create(
        user=customer_user, order_item=purchase.item, quantity=2,
        status="INSPECTED", reason=ReturnRequest.Reason.DEFECTIVE_PRODUCT,
        description="Solicitud posterior que comparte el presupuesto del ítem.",
    )

    with pytest.raises(ValidationError):
        refund_item(purchase.item, "101.00", admin_user, return_request=record)
    refund_item(purchase.item, "100.00", admin_user, return_request=record)
    assert purchase.payment.refunded_amount == Decimal("300.00")
    assert purchase.payment.refundable_amount == Decimal("30.00")


def test_return_cannot_refund_more_than_its_own_requested_units(financial_purchase, customer_user, admin_user):
    purchase = financial_purchase
    record = ReturnRequest.objects.create(
        user=customer_user, order_item=purchase.item, quantity=1,
        status="INSPECTED", reason=ReturnRequest.Reason.DEFECTIVE_PRODUCT,
        description="Una unidad autorizada para devolución.",
    )
    with pytest.raises(ValidationError):
        refund_item(purchase.item, "100.01", admin_user, return_request=record)
    assert not PaymentRefund.objects.exists()


def test_payment_budget_also_limits_refunds(financial_purchase, admin_user):
    purchase = financial_purchase
    # Legacy discounts or imported purchases may have a smaller payment.
    purchase.payment.amount = Decimal("200.00")
    purchase.payment.save(update_fields=["amount"])
    with pytest.raises(ValidationError):
        refund_item(purchase.item, "200.01", admin_user, cancellation_request=purchase.cancellation)
    assert not PaymentRefund.objects.exists()


@pytest.mark.parametrize("review_required", [False, True])
def test_legacy_refunded_payment_without_ledger_cannot_be_refunded_again(financial_purchase, admin_user, review_required):
    purchase = financial_purchase
    purchase.payment.status = Payment.Status.REFUNDED
    purchase.payment.refund_review_required = review_required
    purchase.payment.save(update_fields=["status", "refund_review_required"])

    with pytest.raises(ValidationError):
        refund_item(purchase.item, "100.00", admin_user, cancellation_request=purchase.cancellation)
    assert not PaymentRefund.objects.exists()
    if review_required:
        assert purchase.payment.refundable_amount == Decimal("0.00")


def test_legacy_review_flag_blocks_new_refunds_but_keeps_existing_retry_idempotent(financial_purchase, admin_user):
    purchase = financial_purchase
    existing = refund_item(purchase.item, "100.00", admin_user, cancellation_request=purchase.cancellation)
    purchase.payment.refund_review_required = True
    purchase.payment.save(update_fields=["refund_review_required"])
    replay = refund_item(purchase.item, "100.00", admin_user, cancellation_request=purchase.cancellation)
    assert replay.pk == existing.pk
    assert PaymentRefund.objects.count() == 1
    assert purchase.payment.refundable_amount == Decimal("0.00")
    purchase.cancellation.status = CancellationRequest.Status.COMPLETED
    purchase.cancellation.save(update_fields=["status"])
    with pytest.raises(ValidationError):
        refund_shipping(purchase.order, admin_user, "30.00", "legacy-review-shipping", purchase.cancellation, "Revisión pendiente")


def test_customer_can_only_trigger_the_own_pre_dispatch_cancellation_refund(financial_purchase, customer_user, seller_user):
    purchase = financial_purchase
    for user in [customer_user, seller_user]:
        with pytest.raises(PermissionDenied):
            refund_item(purchase.item, "100.00", user, cancellation_request=purchase.cancellation)
    purchase.cancellation.is_pre_dispatch = True
    purchase.cancellation.status = CancellationRequest.Status.COMPLETED
    purchase.cancellation.save(update_fields=["is_pre_dispatch", "status"])

    refund_item(purchase.item, "300.00", customer_user, cancellation_request=purchase.cancellation)
    assert PaymentRefund.objects.count() == 1


def test_admin_shipping_refund_is_separate_bounded_and_retryable(financial_purchase, admin_user, customer_user):
    purchase = financial_purchase
    purchase.cancellation.status = CancellationRequest.Status.COMPLETED
    purchase.cancellation.save(update_fields=["status"])
    with pytest.raises(PermissionDenied):
        refund_shipping(purchase.order, customer_user, "30.00", "shipping-denied", purchase.cancellation, "Revisión del envío")
    first = refund_shipping(purchase.order, admin_user, "20.00", "shipping-first", purchase.cancellation, "Reembolso autorizado del envío")
    replay = refund_shipping(purchase.order, admin_user, "20.00", "shipping-first", purchase.cancellation, "Reintento")
    assert replay.pk == first.pk
    with pytest.raises(ValidationError):
        refund_shipping(purchase.order, admin_user, "10.01", "shipping-over", purchase.cancellation, "Supera el costo restante")
    refund_shipping(purchase.order, admin_user, "10.00", "shipping-rest", purchase.cancellation, "Costo restante")
    refund_item(purchase.item, "300.00", admin_user, cancellation_request=purchase.cancellation)
    purchase.payment.refresh_from_db()
    assert purchase.payment.status == Payment.Status.REFUNDED
    assert purchase.payment.refunded_amount == Decimal("330.00")
    assert purchase.payment.amount == Decimal("330.00")


def test_receipt_quarantines_units_without_stock_or_money_changes(financial_purchase, seller_user):
    purchase = financial_purchase
    inspection = record_receipt(inspection_id=purchase.inspection.pk, received_quantity=3, user=seller_user)
    purchase.product.refresh_from_db()

    assert inspection.received_quantity == 3
    assert inspection.quarantined_quantity == 3
    assert purchase.product.stock == 10
    assert not StockMovement.objects.filter(order_item=purchase.item).exists()
    assert not PaymentRefund.objects.exists()


def test_defective_inspection_never_adds_available_stock(financial_purchase, seller_user):
    purchase = financial_purchase
    record_receipt(inspection_id=purchase.inspection.pk, received_quantity=3, user=seller_user)
    inspection = inspect_receipt(
        inspection_id=purchase.inspection.pk, restocked_quantity=0, defective_quantity=3,
        user=seller_user, note="Las tres unidades presentan fallas y quedan fuera de venta.",
    )
    purchase.product.refresh_from_db()
    assert inspection.defective_quantity == 3
    assert inspection.quarantined_quantity == 0
    assert purchase.product.stock == 10
    assert not StockMovement.objects.filter(order_item=purchase.item).exists()


def test_partial_receipt_and_inspection_only_restock_new_saleable_units(financial_purchase, seller_user):
    purchase = financial_purchase
    record_receipt(inspection_id=purchase.inspection.pk, received_quantity=1, user=seller_user)
    inspect_receipt(inspection_id=purchase.inspection.pk, restocked_quantity=1, defective_quantity=0, user=seller_user, note="Primera unidad en buen estado.")
    record_receipt(inspection_id=purchase.inspection.pk, received_quantity=3, user=seller_user)
    inspected = inspect_receipt(inspection_id=purchase.inspection.pk, restocked_quantity=2, defective_quantity=1, user=seller_user, note="Una segunda unidad apta y otra defectuosa.")
    repeated = inspect_receipt(inspection_id=purchase.inspection.pk, restocked_quantity=2, defective_quantity=1, user=seller_user, note="Reintento")
    purchase.product.refresh_from_db()

    assert inspected.pk == repeated.pk
    assert purchase.product.stock == 12
    movements = StockMovement.objects.filter(order_item=purchase.item, movement_type=StockMovement.MovementType.RETURN)
    assert list(movements.order_by("pk").values_list("quantity", flat=True)) == [1, 1]
    assert inspected.quarantined_quantity == 0


def test_receipt_and_inspection_bounds_cannot_be_bypassed(financial_purchase, seller_user):
    purchase = financial_purchase
    with pytest.raises(ValidationError):
        record_receipt(inspection_id=purchase.inspection.pk, received_quantity=4, user=seller_user)
    record_receipt(inspection_id=purchase.inspection.pk, received_quantity=2, user=seller_user)
    with pytest.raises(ValidationError):
        record_receipt(inspection_id=purchase.inspection.pk, received_quantity=1, user=seller_user)
    with pytest.raises(ValidationError):
        inspect_receipt(inspection_id=purchase.inspection.pk, restocked_quantity=2, defective_quantity=1, user=seller_user, note="Exceso")
    with pytest.raises(ValidationError):
        inspect_receipt(inspection_id=purchase.inspection.pk, restocked_quantity=2, defective_quantity=0, user=seller_user, note="")
    purchase.product.refresh_from_db()
    assert purchase.product.stock == 10


def test_customer_cannot_confirm_physical_receipt_or_inspection(financial_purchase, customer_user):
    purchase = financial_purchase
    with pytest.raises(PermissionDenied):
        record_receipt(inspection_id=purchase.inspection.pk, received_quantity=3, user=customer_user)
    with pytest.raises(PermissionDenied):
        inspect_receipt(inspection_id=purchase.inspection.pk, restocked_quantity=3, defective_quantity=0, user=customer_user, note="No autorizado")


@pytest.mark.django_db(transaction=True)
def test_concurrent_refunds_cannot_exhaust_the_same_item_twice(financial_purchase, admin_user):
    if connection.vendor != "postgresql":
        pytest.skip("La concurrencia de reembolsos requiere PostgreSQL.")
    purchase = financial_purchase
    barrier = Barrier(2)

    def submit(_):
        close_old_connections()
        try:
            user = User.objects.get(pk=admin_user.pk)
            item = OrderItem.objects.get(pk=purchase.item.pk)
            case = CancellationRequest.objects.get(pk=purchase.cancellation.pk)
            barrier.wait(timeout=15)
            result = refund_item(item, "300.00", user, cancellation_request=case)
            return result.pk
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(submit, [0, 1]))
    assert results[0] == results[1]
    assert PaymentRefund.objects.count() == 1
    assert purchase.payment.refunded_amount == Decimal("300.00")


@pytest.mark.django_db(transaction=True)
def test_concurrent_refunds_for_different_items_share_the_payment_budget(financial_purchase, admin_user):
    if connection.vendor != "postgresql":
        pytest.skip("La concurrencia de reembolsos requiere PostgreSQL.")
    purchase = financial_purchase
    second = OrderItem.objects.create(
        order=purchase.order, product=purchase.product, seller=purchase.item.seller,
        product_name="Segundo ítem de una compra con descuento global", sku="SECOND-DISCOUNTED",
        quantity=3, unit_price="100.00", total_price="300.00",
    )
    # The global discount means each item's standalone budget is not enough
    # to enforce the total amount actually paid.
    purchase.order.subtotal = Decimal("600.00")
    purchase.order.discount_total = Decimal("300.00")
    purchase.order.save(update_fields=["subtotal", "discount_total"])
    barrier = Barrier(2)

    def submit(item_id):
        close_old_connections()
        try:
            user = User.objects.get(pk=admin_user.pk)
            item = OrderItem.objects.get(pk=item_id)
            case = CancellationRequest.objects.get(pk=purchase.cancellation.pk)
            barrier.wait(timeout=15)
            try:
                refund_item(item, "200.00", user, cancellation_request=case)
                return "refunded"
            except ValidationError:
                return "budget_exhausted"
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(submit, [purchase.item.pk, second.pk]))
    assert sorted(results) == ["budget_exhausted", "refunded"]
    assert PaymentRefund.objects.count() == 1
    assert purchase.payment.refunded_amount == Decimal("200.00")
    assert purchase.payment.refundable_amount == Decimal("130.00")


@pytest.mark.django_db(transaction=True)
def test_concurrent_inspections_restock_only_once(financial_purchase, seller_user):
    if connection.vendor != "postgresql":
        pytest.skip("La concurrencia de inventario requiere PostgreSQL.")
    purchase = financial_purchase
    record_receipt(inspection_id=purchase.inspection.pk, received_quantity=3, user=seller_user)
    barrier = Barrier(2)

    def submit(_):
        close_old_connections()
        try:
            user = User.objects.get(pk=seller_user.pk)
            barrier.wait(timeout=15)
            return inspect_receipt(
                inspection_id=purchase.inspection.pk, restocked_quantity=3, defective_quantity=0,
                user=user, note="Tres unidades verificadas y aptas.",
            ).pk
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(submit, [0, 1]))
    assert results[0] == results[1]
    purchase.product.refresh_from_db()
    assert purchase.product.stock == 13
    assert StockMovement.objects.filter(order_item=purchase.item).count() == 1
