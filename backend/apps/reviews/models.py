from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Avg, Count

from apps.core.models import TimeStampedModel
from apps.orders.models import Order, OrderItem
from apps.products.models import Product


class ProductReview(TimeStampedModel):
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="reviews",
        verbose_name="Producto",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="product_reviews",
        verbose_name="Usuario",
    )
    order_item = models.OneToOneField(
        OrderItem,
        on_delete=models.CASCADE,
        related_name="review",
        verbose_name="Ítem de orden",
    )
    rating = models.PositiveSmallIntegerField(
        verbose_name="Calificación",
        help_text="Valor entre 1 y 5.",
    )
    comment = models.TextField(
        blank=True,
        verbose_name="Comentario",
    )
    is_public = models.BooleanField(
        default=True,
        verbose_name="Pública",
    )

    class Meta:
        verbose_name = "Reseña de producto"
        verbose_name_plural = "Reseñas de productos"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["product", "is_public"]),
            models.Index(fields=["user"]),
            models.Index(fields=["rating"]),
        ]

    def clean(self):
        if self.rating < 1 or self.rating > 5:
            raise ValidationError("La calificación debe estar entre 1 y 5.")

        if self.order_item.order.user_id != self.user_id:
            raise ValidationError(
                "Solo el comprador puede reseñar este producto."
            )

        if self.order_item.product_id != self.product_id:
            raise ValidationError(
                "El ítem de orden no corresponde al producto reseñado."
            )

        if self.order_item.order.status != Order.Status.DELIVERED:
            raise ValidationError(
                "Solo se pueden reseñar productos de pedidos entregados."
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
        self.update_product_rating(self.product)

    def delete(self, *args, **kwargs):
        product = self.product
        result = super().delete(*args, **kwargs)
        self.update_product_rating(product)
        return result

    @staticmethod
    def update_product_rating(product):
        stats = ProductReview.objects.filter(
            product=product,
            is_public=True,
        ).aggregate(
            average=Avg("rating"),
            total=Count("id"),
        )

        average = stats["average"] or 0
        total = stats["total"] or 0

        product.average_rating = Decimal(str(round(average, 2)))
        product.total_reviews = total
        product.save(update_fields=["average_rating", "total_reviews", "updated_at"])

    def __str__(self):
        return f"{self.product.name} - {self.rating} estrellas"