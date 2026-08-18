import uuid

from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel
from apps.orders.models import Order


class Shipment(TimeStampedModel):
    class Status(models.TextChoices):
        CREATED = "CREATED", "Creado"
        PREPARING = "PREPARING", "En preparación"
        DISPATCHED = "DISPATCHED", "Despachado"
        IN_TRANSIT = "IN_TRANSIT", "En camino"
        IN_DISTRIBUTION_CENTER = "IN_DISTRIBUTION_CENTER", "En centro de distribución"
        OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY", "En reparto"
        DELIVERED = "DELIVERED", "Entregado"
        DELIVERY_PROBLEM = "DELIVERY_PROBLEM", "Problema de entrega"
        CANCELLED = "CANCELLED", "Cancelado"

    order = models.OneToOneField(
        Order,
        on_delete=models.CASCADE,
        related_name="shipment",
        verbose_name="Orden",
    )
    tracking_code = models.CharField(
        max_length=80,
        unique=True,
        blank=True,
        verbose_name="Código de seguimiento",
    )
    status = models.CharField(
        max_length=40,
        choices=Status.choices,
        default=Status.CREATED,
        verbose_name="Estado",
    )
    carrier = models.CharField(
        max_length=120,
        blank=True,
        verbose_name="Transportista",
    )
    estimated_delivery_date = models.DateField(
        null=True,
        blank=True,
        verbose_name="Fecha estimada de entrega",
    )
    delivered_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Fecha de entrega",
    )

    class Meta:
        verbose_name = "Envío"
        verbose_name_plural = "Envíos"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["tracking_code"]),
            models.Index(fields=["status"]),
        ]

    def save(self, *args, **kwargs):
        if not self.tracking_code:
            self.tracking_code = f"TRK-{uuid.uuid4().hex[:12].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.tracking_code} - {self.status}"


class ShipmentEvent(TimeStampedModel):
    shipment = models.ForeignKey(
        Shipment,
        on_delete=models.CASCADE,
        related_name="events",
        verbose_name="Envío",
    )
    status = models.CharField(
        max_length=40,
        choices=Shipment.Status.choices,
        verbose_name="Estado",
    )
    description = models.CharField(
        max_length=255,
        verbose_name="Descripción",
    )
    location = models.CharField(
        max_length=120,
        blank=True,
        verbose_name="Ubicación",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="shipment_events",
        verbose_name="Usuario responsable",
    )

    class Meta:
        verbose_name = "Evento de envío"
        verbose_name_plural = "Eventos de envío"
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.shipment.tracking_code} - {self.status}"