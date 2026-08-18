from django.contrib import admin

from .models import Order, OrderItem


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = (
        "product_name",
        "sku",
        "quantity",
        "unit_price",
        "total_price",
        "created_at",
        "updated_at",
    )


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
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
    readonly_fields = (
        "order_number",
        "subtotal",
        "discount_total",
        "shipping_cost",
        "total",
        "created_at",
        "updated_at",
    )
    inlines = [OrderItemInline]


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
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