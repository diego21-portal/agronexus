import uuid
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models, router

from apps.core.models import TimeStampedModel
from apps.products.models import Product
from apps.sellers.models import SellerProfile


def _protect_purchase_history(instance, field_names, args, kwargs):
    """Reject ordinary model edits; QuerySet/SQL remain privileged operations."""
    if instance.pk is None:
        return
    database = (
        kwargs.get("using")
        or (args[2] if len(args) > 2 else None)
        or router.db_for_write(type(instance), instance=instance)
    )
    previous = (
        type(instance)._base_manager.using(database)
        .filter(pk=instance.pk)
        .values(*field_names)
        .first()
    )
    if previous is None:
        return
    errors = {}
    for name in field_names:
        field = instance._meta.get_field(name)
        value = getattr(instance, field.attname)
        converter = field.target_field if field.is_relation else field
        if converter.to_python(value) != previous[name]:
            errors[name] = "Los datos históricos de una compra no pueden editarse directamente."
    if errors:
        raise ValidationError(errors)


class Order(TimeStampedModel):
    class AddressSnapshotSource(models.TextChoices):
        CHECKOUT = "CHECKOUT", "Registrada al confirmar la compra"
        LEGACY_UNKNOWN = "LEGACY_UNKNOWN", "Dirección histórica no registrada"

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
    shipping_address_snapshot = models.JSONField(
        null=True,
        blank=True,
        editable=False,
        verbose_name="Dirección registrada al comprar",
    )
    shipping_address_snapshot_source = models.CharField(
        max_length=20,
        choices=AddressSnapshotSource.choices,
        default=AddressSnapshotSource.LEGACY_UNKNOWN,
        editable=False,
        verbose_name="Origen de la dirección histórica",
    )
    source_cart = models.OneToOneField(
        "carts.Cart",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="checkout_order",
        editable=False,
        verbose_name="Carrito confirmado",
    )
    checkout_key = models.UUIDField(
        null=True,
        blank=True,
        editable=False,
        verbose_name="Referencia de confirmación",
    )
    checkout_fingerprint = models.CharField(
        max_length=64,
        blank=True,
        editable=False,
        verbose_name="Huella de la confirmación",
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
        constraints = [
            models.UniqueConstraint(
                fields=["user", "checkout_key"],
                condition=models.Q(checkout_key__isnull=False),
                name="unique_checkout_key_per_user",
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.order_number:
            self.order_number = f"AGX-{uuid.uuid4().hex[:10].upper()}"
        _protect_purchase_history(
            self,
            (
                "user", "shipping_address", "shipping_address_snapshot",
                "shipping_address_snapshot_source", "source_cart", "checkout_key",
                "checkout_fingerprint", "order_number", "subtotal", "discount_total",
                "shipping_cost", "total",
            ),
            args,
            kwargs,
        )
        super().save(*args, **kwargs)

    def __str__(self):
        return self.order_number

    @property
    def shipment(self):
        """Compatibilidad de lectura para las compras con un único envío."""
        shipments = list(self.shipments.all())
        return shipments[0] if len(shipments) == 1 else None

    def shipment_for_seller(self, seller_id):
        return next(
            (shipment for shipment in self.shipments.all() if shipment.seller_id == seller_id),
            None,
        )

    @property
    def has_cancellations(self):
        return any(
            shipment.status == "CANCELLED" or any(case.status == "COMPLETED" for case in shipment.cancellations.all())
            for shipment in self.shipments.all()
        )


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

    def save(self, *args, **kwargs):
        _protect_purchase_history(
            self,
            (
                "order", "product", "seller", "product_name", "sku", "quantity",
                "unit_price", "total_price",
            ),
            args,
            kwargs,
        )
        super().save(*args, **kwargs)

    @property
    def delivery_status(self):
        shipment = self.order.shipment_for_seller(self.seller_id)
        return shipment.status if shipment else None

    @property
    def is_delivered(self):
        return self.delivery_status == "DELIVERED"

    @property
    def can_request_return(self):
        if not self.is_delivered or hasattr(self, "return_request"):
            return False
        shipment = self.order.shipment_for_seller(self.seller_id)
        return not any(case.status not in {"REJECTED", "WITHDRAWN"} for case in shipment.cancellations.all())
