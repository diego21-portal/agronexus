from django.contrib import admin

from .models import SellerProfile


@admin.register(SellerProfile)
class SellerProfileAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "business_name",
        "user",
        "is_verified",
        "is_active",
        "rating_average",
        "total_sales",
        "created_at",
    )
    list_filter = (
        "is_verified",
        "is_active",
    )
    search_fields = (
        "business_name",
        "user__email",
        "tax_id",
    )