from rest_framework import serializers

from apps.products.models import Product

from .models import Cart, CartItem
from .services import add_cart_item, update_cart_item, validate_product


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
        queryset=Product.objects.select_related("seller__user"),
    )
    quantity = serializers.IntegerField(min_value=1)

    def validate(self, attrs):
        product = attrs["product"]
        quantity = attrs["quantity"]

        validate_product(product, quantity)
        # Preserve the cart selected by this request. If checkout converts it
        # before save(), the locked write must reject rather than change it.
        attrs["cart_id"] = Cart.objects.filter(
            user=self.context["request"].user, status=Cart.Status.ACTIVE,
        ).values_list("pk", flat=True).first()
        return attrs

    def create(self, validated_data):
        return add_cart_item(
            user=self.context["request"].user,
            product_id=validated_data["product"].pk,
            quantity=validated_data["quantity"],
            cart_id=validated_data["cart_id"],
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

        return value

    def validate(self, attrs):
        if "quantity" not in attrs:
            raise serializers.ValidationError({"quantity": "Indica la cantidad."})
        validate_product(self.instance.product, attrs["quantity"])
        return attrs

    def update(self, instance, validated_data):
        return update_cart_item(
            user=self.context["request"].user,
            item_id=instance.pk,
            cart_id=instance.cart_id,
            quantity=validated_data["quantity"],
        )

    def to_representation(self, instance):
        return CartItemSerializer(instance, context=self.context).data
