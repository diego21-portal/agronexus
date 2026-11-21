from rest_framework import serializers

from apps.categories.serializers import BrandSerializer, CategorySerializer
from apps.payments.serializers import PaymentSerializer
from apps.products.serializers import ProductDetailSerializer
from apps.regions.serializers import RegionSerializer
from apps.sellers.models import SellerProfile
from apps.shipments.serializers import ShipmentSerializer
from apps.users.models import User
from apps.users.serializers import UserMeSerializer


class AdminUserSellerProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = SellerProfile
        fields = ("id", "business_name", "tax_id", "description", "is_active", "is_verified")
        read_only_fields = fields


class AdminUserSerializer(UserMeSerializer):
    seller_profile = AdminUserSellerProfileSerializer(read_only=True, allow_null=True)

    class Meta(UserMeSerializer.Meta):
        fields = UserMeSerializer.Meta.fields + (
            "is_active", "is_staff", "is_superuser", "date_joined", "last_login", "seller_profile",
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


class SellerOnboardingSerializer(StrictPatchSerializer):
    business_name = serializers.CharField(
        min_length=2, max_length=160, required=False,
        help_text="Obligatorio al crear el perfil comercial o completar uno sin nombre.",
    )
    tax_id = serializers.CharField(max_length=30, allow_blank=True, required=False)
    description = serializers.CharField(max_length=5000, allow_blank=True, required=False)
    is_active = serializers.BooleanField(
        required=False,
        help_text="Debe ser true explícitamente para reactivar un perfil comercial inactivo.",
    )

    def validate_is_active(self, value):
        if not value:
            raise serializers.ValidationError("El alta comercial solo permite activar el perfil vendedor.")
        return value


class UserAccessUpdateSerializer(StrictPatchSerializer):
    role = serializers.ChoiceField(choices=User.Role.choices, required=False)
    is_active = serializers.BooleanField(required=False)
    seller_profile = SellerOnboardingSerializer(
        required=False,
        help_text="Alta comercial al asignar role=SELLER. No cambia privilegios ni reactiva la cuenta de usuario.",
    )

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if "seller_profile" in attrs and attrs.get("role") != User.Role.SELLER:
            raise serializers.ValidationError({
                "seller_profile": "Los datos comerciales solo se envían junto al rol SELLER.",
            })
        return attrs


class SellerVerificationSerializer(StrictPatchSerializer):
    is_verified = serializers.BooleanField(required=True)


class ProductVisibilitySerializer(StrictPatchSerializer):
    is_active = serializers.BooleanField(required=True)
