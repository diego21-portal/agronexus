from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.utils.text import slugify

from apps.categories.models import Brand, Category
from apps.core.models import ActiveModel, TimeStampedModel
from apps.regions.models import Region
from apps.sellers.models import SellerProfile

from .media_validation import (
    product_image_path, technical_sheet_path, validate_product_image, validate_technical_sheet,
)


def _delete_file_after_commit(storage, name):
    if not name:
        return

    def remove_unreferenced_file():
        # Older data may deliberately share a path. Never remove another row's file.
        if not ProductImage.objects.filter(image=name).exists() and not Product.objects.filter(technical_sheet=name).exists():
            storage.delete(name)

    transaction.on_commit(remove_unreferenced_file, robust=True)


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
    technical_sheet = models.FileField(
        upload_to=technical_sheet_path,
        validators=[validate_technical_sheet],
        blank=True,
        verbose_name="Ficha técnica PDF",
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
        constraints = [
            models.CheckConstraint(condition=models.Q(price__gte=0), name="product_price_nonnegative"),
            models.CheckConstraint(
                condition=models.Q(discount_price__isnull=True)
                | (models.Q(discount_price__gte=0) & models.Q(discount_price__lt=models.F("price"))),
                name="product_discount_valid",
            ),
        ]

    def clean(self):
        if self.price < 0:
            raise ValidationError("El precio no puede ser negativo.")

        if self.discount_price is not None and self.discount_price < 0:
            raise ValidationError("El precio con descuento no puede ser negativo.")

        if self.discount_price is not None and self.discount_price >= self.price:
            raise ValidationError(
                "El precio con descuento debe ser menor que el precio original."
            )

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(f"{self.name}-{self.sku}")

        if self.stock == 0 and self.status == self.Status.PUBLISHED:
            self.status = self.Status.OUT_OF_STOCK

        update_fields = kwargs.get("update_fields")
        saves_sheet = update_fields is None or "technical_sheet" in update_fields
        if not saves_sheet or (update_fields is None and "technical_sheet" in self.get_deferred_fields()):
            return super().save(*args, **kwargs)
        sheet = self.technical_sheet
        uploaded = bool(sheet and not sheet._committed)
        if uploaded:
            validate_technical_sheet(sheet.file)
        old_name = ""
        try:
            with transaction.atomic():
                if self.pk:
                    old_name = type(self).objects.select_for_update().filter(pk=self.pk).values_list("technical_sheet", flat=True).first() or ""
                super().save(*args, **kwargs)
                new_name = sheet.name if sheet else ""
                if old_name != new_name:
                    _delete_file_after_commit(sheet.storage, old_name)
        except Exception:
            # The filesystem does not participate in the database transaction.
            if uploaded and sheet._committed and sheet.name and sheet.name != old_name:
                sheet.storage.delete(sheet.name)
            raise

    @property
    def current_price(self):
        return self.price if self.discount_price is None else self.discount_price

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
        upload_to=product_image_path,
        validators=[validate_product_image],
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
        constraints = [
            models.UniqueConstraint(
                fields=["product"], condition=models.Q(is_main=True),
                name="one_main_image_per_product",
            ),
        ]

    def save(self, *args, **kwargs):
        uploaded = bool(self.image and not self.image._committed)
        if uploaded:
            validate_product_image(self.image.file)
        old_name = ""
        try:
            with transaction.atomic():
                Product.objects.select_for_update().get(pk=self.product_id)
                old = type(self).objects.filter(pk=self.pk).values("product_id", "image").first() if self.pk else None
                if old and old["product_id"] != self.product_id:
                    raise ValidationError({"product": "No se puede trasladar una imagen a otro producto."})
                old_name = old["image"] if old else ""
                siblings = type(self).objects.filter(product_id=self.product_id).exclude(pk=self.pk)
                replacement_id = None
                if self.is_main:
                    siblings.filter(is_main=True).update(is_main=False)
                elif not siblings.filter(is_main=True).exists():
                    replacement = siblings.order_by("order", "pk").first()
                    if replacement:
                        # Demote this row before promoting its replacement. The
                        # conditional uniqueness constraint also applies here.
                        replacement_id = replacement.pk
                    else:
                        self.is_main = True
                if kwargs.get("update_fields") is not None:
                    kwargs["update_fields"] = set(kwargs["update_fields"]) | {"is_main"}
                super().save(*args, **kwargs)
                if replacement_id is not None:
                    type(self).objects.filter(pk=replacement_id).update(is_main=True)
                if old_name != self.image.name:
                    _delete_file_after_commit(self.image.storage, old_name)
        except Exception:
            if uploaded and self.image._committed and self.image.name and self.image.name != old_name:
                self.image.storage.delete(self.image.name)
            raise

    def delete(self, *args, **kwargs):
        with transaction.atomic():
            Product.objects.select_for_update().get(pk=self.product_id)
            return super().delete(*args, **kwargs)

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
    operation_key = models.CharField(max_length=160, null=True, blank=True, unique=True)
    order_item = models.ForeignKey(
        "orders.OrderItem",
        on_delete=models.PROTECT,
        related_name="stock_movements",
        null=True,
        blank=True,
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
