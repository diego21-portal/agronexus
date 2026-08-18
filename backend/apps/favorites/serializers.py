from rest_framework import serializers

from apps.products.models import Product

from .models import FavoriteProduct


class FavoriteProductSerializer(serializers.ModelSerializer):
    product_id = serializers.IntegerField(source="product.id", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_slug = serializers.CharField(source="product.slug", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    product_price = serializers.DecimalField(
        source="product.price",
        max_digits=12,
        decimal_places=2,
        read_only=True,
    )
    product_discount_price = serializers.DecimalField(
        source="product.discount_price",
        max_digits=12,
        decimal_places=2,
        read_only=True,
    )
    product_current_price = serializers.DecimalField(
        source="product.current_price",
        max_digits=12,
        decimal_places=2,
        read_only=True,
    )
    product_stock = serializers.IntegerField(source="product.stock", read_only=True)
    product_status = serializers.CharField(source="product.status", read_only=True)
    product_average_rating = serializers.DecimalField(
        source="product.average_rating",
        max_digits=3,
        decimal_places=2,
        read_only=True,
    )
    product_total_reviews = serializers.IntegerField(
        source="product.total_reviews",
        read_only=True,
    )
    main_image = serializers.SerializerMethodField()

    class Meta:
        model = FavoriteProduct
        fields = (
            "id",
            "product_id",
            "product_name",
            "product_slug",
            "product_sku",
            "product_price",
            "product_discount_price",
            "product_current_price",
            "product_stock",
            "product_status",
            "product_average_rating",
            "product_total_reviews",
            "main_image",
            "created_at",
        )

    def get_main_image(self, obj):
        image = obj.product.images.filter(is_main=True).first()

        if not image:
            image = obj.product.images.first()

        if image and image.image:
            request = self.context.get("request")

            if request:
                return request.build_absolute_uri(image.image.url)

            return image.image.url

        return None


class FavoriteProductCreateSerializer(serializers.Serializer):
    product_id = serializers.PrimaryKeyRelatedField(
        source="product",
        queryset=Product.objects.all(),
    )

    def validate_product_id(self, product):
        if not product.is_active:
            raise serializers.ValidationError("El producto no está activo.")

        if product.status != Product.Status.PUBLISHED:
            raise serializers.ValidationError("El producto no está publicado.")

        return product

    def create(self, validated_data):
        request = self.context["request"]
        product = validated_data["product"]

        favorite, _ = FavoriteProduct.objects.get_or_create(
            user=request.user,
            product=product,
        )

        return favorite

    def to_representation(self, instance):
        return FavoriteProductSerializer(instance, context=self.context).data