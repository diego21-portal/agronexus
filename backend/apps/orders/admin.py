from django.contrib import admin

from .models import Order, OrderItem


class PurchaseHistoryAdmin(admin.ModelAdmin):
    """Historical purchases are consulted here; services handle operations."""

    actions = None

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    can_delete = False
    show_change_link = True
    readonly_fields = tuple(field.name for field in OrderItem._meta.fields)

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Order)
class OrderAdmin(PurchaseHistoryAdmin):
    list_display = (
        "id",
        "order_number",
        "user",
        "status",
        "subtotal",
        "discount_total",
        "shipping_cost",
        "total",
        "created_at",
    )
    list_filter = (
        "status",
        "created_at",
    )
    search_fields = (
        "order_number",
        "user__email",
        "items__product_name",
        "items__sku",
    )
    readonly_fields = tuple(field.name for field in Order._meta.fields)
    inlines = [OrderItemInline]


@admin.register(OrderItem)
class OrderItemAdmin(PurchaseHistoryAdmin):
    readonly_fields = tuple(field.name for field in OrderItem._meta.fields)
    list_display = (
        "id",
        "order",
        "product_name",
        "sku",
        "seller",
        "quantity",
        "unit_price",
        "total_price",
    )
    search_fields = (
        "order__order_number",
        "product_name",
        "sku",
        "seller__business_name",
    )
