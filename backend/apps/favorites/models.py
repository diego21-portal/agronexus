from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel
from apps.products.models import Product


class FavoriteProduct(TimeStampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="favorite_products",
        verbose_name="Usuario",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="favorited_by",
        verbose_name="Producto",
    )

    class Meta:
        verbose_name = "Producto favorito"
        verbose_name_plural = "Productos favoritos"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "product"],
                name="unique_favorite_product_per_user",
            )
        ]
        indexes = [
            models.Index(fields=["user", "created_at"]),
            models.Index(fields=["product"]),
        ]

    def __str__(self):
        return f"{self.user.email} - {self.product.name}"