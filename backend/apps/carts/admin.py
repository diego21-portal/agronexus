from django.contrib import admin

from .models import Cart, CartItem


class CartItemInline(admin.TabularInline):
    model = CartItem
    extra = 0
    readonly_fields = (
        "subtotal",
        "created_at",
        "updated_at",
    )


@admin.register(Cart)
class CartAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "status",
        "items_count",
        "subtotal",
        "created_at",
    )
    list_filter = (
        "status",
        "created_at",
    )
    search_fields = (
        "user__email",
        "user__username",
    )
    inlines = [CartItemInline]
    readonly_fields = (
        "items_count",
        "subtotal",
        "created_at",
        "updated_at",
    )


@admin.register(CartItem)
class CartItemAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "cart",
        "product",
        "quantity",
        "unit_price",
        "subtotal",
        "created_at",
    )
    search_fields = (
        "cart__user__email",
        "product__name",
        "product__sku",
    )
    readonly_fields = (
        "subtotal",
        "created_at",
        "updated_at",
    )