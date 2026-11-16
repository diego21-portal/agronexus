from django.contrib import admin

from .models import Payment, PaymentRefund


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "order",
        "payment_method",
        "status",
        "amount",
        "refund_review_required",
        "transaction_code",
        "paid_at",
        "created_at",
    )
    list_filter = (
        "payment_method",
        "status",
        "created_at",
    )
    search_fields = (
        "order__order_number",
        "transaction_code",
    )
    readonly_fields = (
        "order",
        "payment_method",
        "status",
        "amount",
        "refund_review_required",
        "transaction_code",
        "paid_at",
        "created_at",
        "updated_at",
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(PaymentRefund)
class PaymentRefundAdmin(admin.ModelAdmin):
    list_display = ("id", "payment", "kind", "order_item", "amount", "created_at")
    readonly_fields = (
        "payment", "order_item", "cancellation_request", "return_request",
        "kind", "amount", "operation_key", "created_by", "reason", "created_at", "updated_at",
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
