from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import Address, User, UserProfile


class UserRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        validators=[validate_password],
    )
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "username",
            "first_name",
            "last_name",
            "password",
            "password_confirm",
        )
        read_only_fields = ("id",)

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError(
                {"password_confirm": "Las contraseñas no coinciden."}
            )
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        password = validated_data.pop("password")

        user = User.objects.create_user(
            password=password,
            role=User.Role.CUSTOMER,
            **validated_data,
        )

        return user


class UserProfileSerializer(serializers.ModelSerializer):
    preferred_region_name = serializers.CharField(
        source="preferred_region.name",
        read_only=True,
    )

    class Meta:
        model = UserProfile
        fields = (
            "id",
            "phone",
            "avatar",
            "document_type",
            "document_number",
            "birth_date",
            "preferred_region",
            "preferred_region_name",
            "preferred_theme",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "created_at",
            "updated_at",
        )


class UserMeSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "username",
            "first_name",
            "last_name",
            "role",
            "profile",
        )
        read_only_fields = (
            "id",
            "email",
            "role",
        )


class UserPreferencesSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = (
            "preferred_region",
            "preferred_theme",
        )


class AddressSerializer(serializers.ModelSerializer):
    region_name = serializers.CharField(source="region.name", read_only=True)

    class Meta:
        model = Address
        fields = (
            "id",
            "region",
            "region_name",
            "street",
            "number",
            "city",
            "province",
            "postal_code",
            "reference",
            "is_default",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "created_at",
            "updated_at",
        )

    def validate(self, attrs):
        street = attrs.get("street", getattr(self.instance, "street", None))
        number = attrs.get("number", getattr(self.instance, "number", None))
        city = attrs.get("city", getattr(self.instance, "city", None))
        province = attrs.get("province", getattr(self.instance, "province", None))

        if not street:
            raise serializers.ValidationError({"street": "La calle es obligatoria."})

        if not number:
            raise serializers.ValidationError({"number": "El número es obligatorio."})

        if not city:
            raise serializers.ValidationError({"city": "La ciudad es obligatoria."})

        if not province:
            raise serializers.ValidationError(
                {"province": "La provincia es obligatoria."}
            )

        return attrs