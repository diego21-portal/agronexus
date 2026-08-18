from django.contrib import admin

from .models import FavoriteProduct


@admin.register(FavoriteProduct)
class FavoriteProductAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "product",
        "created_at",
    )
    search_fields = (
        "user__email",
        "user__username",
        "product__name",
        "product__sku",
    )
    list_filter = (
        "created_at",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
    )