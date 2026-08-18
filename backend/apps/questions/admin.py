from django.contrib import admin

from .models import ProductQuestion


@admin.register(ProductQuestion)
class ProductQuestionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "product",
        "user",
        "status",
        "is_public",
        "answered_by",
        "answered_at",
        "created_at",
    )
    list_filter = (
        "status",
        "is_public",
        "created_at",
        "answered_at",
    )
    search_fields = (
        "product__name",
        "product__sku",
        "user__email",
        "question",
        "answer",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
        "answered_at",
    )