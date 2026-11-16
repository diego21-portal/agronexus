"""Append-only simulated refunds, coordinated by the purchase lock."""

from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Sum
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.orders.models import Order, OrderItem

from .models import Payment, PaymentRefund


def _amount(value):
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError({"amount": "Indica un importe válido."})
    if (
        not amount.is_finite() or amount < 0 or amount > Decimal("9999999999.99")
        or amount != amount.quantize(Decimal("0.01"))
    ):
        raise ValidationError({"amount": "El importe debe ser no negativo y tener hasta dos decimales."})
    return amount


def _is_admin(user):
    return bool(
        user and user.is_authenticated and user.is_active
        and user.effective_role in {"ADMIN", "SUPER_ADMIN"}
    )


def _source(order, order_item, user, cancellation_request, return_request):
    if (cancellation_request is None) == (return_request is None):
        raise ValidationError("El reembolso debe pertenecer a una cancelación o devolución.")
    if not user or not user.is_authenticated or not user.is_active:
        raise PermissionDenied("No puedes registrar este reembolso.")

    if cancellation_request is not None:
        from apps.aftersales.models import CancellationRequest

        source = (
            CancellationRequest.objects.select_for_update(of=("self",))
            .select_related("shipment").get(pk=cancellation_request.pk)
        )
        if source.shipment.order_id != order.pk or source.shipment.seller_id != order_item.seller_id:
            raise ValidationError("La cancelación no corresponde al producto comprado.")
        allowed_states = {"REQUESTED", "COMPLETED"} if source.is_pre_dispatch else {"INSPECTED", "COMPLETED"}
        source_ready = source.status in allowed_states
        customer_pre_dispatch = source.is_pre_dispatch and order.user_id == user.pk
        item_cap = order_item.unit_price * order_item.quantity
    else:
        from apps.complaints.models import ReturnRequest

        source = ReturnRequest.objects.select_for_update().get(pk=return_request.pk)
        if source.order_item_id != order_item.pk:
            raise ValidationError("La devolución no corresponde al producto comprado.")
        source_ready = source.status in {"INSPECTED", "REFUNDED"}
        customer_pre_dispatch = False
        item_cap = order_item.unit_price * source.quantity

    if not (_is_admin(user) or customer_pre_dispatch):
        raise PermissionDenied("Solo administración puede autorizar este reembolso.")
    if item_cap < 0:
        raise ValidationError("La compra contiene importes históricos inválidos y requiere revisión.")
    return source, item_cap, source_ready


def _sum(queryset):
    return queryset.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")


def _sync_status(payment):
    refunded = _sum(payment.refunds.all())
    payment.status = (
        Payment.Status.REFUNDED if refunded == payment.amount
        else Payment.Status.PARTIALLY_REFUNDED if refunded > 0
        else Payment.Status.APPROVED
    )
    payment.save(update_fields=["status", "updated_at"])


def _check_payment(payment, amount):
    refunded = _sum(payment.refunds.all())
    if payment.refund_review_required or (
        payment.status == Payment.Status.REFUNDED and refunded != payment.amount
    ):
        raise ValidationError("Los reembolsos históricos de esta compra requieren revisión antes de continuar.")
    if payment.status not in {
        Payment.Status.APPROVED, Payment.Status.PARTIALLY_REFUNDED, Payment.Status.REFUNDED,
    }:
        raise ValidationError("Solo se puede reembolsar un pago aprobado.")
    if payment.amount < 0 or refunded + amount > payment.amount:
        raise ValidationError({"amount": "El reembolso supera el saldo disponible del pago."})


def _existing(existing, *, amount, payment, order_item, cancellation_request, return_request, kind):
    if existing is None:
        return None
    if (
        existing.amount != amount or existing.payment_id != payment.pk
        or existing.order_item_id != (order_item.pk if order_item else None)
        or existing.cancellation_request_id != (cancellation_request.pk if cancellation_request else None)
        or existing.return_request_id != (return_request.pk if return_request else None)
        or existing.kind != kind
    ):
        raise ValidationError("La operación ya fue registrada con otros datos.")
    return existing


