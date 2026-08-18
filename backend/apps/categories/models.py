from django.db import models
from django.utils.text import slugify

from apps.core.models import ActiveModel, TimeStampedModel


class Category(TimeStampedModel, ActiveModel):
    name = models.CharField(
        max_length=120,
        verbose_name="Nombre",
    )
    slug = models.SlugField(
        max_length=140,
        unique=True,
        blank=True,
        verbose_name="Slug",
    )
    description = models.TextField(
        blank=True,
        verbose_name="Descripción",
    )
    parent = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="children",
        verbose_name="Categoría padre",
    )

    class Meta:
        verbose_name = "Categoría"
        verbose_name_plural = "Categorías"
        ordering = ["name"]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Brand(TimeStampedModel, ActiveModel):
    name = models.CharField(
        max_length=120,
        verbose_name="Nombre",
    )
    slug = models.SlugField(
        max_length=140,
        unique=True,
        blank=True,
        verbose_name="Slug",
    )
    description = models.TextField(
        blank=True,
        verbose_name="Descripción",
    )
    logo = models.ImageField(
        upload_to="brands/logos/",
        null=True,
        blank=True,
        verbose_name="Logo",
    )

    class Meta:
        verbose_name = "Marca"
        verbose_name_plural = "Marcas"
        ordering = ["name"]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name