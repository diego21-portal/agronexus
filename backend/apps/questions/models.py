from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.core.models import TimeStampedModel
from apps.products.models import Product


class ProductQuestion(TimeStampedModel):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pendiente"
        ANSWERED = "ANSWERED", "Respondida"
        HIDDEN = "HIDDEN", "Oculta"

    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="questions",
        verbose_name="Producto",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="product_questions",
        verbose_name="Usuario que pregunta",
    )
    question = models.TextField(
        verbose_name="Pregunta",
    )
    answer = models.TextField(
        blank=True,
        verbose_name="Respuesta",
    )
    answered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="answered_product_questions",
        verbose_name="Respondida por",
    )
    answered_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Fecha de respuesta",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        verbose_name="Estado",
    )
    is_public = models.BooleanField(
        default=True,
        verbose_name="Pública",
    )

    class Meta:
        verbose_name = "Pregunta de producto"
        verbose_name_plural = "Preguntas de productos"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["product", "status", "is_public"]),
            models.Index(fields=["user"]),
            models.Index(fields=["status"]),
        ]

    def clean(self):
        if not self.question.strip():
            raise ValidationError("La pregunta no puede estar vacía.")

        if self.answer and not self.answer.strip():
            raise ValidationError("La respuesta no puede estar vacía.")

    def __str__(self):
        return f"{self.product.name} - {self.status}"