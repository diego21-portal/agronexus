from django.contrib import admin

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "notification_type",
        "title",
        "is_read",
        "related_object_type",
        "related_object_id",
        "created_at",
    )
    list_filter = (
        "notification_type",
        "is_read",
        "created_at",
    )
    search_fields = (
        "user__email",
        "title",
        "message",
        "related_object_type",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
        "read_at",
    )