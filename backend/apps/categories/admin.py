from django.contrib import admin

from .models import Brand, Category


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "parent",
        "is_active",
        "created_at",
    )
    list_filter = (
        "is_active",
        "parent",
    )
    search_fields = (
        "name",
        "description",
    )
    prepopulated_fields = {
        "slug": ("name",),
    }


@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "is_active",
        "created_at",
    )
    list_filter = (
        "is_active",
    )
    search_fields = (
        "name",
        "description",
    )
    prepopulated_fields = {
        "slug": ("name",),
    }