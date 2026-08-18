from django.contrib import admin

from .models import Shipment, ShipmentEvent


class ShipmentEventInline(admin.TabularInline):
    model = ShipmentEvent
    extra = 0
    readonly_fields = (
        "created_at",
        "updated_at",
    )


@admin.register(Shipment)
class ShipmentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "order",
        "tracking_code",
        "status",
        "carrier",
        "estimated_delivery_date",
        "delivered_at",
        "created_at",
    )
    list_filter = (
        "status",
        "carrier",
        "created_at",
    )
    search_fields = (
        "tracking_code",
        "order__order_number",
    )
    readonly_fields = (
        "tracking_code",
        "created_at",
        "updated_at",
    )
    inlines = [ShipmentEventInline]


@admin.register(ShipmentEvent)
class ShipmentEventAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "shipment",
        "status",
        "location",
        "created_by",
        "created_at",
    )
    list_filter = (
        "status",
        "created_at",
    )
    search_fields = (
        "shipment__tracking_code",
        "description",
        "location",
    )