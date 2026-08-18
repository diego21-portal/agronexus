from rest_framework.permissions import BasePermission

class IsReviewOwner(BasePermission):
    message = "Solo puedes modificar tus propias reseñas"

    def has_object_permission(self, request, view, obj):
        return obj.user_id == request.user.id 
