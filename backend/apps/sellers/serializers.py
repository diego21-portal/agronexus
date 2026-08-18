from rest_framework import serializers

from .models import SellerProfile


class SellerProfileSummarySerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source="user.email", read_only=True)

    class Meta:
        model = SellerProfile
        fields = (
            "id",
            "business_name",
            "user_email",
            "tax_id",
            "description",
            "rating_average",
            "total_sales",
            "is_verified",
            "is_active",
            "created_at",
        )