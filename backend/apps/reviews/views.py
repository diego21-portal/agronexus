from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.permissions import IsAuthenticatedOrReadOnly

from apps.products.models import Product

from .models import ProductReview
from .permissions import IsReviewOwner
from .serializers import (
    ProductReviewCreateSerializer,
    ProductReviewSerializer,
    ProductReviewUpdateSerializer,
)


class ProductReviewListCreateView(ListCreateAPIView):
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_product(self):
        return Product.objects.get(
            slug=self.kwargs["slug"],
            is_active=True,
            status=Product.Status.PUBLISHED,
        )

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


class ProductReviewDetailView(RetrieveUpdateDestroyAPIView):
    serializer_class = ProductReviewUpdateSerializer
    permission_classes = [IsReviewOwner]

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