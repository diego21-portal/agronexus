from django.contrib import admin

from .models import Cart, CartItem


class ReadOnlyCartPermissions:
    """The cart API serializes changes with checkout; admin only displays them."""

    actions = None

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class CartItemInline(ReadOnlyCartPermissions, admin.TabularInline):
    model = CartItem
    extra = 0
    can_delete = False
    show_change_link = True
    readonly_fields = tuple(field.name for field in CartItem._meta.fields) + (
        "subtotal",
    )


@admin.register(Cart)
class CartAdmin(ReadOnlyCartPermissions, admin.ModelAdmin):
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
    readonly_fields = tuple(field.name for field in Cart._meta.fields) + (
        "items_count",
        "subtotal",
    )


@admin.register(CartItem)
class CartItemAdmin(ReadOnlyCartPermissions, admin.ModelAdmin):
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
    readonly_fields = tuple(field.name for field in CartItem._meta.fields) + (
        "subtotal",
    )
