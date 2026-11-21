from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView, UpdateAPIView
from drf_spectacular.utils import extend_schema, extend_schema_view

from .filters import ProductFiltersSerializer, public_products
from .models import Product, StockMovement
from .pagination import ProductCatalogPagination
from .permissions import IsActiveSeller, IsProductOwnerSeller
from .serializers import (
    ProductDetailSerializer,
    ProductListSerializer,
    ProductStockUpdateSerializer,
    SellerProductSerializer,
    StockMovementCreateSerializer,
    StockMovementSerializer,
)


@extend_schema_view(get=extend_schema(parameters=[ProductFiltersSerializer]))
class ProductListView(ListAPIView):
    serializer_class = ProductListSerializer
    pagination_class = ProductCatalogPagination

    def get_queryset(self):
        queryset = (
            public_products()
            .select_related(
                "seller",
                "category",
                "brand",
                "region",
            )
            .prefetch_related("images")
        )

        filters = ProductFiltersSerializer(data=self.request.query_params)
        filters.is_valid(raise_exception=True)
        return filters.filter_queryset(queryset)


class ProductDetailView(RetrieveAPIView):
    serializer_class = ProductDetailSerializer
    lookup_field = "slug"

    def get_queryset(self):
        return (
            public_products()
            .select_related(
                "seller",
                "category",
                "brand",
                "region",
            )
            .prefetch_related("images")
        )


class FeaturedProductListView(ProductListView):

    def get_queryset(self):
        return super().get_queryset().filter(is_featured=True)

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
        serializer.save(seller=self.request.user.seller_profile)

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
        serializer.save()

@extend_schema_view(post=extend_schema(responses={201: StockMovementSerializer}))
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
