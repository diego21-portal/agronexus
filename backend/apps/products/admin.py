from django.contrib import admin

from .models import Product, ProductImage, StockMovement


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "sku",
        "seller",
        "category",
        "brand",
        "region",
        "price",
        "discount_price",
        "stock",
        "status",
        "is_active",
        "is_featured",
        "created_at",
    )
    list_filter = (
        "status",
        "condition",
        "is_active",
        "is_featured",
        "category",
        "brand",
        "region",
    )
    search_fields = (
        "name",
        "sku",
        "description",
        "seller__business_name",
    )
    prepopulated_fields = {
        "slug": ("name", "sku"),
    }
    inlines = [ProductImageInline]
    readonly_fields = (
        "average_rating",
        "total_reviews",
        "created_at",
        "updated_at",
    )


@admin.register(ProductImage)
class ProductImageAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "product",
        "is_main",
        "order",
        "created_at",
    )
    list_filter = (
        "is_main",
    )
    search_fields = (
        "product__name",
        "alt_text",
    )

@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "product",
        "movement_type",
        "quantity",
        "previous_stock",
        "new_stock",
        "created_by",
        "created_at",
    )
    list_filter = (
        "movement_type",
        "created_at",
    )
    search_fields = (
        "product__name",
        "product__sku",
        "reason",
        "created_by__email",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
    )