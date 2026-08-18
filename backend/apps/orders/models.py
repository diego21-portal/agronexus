import uuid
from decimal import Decimal

from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel
from apps.products.models import Product
from apps.sellers.models import SellerProfile


class Order(TimeStampedModel):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pendiente"
        CONFIRMED = "CONFIRMED", "Confirmado"
        PAID = "PAID", "Pagado"
        PREPARING = "PREPARING", "En preparación"
        SHIPPED = "SHIPPED", "Enviado"
        DELIVERED = "DELIVERED", "Entregado"
        CANCELLED = "CANCELLED", "Cancelado"
        PROBLEM = "PROBLEM", "Con problema"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="orders",
        verbose_name="Cliente",
    )
    shipping_address = models.ForeignKey(
        "users.Address",
        on_delete=models.PROTECT,
        related_name="orders",
        verbose_name="Dirección de envío",
    )
    order_number = models.CharField(
        max_length=40,
        unique=True,
        blank=True,
        verbose_name="Número de orden",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        verbose_name="Estado",
    )
    subtotal = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="Subtotal",
    )
    discount_total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="Total de descuentos",
    )
    shipping_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="Costo de envío",
    )
    total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="Total",
    )

    class Meta:
        verbose_name = "Orden"
        verbose_name_plural = "Órdenes"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["order_number"]),
            models.Index(fields=["user", "status"]),
            models.Index(fields=["status"]),
        ]

    def save(self, *args, **kwargs):
        if not self.order_number:
            self.order_number = f"AGX-{uuid.uuid4().hex[:10].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return self.order_number


class OrderItem(TimeStampedModel):
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="items",
        verbose_name="Orden",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="order_items",
        verbose_name="Producto",
    )
    seller = models.ForeignKey(
        SellerProfile,
        on_delete=models.PROTECT,
        related_name="order_items",
        verbose_name="Vendedor",
    )
    product_name = models.CharField(
        max_length=180,
        verbose_name="Nombre del producto",
    )
    sku = models.CharField(
        max_length=80,
        verbose_name="SKU",
    )
    quantity = models.PositiveIntegerField(
        verbose_name="Cantidad",
    )
    unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        verbose_name="Precio unitario",
    )
    total_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        verbose_name="Precio total",
    )

    class Meta:
        verbose_name = "Ítem de orden"
        verbose_name_plural = "Ítems de orden"
        ordering = ["id"]

    def __str__(self):
        return f"{self.product_name} x {self.quantity}"