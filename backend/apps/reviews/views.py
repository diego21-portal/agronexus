from django.shortcuts import get_object_or_404
from rest_framework.generics import ListAPIView, ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from drf_spectacular.utils import extend_schema, extend_schema_view

from apps.products.filters import public_products

from .models import ProductReview
from .permissions import IsReviewOwner
from .serializers import (
    ProductReviewCreateSerializer,
    ProductReviewSerializer,
    ProductReviewUpdateSerializer,
)


@extend_schema_view(post=extend_schema(
    request=ProductReviewCreateSerializer,
    responses={201: ProductReviewSerializer},
))
class ProductReviewListCreateView(ListCreateAPIView):
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_product(self):
        if not hasattr(self, "_product"):
            self._product = get_object_or_404(public_products(), slug=self.kwargs["slug"])
        return self._product

    def get_queryset(self):
        product = self.get_product()

        return (
            ProductReview.objects.filter(
                product=product,
                is_public=True,
            )
            .select_related(
                "product",
                "user",
                "order_item",
            )
            .order_by("-created_at")
        )

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ProductReviewCreateSerializer
        return ProductReviewSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["product"] = self.get_product()
        return context


@extend_schema_view(
    get=extend_schema(responses=ProductReviewSerializer),
    patch=extend_schema(request=ProductReviewUpdateSerializer, responses=ProductReviewSerializer),
    put=extend_schema(request=ProductReviewUpdateSerializer, responses=ProductReviewSerializer),
)
class ProductReviewDetailView(RetrieveUpdateDestroyAPIView):
    serializer_class = ProductReviewUpdateSerializer
    permission_classes = [IsAuthenticated, IsReviewOwner]

    def get_queryset(self):
        return ProductReview.objects.filter(
            user=self.request.user,
        ).select_related(
            "product",
            "user",
            "order_item",
        )

    def perform_destroy(self, instance):
        instance.delete()


class MyProductReviewListView(ListAPIView):
    serializer_class = ProductReviewSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            ProductReview.objects.filter(user=self.request.user)
            .select_related("product", "user")
            .order_by("-created_at", "pk")
        )
