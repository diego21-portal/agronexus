from apps.users.models import User


def is_admin(user):
    return bool(
        user and user.is_authenticated and user.is_active
        and user.effective_role in {User.Role.ADMIN, User.Role.SUPER_ADMIN}
    )


def is_own_seller(user, seller_id):
    seller = getattr(user, "seller_profile", None)
    return bool(
        user and user.is_authenticated and user.is_active
        and user.effective_role == User.Role.SELLER
        and seller and seller.is_active and seller.pk == seller_id
    )
