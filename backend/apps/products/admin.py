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
        "stock",
        "average_rating",
        "total_reviews",
        "created_at",
        "updated_at",
    )

    def has_delete_permission(self, request, obj=None):
        # Archiving preserves the ledger; deleting a product would cascade
        # into its stock movements even though that ledger is read-only.
        return False


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
    readonly_fields = tuple(field.name for field in StockMovement._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
