from rest_framework.permissions import BasePermission

class IsActiveSeller(BasePermission):
    message = "Only active sellers can perform this action."

    def has_permission(self, requem, view):

        if not requem.user or not requem.user.is_authenticated:
            return False
        
        if getattr(requem.user, "role", None) != "SELLER":
            return False
        
        seller_profile = getattr(requem.user, "seller_profile", None)
        return bool(seller_profile and seller_profile.is_active)

class IsProductOwnerSeller(BasePermission):
    message = "Only the seller who owns this product can perform this action."

    def has_object_permission(self, requem, view, obj):

        seller_profile = getattr(requem.user, "seller_profile", None)

        if not seller_profile:
            return False

        return obj.seller_id == seller_profile.id