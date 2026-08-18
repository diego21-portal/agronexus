from rest_framework import serializers

from apps.products.models import Product

from .models import Cart, CartItem


class CartItemSerializer(serializers.ModelSerializer):
    product_id = serializers.IntegerField(source="product.id", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_slug = serializers.CharField(source="product.slug", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    product_stock = serializers.IntegerField(source="product.stock", read_only=True)
    subtotal = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        read_only=True,
    )

    class Meta:
        model = CartItem
        fields = (
            "id",
            "product_id",
            "product_name",
            "product_slug",
            "product_sku",
            "product_stock",
            "quantity",
            "unit_price",
            "subtotal",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    items_count = serializers.IntegerField(read_only=True)
    subtotal = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        read_only=True,
    )

    class Meta:
        model = Cart
        fields = (
            "id",
            "status",
            "items_count",
            "subtotal",
            "items",
            "created_at",
            "updated_at",
        )


class CartItemCreateSerializer(serializers.Serializer):
    product_id = serializers.PrimaryKeyRelatedField(
        source="product",
        queryset=Product.objects.all(),
    )
    quantity = serializers.IntegerField(min_value=1)

    def validate(self, attrs):
        product = attrs["product"]
        quantity = attrs["quantity"]

        if not product.is_active:
            raise serializers.ValidationError(
                {"product_id": "El producto no está activo."}
            )

        if product.status != Product.Status.PUBLISHED:
            raise serializers.ValidationError(
                {"product_id": "El producto no está publicado."}
            )

        if product.stock <= 0:
            raise serializers.ValidationError(
                {"product_id": "El producto no tiene stock disponible."}
            )

        if quantity > product.stock:
            raise serializers.ValidationError(
                {"quantity": "La cantidad supera el stock disponible."}
            )

        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        product = validated_data["product"]
        quantity = validated_data["quantity"]

        cart, _ = Cart.objects.get_or_create(
            user=request.user,
            status=Cart.Status.ACTIVE,
        )

        item = CartItem.objects.filter(
            cart=cart,
            product=product,
        ).first()

        if item:
            new_quantity = item.quantity + quantity

            if new_quantity > product.stock:
                raise serializers.ValidationError(
                    {
                        "quantity": (
                            "La cantidad total en el carrito supera "
                            "el stock disponible."
                        )
                    }
                )

            item.quantity = new_quantity
            item.unit_price = product.current_price
            item.save(update_fields=["quantity", "unit_price", "updated_at"])
            return item

        return CartItem.objects.create(
            cart=cart,
            product=product,
            quantity=quantity,
            unit_price=product.current_price,
        )

    def to_representation(self, instance):
        return CartItemSerializer(instance, context=self.context).data


class CartItemUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CartItem
        fields = (
            "quantity",
        )

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("La cantidad debe ser mayor que cero.")

        product = self.instance.product

        if value > product.stock:
            raise serializers.ValidationError(
                "La cantidad supera el stock disponible."
            )

        if not product.is_active or product.status != Product.Status.PUBLISHED:
            raise serializers.ValidationError(
                "El producto ya no está disponible para la compra."
            )

        return value

    def update(self, instance, validated_data):
        instance.quantity = validated_data["quantity"]
        instance.unit_price = instance.product.current_price
        instance.save(update_fields=["quantity", "unit_price", "updated_at"])
        return instance

    def to_representation(self, instance):
        return CartItemSerializer(instance, context=self.context).data