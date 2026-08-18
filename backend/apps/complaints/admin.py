from django.contrib import admin

from .models import Complaint, ReturnRequest


@admin.register(Complaint)
class ComplaintAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "order",
        "user",
        "complaint_type",
        "status",
        "resolved_by",
        "resolved_at",
        "created_at",
    )
    list_filter = (
        "complaint_type",
        "status",
        "created_at",
        "resolved_at",
    )
    search_fields = (
        "order__order_number",
        "user__email",
        "title",
        "description",
        "resolution",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
    )


@admin.register(ReturnRequest)
class ReturnRequestAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "order_item",
        "user",
        "reason",
        "quantity",
        "requested_refund_amount",
        "approved_refund_amount",
        "status",
        "resolved_by",
        "resolved_at",
        "created_at",
    )
    list_filter = (
        "reason",
        "status",
        "created_at",
        "resolved_at",
    )
    search_fields = (
        "order_item__order__order_number",
        "order_item__product_name",
        "order_item__sku",
        "user__email",
        "description",
        "resolution",
    )
    readonly_fields = (
        "requested_refund_amount",
        "created_at",
        "updated_at",
    )