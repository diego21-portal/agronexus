from django.contrib import admin
from .models import ProductReview

@admin.register(ProductReview)
class ProductyReviewAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "product",
        "user",
        "rating",
        "is_public",
        "created_at",
    )
    list_filter = (
        "rating",
        "is_public",
        "created_at",
    )
    search_fields= (
        "product__name",
        "product__sku",
        "user__email",
        "commet",
    )
    readonly_fields = (
        "created_at",
        "updated_at"
    )    
# Register your models here.
