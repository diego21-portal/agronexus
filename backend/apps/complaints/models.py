from decimal import Decimal

from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel
from apps.orders.models import Order, OrderItem


class Complaint(TimeStampedModel):
    class ComplaintType(models.TextChoices):
        PRODUCT_PROBLEM = "PRODUCT_PROBLEM", "Problema con el producto"
        SHIPPING_PROBLEM = "SHIPPING_PROBLEM", "Problema con el envío"
        PAYMENT_PROBLEM = "PAYMENT_PROBLEM", "Problema con el pago"
        SELLER_PROBLEM = "SELLER_PROBLEM", "Problema con el vendedor"
        GENERAL = "GENERAL", "Reclamo general"
        OTHER = "OTHER", "Otro"

    class Status(models.TextChoices):
        OPEN = "OPEN", "Abierto"
        IN_REVIEW = "IN_REVIEW", "En revisión"
        WAITING_CUSTOMER = "WAITING_CUSTOMER", "Esperando respuesta del cliente"
        RESOLVED = "RESOLVED", "Resuelto"
        REJECTED = "REJECTED", "Rechazado"
        CLOSED = "CLOSED", "Cerrado"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="complaints",
        verbose_name="Cliente",
    )
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="complaints",
        verbose_name="Orden",
    )
    order_item = models.ForeignKey(
        OrderItem,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="complaints",
        verbose_name="Ítem de orden",
    )
    complaint_type = models.CharField(
        max_length=30,
        choices=ComplaintType.choices,
        verbose_name="Tipo de reclamo",
    )
    title = models.CharField(
        max_length=160,
        verbose_name="Título",
    )
    description = models.TextField(
        verbose_name="Descripción",
    )
    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.OPEN,
        verbose_name="Estado",
    )
    admin_note = models.TextField(
        blank=True,
        verbose_name="Nota interna del administrador",
    )
    resolution = models.TextField(
        blank=True,
        verbose_name="Resolución",
    )
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="resolved_complaints",
        verbose_name="Resuelto por",
    )
    resolved_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Fecha de resolución",
    )

    class Meta:
        verbose_name = "Reclamo"
        verbose_name_plural = "Reclamos"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "status"]),
            models.Index(fields=["order", "status"]),
            models.Index(fields=["status"]),
            models.Index(fields=["complaint_type"]),
        ]

    def __str__(self):
        return f"{self.order.order_number} - {self.title}"


class ReturnRequest(TimeStampedModel):
    class Reason(models.TextChoices):
        DEFECTIVE_PRODUCT = "DEFECTIVE_PRODUCT", "Producto defectuoso"
        WRONG_PRODUCT = "WRONG_PRODUCT", "Producto incorrecto"
        DAMAGED_SHIPPING = "DAMAGED_SHIPPING", "Producto dañado en envío"
        NOT_AS_DESCRIBED = "NOT_AS_DESCRIBED", "No coincide con la descripción"
        CUSTOMER_REGRET = "CUSTOMER_REGRET", "Arrepentimiento de compra"
        OTHER = "OTHER", "Otro"

    class Status(models.TextChoices):
        REQUESTED = "REQUESTED", "Solicitada"
        IN_REVIEW = "IN_REVIEW", "En revisión"
        APPROVED = "APPROVED", "Aprobada"
        REJECTED = "REJECTED", "Rechazada"
        PRODUCT_RECEIVED = "PRODUCT_RECEIVED", "Producto recibido"
        REFUNDED = "REFUNDED", "Reembolsada"
        CLOSED = "CLOSED", "Cerrada"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="return_requests",
        verbose_name="Cliente",
    )
    order_item = models.OneToOneField(
        OrderItem,
        on_delete=models.CASCADE,
        related_name="return_request",
        verbose_name="Ítem de orden",
    )
    reason = models.CharField(
        max_length=40,
        choices=Reason.choices,
        verbose_name="Motivo",
    )
    description = models.TextField(
        verbose_name="Descripción",
    )
    quantity = models.PositiveIntegerField(
        default=1,
        verbose_name="Cantidad a devolver",
    )
    requested_refund_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="Monto solicitado",
    )
    approved_refund_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="Monto aprobado",
    )
    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.REQUESTED,
        verbose_name="Estado",
    )
    admin_note = models.TextField(
        blank=True,
        verbose_name="Nota interna del administrador",
    )
    resolution = models.TextField(
        blank=True,
        verbose_name="Resolución",
    )
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="resolved_return_requests",
        verbose_name="Resuelto por",
    )
    resolved_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Fecha de resolución",
    )

    class Meta:
        verbose_name = "Solicitud de devolución"
        verbose_name_plural = "Solicitudes de devolución"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "status"]),
            models.Index(fields=["status"]),
            models.Index(fields=["reason"]),
        ]

    def __str__(self):
        return f"Devolución {self.order_item.order.order_number} - {self.status}"