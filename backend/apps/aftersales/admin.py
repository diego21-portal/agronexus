from django.contrib import admin

from .models import CancellationEvent, CancellationRequest, ReturnInspection


class WorkflowReadOnlyAdmin(admin.ModelAdmin):
    def get_readonly_fields(self, request, obj=None):
        return tuple(field.name for field in self.model._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(CancellationRequest)
class CancellationRequestAdmin(WorkflowReadOnlyAdmin):
    list_display = ("id", "shipment", "user", "status", "is_pre_dispatch", "created_at")
    list_filter = ("status", "is_pre_dispatch")


@admin.register(ReturnInspection)
class ReturnInspectionAdmin(WorkflowReadOnlyAdmin):
    list_display = ("id", "order_item", "received_quantity", "restocked_quantity", "defective_quantity")


@admin.register(CancellationEvent)
class CancellationEventAdmin(WorkflowReadOnlyAdmin):
    list_display = ("id", "cancellation_request", "action", "status", "created_at")
