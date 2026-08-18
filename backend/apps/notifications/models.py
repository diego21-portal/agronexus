from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.core.models import TimeStampedModel


class Notification(TimeStampedModel):
    class NotificationType(models.TextChoices):
        ORDER_CREATED = "ORDER_CREATED", "Pedido creado"
        ORDER_STATUS_CHANGED = "ORDER_STATUS_CHANGED", "Estado de pedido actualizado"
        SHIPMENT_UPDATED = "SHIPMENT_UPDATED", "Envío actualizado"
        QUESTION_CREATED = "QUESTION_CREATED", "Pregunta creada"
        QUESTION_ANSWERED = "QUESTION_ANSWERED", "Pregunta respondida"
        COMPLAINT_CREATED = "COMPLAINT_CREATED", "Reclamo creado"
        COMPLAINT_RESOLVED = "COMPLAINT_RESOLVED", "Reclamo resuelto"
        RETURN_REQUESTED = "RETURN_REQUESTED", "Devolución solicitada"
        RETURN_UPDATED = "RETURN_UPDATED", "Devolución actualizada"
        STOCK_LOW = "STOCK_LOW", "Stock bajo"
        PRODUCT_OUT_OF_STOCK = "PRODUCT_OUT_OF_STOCK", "Producto agotado"
        SYSTEM = "SYSTEM", "Sistema"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
        verbose_name="Usuario",
    )
    notification_type = models.CharField(
        max_length=40,
        choices=NotificationType.choices,
        default=NotificationType.SYSTEM,
        verbose_name="Tipo de notificación",
    )
    title = models.CharField(
        max_length=160,
        verbose_name="Título",
    )
    message = models.TextField(
        verbose_name="Mensaje",
    )
    is_read = models.BooleanField(
        default=False,
        verbose_name="Leída",
    )
    read_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Fecha de lectura",
    )
    related_object_type = models.CharField(
        max_length=80,
        blank=True,
        verbose_name="Tipo de objeto relacionado",
    )
    related_object_id = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name="ID del objeto relacionado",
    )
    action_url = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="URL de acción",
    )

    class Meta:
        verbose_name = "Notificación"
        verbose_name_plural = "Notificaciones"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "is_read", "created_at"]),
            models.Index(fields=["notification_type"]),
            models.Index(fields=["related_object_type", "related_object_id"]),
        ]

    def mark_as_read(self):
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=["is_read", "read_at", "updated_at"])

    def __str__(self):
        return f"{self.user.email} - {self.title}"