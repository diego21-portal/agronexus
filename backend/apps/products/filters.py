from django.db.models import Q
from django.db.models.functions import Coalesce
from rest_framework import serializers

from .models import Product


PRODUCT_ORDERING = {
    "price": "effective_price",
    "-price": "-effective_price",
    "created_at": "created_at",
    "-created_at": "-created_at",
    "rating": "-average_rating",
    "average_rating": "average_rating",
    "-average_rating": "-average_rating",
}


def public_products():
    """Use the same publication rules for catalogue and public reviews."""
    return Product.objects.filter(
        is_active=True,
        status=Product.Status.PUBLISHED,
        seller__is_active=True,
        seller__user__is_active=True,
    )


class ProductFiltersSerializer(serializers.Serializer):
    search = serializers.CharField(required=False, allow_blank=True)
    category = serializers.CharField(required=False, allow_blank=True)
    brand = serializers.CharField(required=False, allow_blank=True)
    region = serializers.CharField(required=False, allow_blank=True)
    min_price = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=0, required=False,
    )
    max_price = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=0, required=False,
    )
    in_stock = serializers.BooleanField(required=False)
    ordering = serializers.ChoiceField(
        choices=tuple(PRODUCT_ORDERING), required=False, allow_blank=True,
    )

    def validate(self, attrs):
        minimum = attrs.get("min_price")
        maximum = attrs.get("max_price")
        if minimum is not None and maximum is not None and minimum > maximum:
            raise serializers.ValidationError({
                "max_price": "El precio máximo debe ser mayor o igual al mínimo.",
            })
        return attrs

    def filter_queryset(self, queryset):
        filters = self.validated_data
        queryset = queryset.alias(effective_price=Coalesce("discount_price", "price"))
        if search := filters.get("search"):
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(description__icontains=search)
                | Q(short_description__icontains=search)
                | Q(sku__icontains=search)
                | Q(brand__name__icontains=search)
            )
        for field in ("category", "brand", "region"):
            if slug := filters.get(field):
                queryset = queryset.filter(**{f"{field}__slug": slug})
        if "min_price" in filters:
            queryset = queryset.filter(effective_price__gte=filters["min_price"])
        if "max_price" in filters:
            queryset = queryset.filter(effective_price__lte=filters["max_price"])
        if filters.get("in_stock"):
            queryset = queryset.filter(stock__gt=0)
        ordering = PRODUCT_ORDERING.get(filters.get("ordering"), "-created_at")
        return queryset.order_by(ordering, "pk")
