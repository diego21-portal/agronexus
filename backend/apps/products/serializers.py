from rest_framework import serializers
from django.db import transaction

from .models import Product, ProductImage, StockMovement


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

    def get_main_image(self, obj):
        image = obj.images.filter(is_main=True).first()
        if not image:
            image = obj.images.first()

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
        price = attrs.get("price", getattr(self.instance, "price", None))
        discount_price = attrs.get(
            "discount_price",
            getattr(self.instance, "discount_price", None),
        )

        if price is not None and price < 0:
            raise serializers.ValidationError(
                {"price": "El precio no puede ser negativo."}
            )

        if discount_price is not None and price is not None:
            if discount_price >= price:
                raise serializers.ValidationError(
                    {
                        "discount_price": (
                            "El precio con descuento debe ser menor "
                            "que el precio original."
                        )
                    }
                )

        return attrs


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
        validated_data.pop("reason", None)
        return super().update(instance, validated_data)

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
            StockMovement.MovementType.RETURN,
            StockMovement.MovementType.CANCELLATION,
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
            StockMovement.MovementType.RETURN,
            StockMovement.MovementType.CANCELLATION,
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
        request = self.context["request"]
        product = validated_data["product"]
        movement_type = validated_data["movement_type"]
        quantity = validated_data["quantity"]
        reason = validated_data.get("reason", "")

        with transaction.atomic():
            product = Product.objects.select_for_update().get(pk=product.pk)

            previous_stock = product.stock
            new_stock = previous_stock + quantity

            if new_stock < 0:
                raise serializers.ValidationError(
                    {
                        "quantity": (
                            "El movimiento no puede dejar el stock en negativo."
                        )
                    }
                )

            product.stock = new_stock

            if product.stock == 0 and product.status == Product.Status.PUBLISHED:
                product.status = Product.Status.OUT_OF_STOCK

            if product.stock > 0 and product.status == Product.Status.OUT_OF_STOCK:
                product.status = Product.Status.PUBLISHED

            product.save(update_fields=["stock", "status", "updated_at"])

            movement = StockMovement.objects.create(
                product=product,
                movement_type=movement_type,
                quantity=quantity,
                previous_stock=previous_stock,
                new_stock=new_stock,
                reason=reason,
                created_by=request.user,
            )

            from apps.notifications.models import Notification
            from apps.notifications.services import create_notification

            if product.stock == 0:
                create_notification(
                    user=product.seller.user,
                    title="Producto agotado",
                    message=f"El producto {product.name} quedó sin stock.",
                    notification_type=Notification.NotificationType.PRODUCT_OUT_OF_STOCK,
                    related_object_type="Product",
                    related_object_id=product.id,
                    action_url=f"/seller/products/{product.id}",
                )
            elif product.minimum_stock > 0 and product.stock <= product.minimum_stock:
                create_notification(
                    user=product.seller.user,
                    title="Stock bajo",
                    message=f"El producto {product.name} está por debajo del stock mínimo.",
                    notification_type=Notification.NotificationType.STOCK_LOW,
                    related_object_type="Product",
                    related_object_id=product.id,
                    action_url=f"/seller/products/{product.id}",
                )            

        return movement

    def to_representation(self, instance):
        return StockMovementSerializer(instance, context=self.context).data                    