import uuid

from django.db import models
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