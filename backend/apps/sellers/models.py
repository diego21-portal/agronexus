from django.conf import settings
from django.db import models

from apps.core.models import ActiveModel, TimeStampedModel


class SellerProfile(TimeStampedModel, ActiveModel):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="seller_profile",
        verbose_name="Usuario",
    )
    business_name = models.CharField(
        max_length=160,
        verbose_name="Nombre comercial",
    )
    tax_id = models.CharField(
        max_length=30,
        blank=True,
        verbose_name="CUIT / Identificación fiscal",
    )
    description = models.TextField(
        blank=True,
        verbose_name="Descripción",
    )
    logo = models.ImageField(
        upload_to="sellers/logos/",
        null=True,
        blank=True,
        verbose_name="Logo",
    )
    rating_average = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        default=0,
        verbose_name="Promedio de calificación",
    )
    total_sales = models.PositiveIntegerField(
        default=0,
        verbose_name="Ventas totales",
    )
    is_verified = models.BooleanField(
        default=False,
        verbose_name="Verificado",
    )

    class Meta:
        verbose_name = "Perfil de vendedor"
        verbose_name_plural = "Perfiles de vendedores"
        ordering = ["business_name"]

    def __str__(self):
        return self.business_name