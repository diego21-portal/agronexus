from rest_framework import serializers
from django.db import transaction
from drf_spectacular.utils import extend_schema_field

from .models import Product, ProductImage, StockMovement
from .services import change_stock


def validate_product_prices(attrs, instance=None):
    price = attrs.get("price", getattr(instance, "price", None))
    discount = attrs.get("discount_price", getattr(instance, "discount_price", None))
    if price is not None and price < 0:
        raise serializers.ValidationError({"price": "El precio no puede ser negativo."})
    if discount is not None and discount < 0:
        raise serializers.ValidationError({"discount_price": "El precio con descuento no puede ser negativo."})
    if discount is not None and price is not None and discount >= price:
        raise serializers.ValidationError({"discount_price": "El precio con descuento debe ser menor que el precio original."})
    return attrs


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = (
            "id",
            "image",
            "alt_text",
            "is_main",
            "order",
        )


class ProductListSerializer(serializers.ModelSerializer):
    seller = serializers.CharField(source="seller.business_name", read_only=True)
    category = serializers.CharField(source="category.name", read_only=True)
    brand = serializers.CharField(source="brand.name", read_only=True)
    region = serializers.CharField(source="region.name", read_only=True)
    current_price = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        read_only=True,
    )
    main_image = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = (
            "id",
            "name",
            "slug",
            "sku",
            "seller",
            "category",
            "brand",
            "region",
            "price",
            "discount_price",
            "current_price",
            "stock",
            "condition",
            "status",
            "shipping_available",
            "average_rating",
            "total_reviews",
            "is_featured",
            "main_image",
        )

    @extend_schema_field(serializers.URLField(allow_null=True, read_only=True))
    def get_main_image(self, obj) -> str | None:
        images = list(obj.images.all())
        image = next((image for image in images if image.is_main), None)
        if image is None:
            image = next(iter(images), None)

        if image and image.image:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(image.image.url)
            return image.image.url

        return None


class ProductDetailSerializer(serializers.ModelSerializer):
    seller = serializers.CharField(source="seller.business_name", read_only=True)
    category = serializers.CharField(source="category.name", read_only=True)
    brand = serializers.CharField(source="brand.name", read_only=True)
    region = serializers.CharField(source="region.name", read_only=True)
    current_price = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        read_only=True,
    )
    images = ProductImageSerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = (
            "id",
            "seller",
            "category",
            "brand",
            "region",
            "name",
            "slug",
            "sku",
            "short_description",
            "description",
            "technical_description",
            "price",
            "discount_price",
            "current_price",
            "unit",
            "stock",
            "minimum_stock",
            "condition",
            "status",
            "warranty",
            "shipping_available",
            "average_rating",
            "total_reviews",
            "is_featured",
            "images",
            "created_at",
            "updated_at",
        )

class SellerProductSerializer(serializers.ModelSerializer):
    seller = serializers.CharField(source="seller.business_name", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    brand_name = serializers.CharField(source="brand.name", read_only=True)
    region_name = serializers.CharField(source="region.name", read_only=True)
    current_price = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        read_only=True,
    )

    class Meta:
        model = Product
        fields = (
            "id",
            "seller",
            "category",
            "category_name",
            "brand",
            "brand_name",
            "region",
            "region_name",
            "name",
            "slug",
            "sku",
            "short_description",
            "description",
            "technical_description",
            "price",
            "discount_price",
            "current_price",
            "unit",
            "stock",
            "minimum_stock",
            "condition",
            "status",
            "warranty",
            "shipping_available",
            "average_rating",
            "total_reviews",
            "is_featured",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "seller",
            "slug",
            "average_rating",
            "total_reviews",
            "created_at",
            "updated_at",
        )

    def validate(self, attrs):
        return validate_product_prices(attrs, self.instance)

    def create(self, validated_data):
        values = dict(validated_data)
        initial_stock = values.pop("stock", 0)
        actor = self.context["request"].user
        with transaction.atomic():
            product = Product.objects.create(stock=0, **values)
            if initial_stock:
                return change_stock(
                    product_id=product.pk, delta=initial_stock, user=actor,
                    movement_type=StockMovement.MovementType.INITIAL,
                    reason="Stock inicial del producto.",
                    operation_key=f"initial:{product.pk}",
                ).product
            return product

    def update(self, instance, validated_data):
        values = dict(validated_data)
        requested_stock = values.pop("stock", None)
        with transaction.atomic():
            product = Product.objects.select_for_update().get(pk=instance.pk)
            validate_product_prices(values, product)
            product = super().update(product, values)
            if requested_stock is not None and requested_stock != product.stock:
                product = change_stock(
                    product_id=product.pk, delta=requested_stock - product.stock,
                    user=self.context["request"].user,
                    movement_type=StockMovement.MovementType.MANUAL_ADJUSTMENT,
                    reason="Ajuste desde la edición del producto.",
                ).product
            return product


