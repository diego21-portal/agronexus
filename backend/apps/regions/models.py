from django.db import models
from django.utils.text import slugify

from apps.core.models import ActiveModel, TimeStampedModel


class Region(TimeStampedModel, ActiveModel):
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
    province = models.CharField(
        max_length=120,
        verbose_name="Provincia",
    )
    country = models.CharField(
        max_length=120,
        default="Argentina",
        verbose_name="País",
    )

    class Meta:
        verbose_name = "Región"
        verbose_name_plural = "Regiones"
        ordering = ["name"]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(f"{self.name}-{self.province}")
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name}, {self.province}"