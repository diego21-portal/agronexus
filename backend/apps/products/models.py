from django.core.exceptions import ValidationError
from django.db import models
from django.utils.text import slugify

from apps.categories.models import Brand, Category
from apps.core.models import ActiveModel, TimeStampedModel
from apps.regions.models import Region
from apps.sellers.models import SellerProfile


class Product(TimeStampedModel, ActiveModel):
    class Condition(models.TextChoices):
        NEW = "NEW", "Nuevo"
        USED = "USED", "Usado"
        REFURBISHED = "REFURBISHED", "Reacondicionado"

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Borrador"
        PUBLISHED = "PUBLISHED", "Publicado"
        PAUSED = "PAUSED", "Pausado"
        OUT_OF_STOCK = "OUT_OF_STOCK", "Agotado"
        ARCHIVED = "ARCHIVED", "Archivado"

    seller = models.ForeignKey(
        SellerProfile,
        on_delete=models.CASCADE,
        related_name="products",
        verbose_name="Vendedor",
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="products",
        verbose_name="Categoría",
    )
    brand = models.ForeignKey(
        Brand,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="products",
        verbose_name="Marca",
    )
    region = models.ForeignKey(
        Region,
        on_delete=models.PROTECT,
        related_name="products",
        verbose_name="Región",
    )

    name = models.CharField(
        max_length=180,
        verbose_name="Nombre",
    )
    slug = models.SlugField(
        max_length=220,
        unique=True,
        blank=True,
        verbose_name="Slug",
    )
    sku = models.CharField(
        max_length=80,
        unique=True,
        verbose_name="SKU",
    )
    short_description = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Descripción corta",
    )
    description = models.TextField(
        verbose_name="Descripción",
    )
    technical_description = models.TextField(
        blank=True,
        verbose_name="Descripción técnica",
    )

    price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        verbose_name="Precio",
    )
    discount_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Precio con descuento",
    )

    unit = models.CharField(
        max_length=40,
        default="unidad",
        verbose_name="Unidad de venta",
    )
    stock = models.PositiveIntegerField(
        default=0,
        verbose_name="Stock",
    )
    minimum_stock = models.PositiveIntegerField(
        default=0,
        verbose_name="Stock mínimo",
    )

    condition = models.CharField(
        max_length=20,
        choices=Condition.choices,
        default=Condition.NEW,
        verbose_name="Condición",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        verbose_name="Estado",
    )

    warranty = models.CharField(
        max_length=160,
        blank=True,
        verbose_name="Garantía",
    )
    shipping_available = models.BooleanField(
        default=True,
        verbose_name="Envío disponible",
    )

    average_rating = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        default=0,
        verbose_name="Calificación promedio",
    )
    total_reviews = models.PositiveIntegerField(
        default=0,
        verbose_name="Total de reseñas",
    )
    is_featured = models.BooleanField(
        default=False,
        verbose_name="Destacado",
    )

    class Meta:
        verbose_name = "Producto"
        verbose_name_plural = "Productos"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["slug"]),
            models.Index(fields=["sku"]),
            models.Index(fields=["status", "is_active"]),
            models.Index(fields=["category", "region"]),
            models.Index(fields=["brand", "region"]),
        ]

    def clean(self):
        if self.price < 0:
            raise ValidationError("El precio no puede ser negativo.")

        if self.discount_price is not None and self.discount_price >= self.price:
            raise ValidationError(
                "El precio con descuento debe ser menor que el precio original."
            )

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(f"{self.name}-{self.sku}")

        if self.stock == 0 and self.status == self.Status.PUBLISHED:
            self.status = self.Status.OUT_OF_STOCK

        super().save(*args, **kwargs)

    @property
    def current_price(self):
        return self.discount_price or self.price

    def __str__(self):
        return self.name


class ProductImage(TimeStampedModel):
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="images",
        verbose_name="Producto",
    )
    image = models.ImageField(
        upload_to="products/images/",
        verbose_name="Imagen",
    )
    alt_text = models.CharField(
        max_length=180,
        blank=True,
        verbose_name="Texto alternativo",
    )
    is_main = models.BooleanField(
        default=False,
        verbose_name="Imagen principal",
    )
    order = models.PositiveIntegerField(
        default=0,
        verbose_name="Orden",
    )

    class Meta:
        verbose_name = "Imagen de producto"
        verbose_name_plural = "Imágenes de productos"
        ordering = ["order", "id"]

    def __str__(self):
        return f"Imagen de {self.product.name}"

class StockMovement(TimeStampedModel):
    class MovementType(models.TextChoices):
        INITIAL = "INITIAL", "Stock inicial"
        SALE = "SALE", "Venta"
        RETURN = "RETURN", "Devolución"
        CANCELLATION = "CANCELLATION", "Cancelación"
        MANUAL_ADJUSTMENT = "MANUAL_ADJUSTMENT", "Ajuste manual"
        RESTOCK = "RESTOCK", "Reposición"
        RESERVATION = "RESERVATION", "Reserva"
        RELEASE_RESERVATION = "RELEASE_RESERVATION", "Liberación de reserva"

    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="stock_movements",
        verbose_name="Producto",
    )
    movement_type = models.CharField(
        max_length=30,
        choices=MovementType.choices,
        verbose_name="Tipo de movimiento",
    )
    quantity = models.IntegerField(
        verbose_name="Cantidad modificada",
        help_text="Puede ser positiva o negativa según el tipo de movimiento.",
    )
    previous_stock = models.PositiveIntegerField(
        verbose_name="Stock anterior",
    )
    new_stock = models.PositiveIntegerField(
        verbose_name="Stock nuevo",
    )
    reason = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Motivo",
    )
    created_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="stock_movements",
        verbose_name="Usuario responsable",
    )

    class Meta:
        verbose_name = "Movimiento de stock"
        verbose_name_plural = "Movimientos de stock"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["product", "created_at"]),
            models.Index(fields=["movement_type"]),
        ]

    def clean(self):
        if self.new_stock < 0:
            raise ValidationError("El stock nuevo no puede ser negativo.")

        if self.previous_stock + self.quantity != self.new_stock:
            raise ValidationError(
                "La cantidad modificada no coincide con el stock anterior y el stock nuevo."
            )

    def __str__(self):
        return f"{self.product.name} - {self.movement_type} ({self.quantity})"    