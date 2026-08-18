from rest_framework import serializers
from apps.orders.models import Order, OrderItem
from .models import ProductReview

class ProductReviewSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = ProductReview
        fields = (
            "id",
            "product",
            "product_name",
            "user_name",
            "rating",
            "comment",
            "is_public",
            "created_at",
            "updated_at", 
        )

    def get_user_name(self, obj):
        full_name = f"{obj.user.first_name} {obj.user.last_name}".strip()
        return full_name or obj.user.first_name

class ProductReviewCreateSerializer(serializers.ModelSerializer):
    order_item_id = serializers.PrimaryKeyRelatedField(
        source="order_item",
        queryset=OrderItem.objects.select_related("order", "product"),
        write_only=True,
    )

    class Meta:
        model = ProductReview
        fields = (
            "id",
            "order_item_id",
            "rating",
            "comment",
        )
        read_only_fields = ("id",)

    def validate_rating(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError(
                "La calificación debe estar entre 1 y 5."
            )
        return value

    def validate(self, attrs):
        request = self.context["request"]
        product = self.context["product"]
        order_item = attrs["order_item"]

        if order_item.order.user_id != request.user.id:
            raise serializers.ValidationError(
                {"order_item_id": "Este ítem no pertenece a tus compras."}
            )

        if order_item.product_id != product.id:
            raise serializers.ValidationError(
                {
                    "order_item_id": (
                        "El ítem comprado no corresponde al producto reseñado."
                    )
                }
            )

        if order_item.order.status != Order.Status.DELIVERED:
            raise serializers.ValidationError(
                {
                    "order_item_id": (
                        "Solo puedes reseñar productos de pedidos entregados."
                    )
                }
            )

        if hasattr(order_item, "review"):
            raise serializers.ValidationError(
                {"order_item_id": "Este producto comprado ya fue reseñado."}
            )

        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        product = self.context["product"]

        review = ProductReview.objects.create(
            product=product,
            user=request.user,
            order_item=validated_data["order_item"],
            rating=validated_data["rating"],
            comment=validated_data.get("comment", ""),
        )

        return review

    def to_representation(self, instance):
        return ProductReviewSerializer(instance, context=self.context).data


class ProductReviewUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductReview
        fields = (
            "rating",
            "comment",
            "is_public",
        )

    def validate_rating(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError(
                "La calificación debe estar entre 1 y 5."
            )
        return value

    def to_representation(self, instance):
        return ProductReviewSerializer(instance, context=self.context).data            
