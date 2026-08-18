from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Address, User, UserProfile


class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    extra = 0


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    model = User
    inlines = [UserProfileInline]

    list_display = (
        "id",
        "email",
        "username",
        "role",
        "is_active",
        "is_staff",
        "is_superuser",
    )

    list_filter = (
        "role",
        "is_active",
        "is_staff",
        "is_superuser",
    )

    search_fields = (
        "email",
        "username",
        "first_name",
        "last_name",
    )

    ordering = ("id",)

    fieldsets = UserAdmin.fieldsets + (
        (
            "AgroNexus",
            {
                "fields": (
                    "role",
                )
            },
        ),
    )

    add_fieldsets = UserAdmin.add_fieldsets + (
        (
            "AgroNexus",
            {
                "fields": (
                    "email",
                    "role",
                )
            },
        ),
    )


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "phone",
        "preferred_region",
        "preferred_theme",
        "created_at",
    )
    list_filter = (
        "preferred_theme",
        "preferred_region",
    )
    search_fields = (
        "user__email",
        "user__username",
        "phone",
        "document_number",
    )


@admin.register(Address)
class AddressAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "street",
        "number",
        "city",
        "province",
        "region",
        "is_default",
        "is_active",
        "created_at",
    )
    list_filter = (
        "region",
        "province",
        "is_default",
        "is_active",
    )
    search_fields = (
        "user__email",
        "street",
        "city",
        "province",
        "postal_code",
    )