class ProductStockUpdateSerializer(serializers.ModelSerializer):
    reason = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
        write_only=True,
    )

    class Meta:
        model = Product
        fields = (
            "stock",
            "minimum_stock",
            "status",
            "reason",
        )

    def validate_stock(self, value):
        if value < 0:
            raise serializers.ValidationError("El stock no puede ser negativo.")
        return value

    def update(self, instance, validated_data):
        values = dict(validated_data)
        reason = values.pop("reason", "") or "Actualización manual de stock."
        requested_stock = values.pop("stock", None)
        with transaction.atomic():
            product = Product.objects.select_for_update().get(pk=instance.pk)
            product = super().update(product, values)
            if requested_stock is not None and requested_stock != product.stock:
                product = change_stock(
                    product_id=product.pk, delta=requested_stock - product.stock,
                    user=self.context["request"].user,
                    movement_type=StockMovement.MovementType.MANUAL_ADJUSTMENT,
                    reason=reason,
                ).product
            return product

class StockMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    created_by_email = serializers.CharField(source="created_by.email", read_only=True)

    class Meta:
        model = StockMovement
        fields = (
            "id",
            "product",
            "product_name",
            "product_sku",
            "movement_type",
            "quantity",
            "previous_stock",
            "new_stock",
            "reason",
            "created_by_email",
            "created_at",
        )
        read_only_fields = fields

class StockMovementCreateSerializer(serializers.Serializer):
    product = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(),
    )
    movement_type = serializers.ChoiceField(
        choices=(
            StockMovement.MovementType.RESTOCK,
            StockMovement.MovementType.MANUAL_ADJUSTMENT,
        )
    )
    quantity = serializers.IntegerField()
    reason = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
    )

    def validate(self, attrs):
        request = self.context["request"]
        product = attrs["product"]
        quantity = attrs["quantity"]
        movement_type = attrs["movement_type"]

        seller_profile = getattr(request.user, "seller_profile", None)

        if not seller_profile:
            raise serializers.ValidationError(
                "El usuario no tiene un perfil de vendedor activo."
            )

        if product.seller_id != seller_profile.id:
            raise serializers.ValidationError(
                "No puedes modificar stock de productos que no te pertenecen."
            )

        if quantity == 0:
            raise serializers.ValidationError(
                {"quantity": "La cantidad no puede ser cero."}
            )

        positive_movements = [
            StockMovement.MovementType.RESTOCK,
        ]

        if movement_type in positive_movements and quantity < 0:
            raise serializers.ValidationError(
                {
                    "quantity": (
                        "Para reposiciones, devoluciones o cancelaciones "
                        "la cantidad debe ser positiva."
                    )
                }
            )

        return attrs

    def create(self, validated_data):
        return change_stock(
            product_id=validated_data["product"].pk,
            delta=validated_data["quantity"],
            user=self.context["request"].user,
            movement_type=validated_data["movement_type"],
            reason=validated_data.get("reason", ""),
        )

    def to_representation(self, instance):
        return StockMovementSerializer(instance, context=self.context).data