@transaction.atomic
def refund_item(order_item, amount, user, cancellation_request=None, return_request=None, operation_key=None, reason=""):
    amount = _amount(amount)
    order = Order.objects.select_for_update().get(pk=order_item.order_id)
    order_item = OrderItem.objects.select_related("seller__user").get(pk=order_item.pk, order=order)
    payment = Payment.objects.select_for_update().filter(order=order).first()
    if payment is None:
        raise ValidationError("La compra no tiene un pago registrado.")
    source, source_cap, source_ready = _source(order, order_item, user, cancellation_request, return_request)
    cancellation_request = source if cancellation_request is not None else None
    return_request = source if return_request is not None else None
    source_lookup = {"cancellation_request": cancellation_request} if cancellation_request else {"return_request": return_request}
    existing = PaymentRefund.objects.filter(
        payment=payment, order_item=order_item, kind=PaymentRefund.Kind.PRODUCT, **source_lookup,
    ).first()
    if operation_key:
        key_record = PaymentRefund.objects.filter(operation_key=operation_key).first()
        _existing(
            key_record, amount=amount, payment=payment, order_item=order_item,
            cancellation_request=cancellation_request, return_request=return_request,
            kind=PaymentRefund.Kind.PRODUCT,
        )
        existing = existing or key_record
    result = _existing(
        existing, amount=amount, payment=payment, order_item=order_item,
        cancellation_request=cancellation_request, return_request=return_request,
        kind=PaymentRefund.Kind.PRODUCT,
    )
    if result:
        return result

    if not source_ready:
        raise ValidationError("La solicitud debe estar inspeccionada o habilitada para reembolso antes de continuar.")
    if operation_key and len(operation_key) > 160:
        raise ValidationError({"operation_key": "La referencia de operación es demasiado larga."})
    if len(reason) > 255:
        raise ValidationError({"reason": "El motivo no puede superar 255 caracteres."})

    product_cap = order_item.unit_price * order_item.quantity
    already_refunded = _sum(PaymentRefund.objects.filter(order_item=order_item, kind=PaymentRefund.Kind.PRODUCT))
    if amount > source_cap or already_refunded + amount > product_cap:
        raise ValidationError({"amount": "El reembolso supera lo pagado por las unidades compradas."})
    _check_payment(payment, amount)
    if not operation_key:
        label = f"cancellation:{source.pk}" if cancellation_request else f"return:{source.pk}"
        operation_key = f"{label}:item:{order_item.pk}"
    refund = PaymentRefund.objects.create(
        payment=payment, order_item=order_item,
        cancellation_request=cancellation_request, return_request=return_request,
        kind=PaymentRefund.Kind.PRODUCT, amount=amount, operation_key=operation_key,
        reason=reason, created_by=user,
    )
    _sync_status(payment)
    return refund


@transaction.atomic
def refund_shipping(order, user, amount, operation_key, cancellation_request, reason=""):
    if not _is_admin(user):
        raise PermissionDenied("Solo administración puede autorizar el reembolso del envío.")
    amount = _amount(amount)
    order = Order.objects.select_for_update().get(pk=order.pk)
    payment = Payment.objects.select_for_update().filter(order=order).first()
    if payment is None:
        raise ValidationError("La compra no tiene un pago registrado.")
    from apps.aftersales.models import CancellationRequest

    cancellation_request = CancellationRequest.objects.select_for_update().select_related("shipment").get(pk=cancellation_request.pk)
    if cancellation_request.shipment.order_id != order.pk:
        raise ValidationError("La cancelación no pertenece a esta compra.")
    if cancellation_request.status != "COMPLETED":
        raise ValidationError("La cancelación debe estar completada antes de resolver el costo de envío.")
    if not reason.strip():
        raise ValidationError({"reason": "Indica el motivo del reembolso del envío."})
    if len(reason) > 255:
        raise ValidationError({"reason": "El motivo no puede superar 255 caracteres."})
    if not operation_key or len(operation_key) > 160:
        raise ValidationError({"operation_key": "Indica una referencia de operación válida."})
    existing = _existing(
        PaymentRefund.objects.filter(operation_key=operation_key).first(), amount=amount,
        payment=payment, order_item=None, cancellation_request=cancellation_request,
        return_request=None, kind=PaymentRefund.Kind.SHIPPING,
    )
    if existing:
        return existing
    shipping_refunded = _sum(payment.refunds.filter(kind=PaymentRefund.Kind.SHIPPING))
    if order.shipping_cost < 0 or shipping_refunded + amount > order.shipping_cost:
        raise ValidationError({"amount": "El reembolso supera el costo de envío de la compra."})
    _check_payment(payment, amount)
    refund = PaymentRefund.objects.create(
        payment=payment, cancellation_request=cancellation_request,
        kind=PaymentRefund.Kind.SHIPPING, amount=amount,
        operation_key=operation_key, created_by=user, reason=reason.strip(),
    )
    _sync_status(payment)
    return refund
