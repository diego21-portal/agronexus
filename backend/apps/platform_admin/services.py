from django.db import transaction
from django.db.models import Q
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.users.models import User


ADMIN_ROLES = (User.Role.ADMIN, User.Role.SUPER_ADMIN)


def is_active_admin(user):
    return user.is_active and user.effective_role in ADMIN_ROLES


def lock_active_admin(actor_id):
    """Call inside an atomic block, before locking the resource being changed."""
    actor = User.objects.select_for_update().filter(pk=actor_id).first()
    if actor is None or not is_active_admin(actor):
        raise PermissionDenied("Tu cuenta ya no tiene permisos de administración.")
    return actor


@transaction.atomic
def update_user_access(*, actor_id, user_id, changes):
    # All access updates acquire the same administrator rows in the same order.
    # Locking only the target lets two concurrent requests remove the last admins.
    users = list(
        User.objects.select_for_update().filter(
            Q(role__in=ADMIN_ROLES) | Q(is_superuser=True)
            | Q(pk__in=(actor_id, user_id))
        ).order_by("pk")
    )
    by_id = {user.pk: user for user in users}
    actor = by_id.get(actor_id)
    if actor is None or not is_active_admin(actor):
        raise PermissionDenied("Tu cuenta ya no tiene permisos de administración.")

    target = by_id.get(user_id)
    if target is None:
        # Keep the usual API 404 if the account disappeared after lookup.
        raise NotFound("No se encontró la cuenta solicitada.")

    if actor.effective_role != User.Role.SUPER_ADMIN:
        if target.effective_role == User.Role.SUPER_ADMIN:
            raise PermissionDenied("Solo un superadministrador puede modificar esta cuenta.")
        if changes.get("role") == User.Role.SUPER_ADMIN:
            raise PermissionDenied("Solo un superadministrador puede asignar ese rol.")

    if target.pk == actor.pk and changes.get("is_active") is False:
        raise ValidationError({"is_active": "No puedes desactivar tu propia cuenta."})

    if target.is_superuser and "role" in changes and changes["role"] != User.Role.SUPER_ADMIN:
        raise ValidationError({
            "role": "Esta cuenta conserva permisos de superadministrador y no admite ese cambio de rol.",
        })

    had_active_super_admin = any(
        user.is_active and user.effective_role == User.Role.SUPER_ADMIN for user in users
    )
    for field, value in changes.items():
        setattr(target, field, value)

    if not any(is_active_admin(user) for user in users):
        raise ValidationError({"role": "Debe quedar al menos un administrador activo."})
    if had_active_super_admin and not any(
        user.is_active and user.effective_role == User.Role.SUPER_ADMIN for user in users
    ):
        raise ValidationError({"role": "Debe quedar al menos un superadministrador activo."})

    target.save(update_fields=list(changes))
    return target
