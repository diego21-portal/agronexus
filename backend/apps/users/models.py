from django.contrib.auth.models import AbstractUser
from django.db import models
from django.conf import settings

from apps.core.models import TimeStampedModel, ActiveModel

class User(AbstractUser):
    class Role(models.TextChoices):
        CUSTOMER = "CUSTOMER", "Cliente"
        SELLER = "SELLER", "Vendedor"
        LOGISTICS_OPERATOR = "LOGISTICS_OPERATOR", "Operador Logístico"
        ADMIN = "ADMIN", "Administrador"
        SUPER_ADMIN = "SUPER_ADMIN", "SuperAdministrador"

    email = models.EmailField(unique=True)
    role = models.CharField(
        max_length=30,
        choices=Role.choices,
        default=Role.CUSTOMER
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    def __str__(self):
        return self.email
    
class UserProfile(TimeStampedModel):
    class DocumentType(models.TextChoices):
        DNI = "DNI", "DNI"
        CUIT = "CUIT", "CUIT"
        CUIL = "CUIL", "CUIL"
        PASSPORT = "PASSPORT", "Pasaporte"
        OTHER = "OTHER", "Otro"

    class ThemePreference(models.TextChoices):
        LIGHT = "LIGHT", "Claro"
        DARK = "DARK", "Oscuro"
        SYSTEM = "SYSTEM", "Sistema"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
        verbose_name="Usuario"
    )

    phone = models.CharField(
        max_length=30,
        blank=True,
        verbose_name="Teléfono"
    )

    avatar = models.ImageField(
        upload_to="users/avatars/",
        blank=True,
        null=True,
        verbose_name="Avatar"
    )

    document_type = models.CharField(
        max_length=20,
        choices=DocumentType.choices,
        blank=True,
        verbose_name="Tipo de Documento"
    ) 

    document_number = models.CharField(
        max_length=40,
        blank=True,
        verbose_name="Número de documento",
    )
    birth_date = models.DateField(
        null=True,
        blank=True,
        verbose_name="Fecha de nacimiento",
    )
    preferred_region = models.ForeignKey(
        "regions.Region",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="user_profiles",
        verbose_name="Región preferida",
    )
    preferred_theme = models.CharField(
        max_length=20,
        choices=ThemePreference.choices,
        default=ThemePreference.SYSTEM,
        verbose_name="Tema preferido",
    )

    class Meta:
        verbose_name = "Perfil de usuario"
        verbose_name_plural = "Perfiles de usuarios"

    def __str__(self):
        return f"Perfil de {self.user.email}"


class Address(TimeStampedModel, ActiveModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="addresses",
        verbose_name="Usuario",
    )

    region = models.ForeignKey(
        "regions.Region",
        on_delete=models.PROTECT,
        related_name="addresses",
        verbose_name="Región",
    )

    street = models.CharField(
        max_length=160,
        verbose_name="Calle",
    )

    number = models.CharField(
        max_length=20,
        verbose_name="Número",
    )

    city = models.CharField(
        max_length=120,
        verbose_name="Ciudad",
    )

    province = models.CharField(
        max_length=120,
        verbose_name="Provincia",
    )

    postal_code = models.CharField(
        max_length=20,
        blank=True,
        verbose_name="Código postal",
    )

    reference = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Referencia",
    )

    is_default = models.BooleanField(
        default=False,
        verbose_name="Dirección principal",
    )

    class Meta:
        verbose_name = "Dirección"
        verbose_name_plural = "Direcciones"
        ordering = ["-is_default", "-created_at"]

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

        if self.is_default:
            Address.objects.filter(
                user=self.user,
                is_default=True,
            ).exclude(pk=self.pk).update(is_default=False)

    def __str__(self):
        return f"{self.street} {self.number}, {self.city}"
