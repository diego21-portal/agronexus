from django.db.models import Q
from django.db import transaction
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView, UpdateAPIView

from .models import Product, StockMovement
from .permissions import IsActiveSeller, IsProductOwnerSeller
from .serializers import (
    ProductDetailSerializer,
    ProductListSerializer,
    ProductStockUpdateSerializer,
    SellerProductSerializer,
    StockMovementCreateSerializer,
    StockMovementSerializer,
)


class ProductListView(ListAPIView):
    serializer_class = ProductListSerializer

    def get_queryset(self):
        queryset = (
            Product.objects.filter(
                is_active=True,
                status=Product.Status.PUBLISHED,
            )
            .select_related(
                "seller",
                "category",
                "brand",
                "region",
            )
            .prefetch_related("images")
        )

        search = self.request.query_params.get("search")
        category = self.request.query_params.get("category")
        brand = self.request.query_params.get("brand")
        region = self.request.query_params.get("region")
        min_price = self.request.query_params.get("min_price")
        max_price = self.request.query_params.get("max_price")
        in_stock = self.request.query_params.get("in_stock")
        ordering = self.request.query_params.get("ordering")

        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(description__icontains=search)
                | Q(short_description__icontains=search)
                | Q(sku__icontains=search)
                | Q(brand__name__icontains=search)
            )

        if category:
            queryset = queryset.filter(category__slug=category)

        if brand:
            queryset = queryset.filter(brand__slug=brand)

        if region:
            queryset = queryset.filter(region__slug=region)

        if min_price:
            queryset = queryset.filter(price__gte=min_price)

        if max_price:
            queryset = queryset.filter(price__lte=max_price)

        if in_stock == "true":
            queryset = queryset.filter(stock__gt=0)

        allowed_ordering = {
            "price": "price",
            "-price": "-price",
            "created_at": "created_at",
            "-created_at": "-created_at",
            "rating": "-average_rating",
        }

        if ordering in allowed_ordering:
            queryset = queryset.order_by(allowed_ordering[ordering])

        return queryset


class ProductDetailView(RetrieveAPIView):
    serializer_class = ProductDetailSerializer
    lookup_field = "slug"

    def get_queryset(self):
        return (
            Product.objects.filter(
                is_active=True,
                status=Product.Status.PUBLISHED,
            )
            .select_related(
                "seller",
                "category",
                "brand",
                "region",
            )
            .prefetch_related("images")
        )


class FeaturedProductListView(ListAPIView):
    serializer_class = ProductListSerializer

    def get_queryset(self):
        return (
            Product.objects.filter(
                is_active=True,
                status=Product.Status.PUBLISHED,
                is_featured=True,
            )
            .select_related(
                "seller",
                "category",
                "brand",
                "region",
            )
            .prefetch_related("images")
        )
    
class SellerProductListCreateView(ListCreateAPIView):
    serializer_class = SellerProductSerializer
    permission_classes = [IsActiveSeller]

    def get_queryset(self):
        return (
            Product.objects.filter(
                seller=self.request.user.seller_profile,
            )
            .select_related(
                "seller",
                "category",
                "brand",
                "region",
            )
            .prefetch_related("images")
            .order_by("-created_at")
        )

    def perform_create(self, serializer):
        product = serializer.save(seller=self.request.user.seller_profile)

        StockMovement.objects.create(
            product=product,
            movement_type=StockMovement.MovementType.INITIAL,
            quantity=product.stock,
            previous_stock=0,
            new_stock=product.stock,
            reason="Stock inicial del producto.",
            created_by=self.request.user,
        )

class SellerProductDetailView(RetrieveUpdateDestroyAPIView):
    serializer_class = SellerProductSerializer
    permission_classes = [IsActiveSeller, IsProductOwnerSeller]

    def get_queryset(self):
        return (
            Product.objects.filter(
                seller=self.request.user.seller_profile,
            )
            .select_related(
                "seller",
                "category",
                "brand",
                "region",
            )
            .prefetch_related("images")
        )

    def perform_destroy(self, instance):
        instance.status = Product.Status.ARCHIVED
        instance.is_active = False
        instance.save(update_fields=["status", "is_active", "updated_at"])


class SellerProductStockUpdateView(UpdateAPIView):
    serializer_class = ProductStockUpdateSerializer
    permission_classes = [IsActiveSeller, IsProductOwnerSeller]

    def get_queryset(self):
        return Product.objects.filter(
            seller=self.request.user.seller_profile,
        )

    def perform_update(self, serializer):
        reason = serializer.validated_data.get(
            "reason",
            "Actualización manual de stock.",
        )

        with transaction.atomic():
            product = self.get_object()
            previous_stock = product.stock

            updated_product = serializer.save()
            new_stock = updated_product.stock
            quantity = new_stock - previous_stock

            if quantity != 0:
                StockMovement.objects.create(
                    product=updated_product,
                    movement_type=StockMovement.MovementType.MANUAL_ADJUSTMENT,
                    quantity=quantity,
                    previous_stock=previous_stock,
                    new_stock=new_stock,
                    reason=reason,
                    created_by=self.request.user,
                )

class SellerStockMovementListCreateView(ListCreateAPIView):
    permission_classes = [IsActiveSeller]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return StockMovementCreateSerializer
        return StockMovementSerializer

    def get_queryset(self):
        return (
            StockMovement.objects.filter(
                product__seller=self.request.user.seller_profile,
            )
            .select_related(
                "product",
                "created_by",
            )
            .order_by("-created_at")
        )                