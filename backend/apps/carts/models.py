from decimal import Decimal

from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel
from apps.products.models import Product


class Cart(TimeStampedModel):
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Activo"
        ORDERED = "ORDERED", "Convertido en pedido"
        ABANDONED = "ABANDONED", "Abandonado"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="carts",
        verbose_name="Usuario",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        verbose_name="Estado",
    )

    class Meta:
        verbose_name = "Carrito"
        verbose_name_plural = "Carritos"
        ordering = ["-created_at"]

    @property
    def subtotal(self):
        return sum((item.subtotal for item in self.items.all()), Decimal("0.00"))

    @property
    def items_count(self):
        return sum(item.quantity for item in self.items.all())

    def __str__(self):
        return f"Carrito de {self.user.email} - {self.status}"


class CartItem(TimeStampedModel):
    cart = models.ForeignKey(
        Cart,
        on_delete=models.CASCADE,
        related_name="items",
        verbose_name="Carrito",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="cart_items",
        verbose_name="Producto",
    )
    quantity = models.PositiveIntegerField(
        default=1,
        verbose_name="Cantidad",
    )
    unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        verbose_name="Precio unitario",
    )

    class Meta:
        verbose_name = "Ítem del carrito"
        verbose_name_plural = "Ítems del carrito"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["cart", "product"],
                name="unique_product_per_cart",
            )
        ]

    @property
    def subtotal(self):
        return self.unit_price * self.quantity

    def __str__(self):
        return f"{self.product.name} x {self.quantity}"