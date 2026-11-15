from rest_framework.permissions import BasePermission

from apps.users.models import User


class IsPlatformAdmin(BasePermission):
    message = "Solo un administrador puede acceder a este recurso."

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated or not user.is_active:
            return False

        return user.effective_role in (User.Role.ADMIN, User.Role.SUPER_ADMIN)
