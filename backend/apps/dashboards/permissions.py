from rest_framework.permissions import BasePermission


class IsPlatformAdmin(BasePermission):
    message = "Solo un administrador puede acceder a este recurso."

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if user.is_superuser:
            return True

        if user.is_staff:
            return True

        return getattr(user, "role", None) in ["ADMIN", "SUPERADMIN"]