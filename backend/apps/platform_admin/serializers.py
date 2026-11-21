from rest_framework import serializers

from apps.categories.serializers import BrandSerializer, CategorySerializer
from apps.payments.serializers import PaymentSerializer
from apps.products.serializers import ProductDetailSerializer
from apps.regions.serializers import RegionSerializer
from apps.sellers.models import SellerProfile
from apps.shipments.serializers import ShipmentSerializer
from apps.users.models import User
from apps.users.serializers import UserMeSerializer


class AdminUserSerializer(UserMeSerializer):
    class Meta(UserMeSerializer.Meta):
        fields = UserMeSerializer.Meta.fields + (
            "is_active", "is_staff", "is_superuser", "date_joined", "last_login",
        )
        read_only_fields = fields


class AdminSellerSerializer(serializers.ModelSerializer):
    user = AdminUserSerializer(read_only=True)

    class Meta:
        model = SellerProfile
        fields = (
            "id", "user", "business_name", "tax_id", "description",
            "rating_average", "total_sales", "is_verified", "is_active",
        )
        read_only_fields = fields


class AdminProductSellerSerializer(serializers.ModelSerializer):
    class Meta:
        model = SellerProfile
        fields = ("id", "business_name", "rating_average", "is_verified")
        read_only_fields = fields


class AdminProductSerializer(ProductDetailSerializer):
    seller = AdminProductSellerSerializer(read_only=True)
    seller_id = serializers.IntegerField(read_only=True)
    seller_name = serializers.CharField(source="seller.business_name", read_only=True)
    category = CategorySerializer(read_only=True)
    brand = BrandSerializer(read_only=True)
    region = RegionSerializer(read_only=True)

    class Meta(ProductDetailSerializer.Meta):
        fields = ProductDetailSerializer.Meta.fields + (
            "is_active", "seller_id", "seller_name",
        )
        read_only_fields = fields


class AdminPaymentSerializer(PaymentSerializer):
    order_number = serializers.CharField(source="order.order_number", read_only=True)

    class Meta(PaymentSerializer.Meta):
        fields = PaymentSerializer.Meta.fields + ("order", "order_number")
        read_only_fields = fields


class AdminShipmentSerializer(ShipmentSerializer):
    order_number = serializers.CharField(source="order.order_number", read_only=True)

    class Meta(ShipmentSerializer.Meta):
        fields = ShipmentSerializer.Meta.fields + ("order", "order_number")
        read_only_fields = fields


class StrictPatchSerializer(serializers.Serializer):
    """Reject unexpected fields instead of silently accepting a partial mutation."""

    def to_internal_value(self, data):
        if isinstance(data, dict):
            unknown = set(data) - set(self.fields)
            if unknown:
                raise serializers.ValidationError({
                    field: "Este campo no se puede modificar desde administración."
                    for field in sorted(unknown)
                })
        return super().to_internal_value(data)

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError("Indica al menos un campo para actualizar.")
        return attrs


class UserAccessUpdateSerializer(StrictPatchSerializer):
    role = serializers.ChoiceField(choices=User.Role.choices, required=False)
    is_active = serializers.BooleanField(required=False)


class SellerVerificationSerializer(StrictPatchSerializer):
    is_verified = serializers.BooleanField(required=True)


class ProductVisibilitySerializer(StrictPatchSerializer):
    is_active = serializers.BooleanField(required=True)
