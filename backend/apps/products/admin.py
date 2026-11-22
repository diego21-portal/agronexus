from django.contrib import admin
from django.db import transaction
from django.forms import ModelForm

from .models import Product, ProductImage, StockMovement


class ProductImageAdminForm(ModelForm):
    class Meta:
        model = ProductImage
        fields = "__all__"

    def _get_validation_exclusions(self):
        # Selecting a main image is a swap: ProductImage.save() demotes the
        # previous one while holding the product lock. Form-time uniqueness
        # validation would otherwise reject that valid operation prematurely.
        return super()._get_validation_exclusions() | {"is_main"}


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    form = ProductImageAdminForm
    extra = 1


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "sku",
        "seller",
        "category",
        "brand",
        "region",
        "price",
        "discount_price",
        "stock",
        "status",
        "is_active",
        "is_featured",
        "created_at",
    )
    list_filter = (
        "status",
        "condition",
        "is_active",
        "is_featured",
        "category",
        "brand",
        "region",
    )
    search_fields = (
        "name",
        "sku",
        "description",
        "seller__business_name",
    )
    prepopulated_fields = {
        "slug": ("name", "sku"),
    }
    inlines = [ProductImageInline]
    readonly_fields = (
        "stock",
        "average_rating",
        "total_reviews",
        "created_at",
        "updated_at",
    )

    def save_model(self, request, obj, form, change):
        if not change:
            return super().save_model(request, obj, form, change)

        # The form was built before these locks. Inventory, reviews or a file
        # upload may have committed since then; only apply the user's edits to
        # the current row instead of saving the whole stale model instance.
        editable = {
            field.name: field for field in self.model._meta.concrete_fields
            if field.editable and not field.primary_key
            and field.name not in self.get_readonly_fields(request, obj)
        }
        changed = [name for name in form.changed_data if name in editable]
        with transaction.atomic():
            current = self.model.objects.select_for_update().get(pk=obj.pk)
            for name in changed:
                field = editable[name]
                setattr(current, field.attname, getattr(obj, field.attname))
            if changed:
                current.save(update_fields=[*changed, "updated_at"])
            # ModelAdmin uses this same object for inline formsets afterwards.
            obj.refresh_from_db()

    def has_delete_permission(self, request, obj=None):
        # Archiving preserves the ledger; deleting a product would cascade
        # into its stock movements even though that ledger is read-only.
        return False


@admin.register(ProductImage)
class ProductImageAdmin(admin.ModelAdmin):
    form = ProductImageAdminForm
    list_display = (
        "id",
        "product",
        "is_main",
        "order",
        "created_at",
    )
    list_filter = (
        "is_main",
    )
    search_fields = (
        "product__name",
        "alt_text",
    )

    def get_readonly_fields(self, request, obj=None):
        return ("product",) if obj else ()

    def delete_queryset(self, request, queryset):
        with transaction.atomic():
            product_ids = queryset.values_list("product_id", flat=True)
            list(Product.objects.select_for_update().filter(pk__in=product_ids).order_by("pk"))
            queryset.delete()

@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "product",
        "movement_type",
        "quantity",
        "previous_stock",
        "new_stock",
        "created_by",
        "created_at",
    )
    list_filter = (
        "movement_type",
        "created_at",
    )
    search_fields = (
        "product__name",
        "product__sku",
        "reason",
        "created_by__email",
    )
    readonly_fields = tuple(field.name for field in StockMovement._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
