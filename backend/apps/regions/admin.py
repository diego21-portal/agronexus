from django.contrib import admin

from .models import Region


@admin.register(Region)
class RegionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "province",
        "country",
        "is_active",
        "created_at",
    )
    list_filter = (
        "country",
        "province",
        "is_active",
    )
    search_fields = (
        "name",
        "province",
        "country",
    )
    prepopulated_fields = {
        "slug": ("name", "province"),
    }