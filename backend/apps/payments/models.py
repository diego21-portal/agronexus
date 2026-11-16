import uuid
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.db.models import Q, Sum
from django.utils import timezone

from apps.core.models import TimeStampedModel
from apps.orders.models import Order


class Payment(TimeStampedModel):
    class PaymentMethod(models.TextChoices):
        SIMULATED_CARD = "SIMULATED_CARD", "Tarjeta simulada"
        SIMULATED_BANK_TRANSFER = "SIMULATED_BANK_TRANSFER", "Transferencia simulada"
        CASH_ON_DELIVERY = "CASH_ON_DELIVERY", "Pago contra entrega"
        BUSINESS_ACCOUNT = "BUSINESS_ACCOUNT", "Cuenta corriente"
        SIMULATED_MERCADO_PAGO = "SIMULATED_MERCADO_PAGO", "Mercado Pago simulado"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pendiente"
        APPROVED = "APPROVED", "Aprobado"
        REJECTED = "REJECTED", "Rechazado"
        CANCELLED = "CANCELLED", "Cancelado"
        PARTIALLY_REFUNDED = "PARTIALLY_REFUNDED", "Reembolsado parcialmente"
        REFUNDED = "REFUNDED", "Reembolsado"

    order = models.OneToOneField(
        Order,
        on_delete=models.CASCADE,
        related_name="payment",
        verbose_name="Orden",
    )
    payment_method = models.CharField(
        max_length=40,
        choices=PaymentMethod.choices,
        verbose_name="Método de pago",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        verbose_name="Estado",
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        verbose_name="Monto",
    )
    transaction_code = models.CharField(
        max_length=80,
        blank=True,
        verbose_name="Código de transacción",
    )
    paid_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Fecha de pago",
    )
    refund_review_required = models.BooleanField(
        default=False,
        verbose_name="Requiere revisión de reembolsos históricos",
    )

    class Meta:
        verbose_name = "Pago"
        verbose_name_plural = "Pagos"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["transaction_code"]),
        ]

    def approve(self):
        self.status = self.Status.APPROVED
        self.transaction_code = f"SIM-{uuid.uuid4().hex[:12].upper()}"
        self.paid_at = timezone.now()
        self.save(update_fields=["status", "transaction_code", "paid_at", "updated_at"])

    def __str__(self):
        return f"Pago {self.order.order_number} - {self.status}"

    @property
    def refunded_amount(self):
        cached = getattr(self, "_prefetched_objects_cache", {}).get("refunds")
        if cached is not None:
            return sum((refund.amount for refund in cached), Decimal("0.00"))
        return self.refunds.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")

    @property
    def refundable_amount(self):
        refunded = self.refunded_amount
        if self.refund_review_required or (
            self.status == self.Status.REFUNDED and refunded < self.amount
        ):
            return Decimal("0.00")
        return max(self.amount - refunded, Decimal("0.00"))


class PaymentRefund(TimeStampedModel):
    class Kind(models.TextChoices):
        PRODUCT = "PRODUCT", "Productos"
        SHIPPING = "SHIPPING", "Envío"

    payment = models.ForeignKey(Payment, on_delete=models.PROTECT, related_name="refunds")
    order_item = models.ForeignKey(
        "orders.OrderItem", null=True, blank=True,
        on_delete=models.PROTECT, related_name="refunds",
    )
    cancellation_request = models.ForeignKey(
        "aftersales.CancellationRequest", null=True, blank=True,
        on_delete=models.PROTECT, related_name="refunds",
    )
    return_request = models.ForeignKey(
        "complaints.ReturnRequest", null=True, blank=True,
        on_delete=models.PROTECT, related_name="refunds",
    )
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.PRODUCT)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    operation_key = models.CharField(max_length=160, unique=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="created_refunds",
    )
    reason = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["created_at", "id"]
        constraints = [
            models.CheckConstraint(condition=Q(amount__gte=0), name="refund_amount_nonnegative"),
            models.CheckConstraint(
                condition=(
                    Q(cancellation_request__isnull=False, return_request__isnull=True)
                    | Q(cancellation_request__isnull=True, return_request__isnull=False)
                ),
                name="refund_exactly_one_source",
            ),
            models.CheckConstraint(
                condition=(
                    Q(kind="PRODUCT", order_item__isnull=False)
                    | Q(kind="SHIPPING", order_item__isnull=True, cancellation_request__isnull=False)
                ),
                name="refund_kind_matches_item",
            ),
            models.UniqueConstraint(
                fields=["cancellation_request", "order_item"],
                condition=Q(kind="PRODUCT", cancellation_request__isnull=False),
                name="unique_cancellation_item_refund",
            ),
            models.UniqueConstraint(
                fields=["return_request"],
                condition=Q(kind="PRODUCT", return_request__isnull=False),
                name="unique_return_product_refund",
            ),
        ]
