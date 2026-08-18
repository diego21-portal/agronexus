from django.shortcuts import get_object_or_404
from rest_framework.generics import ListAPIView, ListCreateAPIView, UpdateAPIView
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly

from apps.products.models import Product
from apps.products.permissions import IsActiveSeller

from .models import ProductQuestion
from .serializers import (
    ProductQuestionCreateSerializer,
    ProductQuestionSerializer,
    SellerQuestionAnswerSerializer,
)


class ProductQuestionListCreateView(ListCreateAPIView):
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_product(self):
        return get_object_or_404(
            Product,
            slug=self.kwargs["slug"],
            is_active=True,
            status=Product.Status.PUBLISHED,
        )

    def get_queryset(self):
        product = self.get_product()

        return (
            ProductQuestion.objects.filter(
                product=product,
                status=ProductQuestion.Status.ANSWERED,
                is_public=True,
            )
            .select_related(
                "product",
                "user",
                "answered_by",
            )
            .order_by("-created_at")
        )

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ProductQuestionCreateSerializer
        return ProductQuestionSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["product"] = self.get_product()
        return context


class MyQuestionListView(ListAPIView):
    serializer_class = ProductQuestionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            ProductQuestion.objects.filter(
                user=self.request.user,
            )
            .select_related(
                "product",
                "user",
                "answered_by",
            )
            .order_by("-created_at")
        )


class SellerQuestionListView(ListAPIView):
    serializer_class = ProductQuestionSerializer
    permission_classes = [IsActiveSeller]

    def get_queryset(self):
        seller_profile = self.request.user.seller_profile

        queryset = (
            ProductQuestion.objects.filter(
                product__seller=seller_profile,
            )
            .select_related(
                "product",
                "user",
                "answered_by",
            )
            .order_by("-created_at")
        )

        status = self.request.query_params.get("status")
        product = self.request.query_params.get("product")

        if status:
            queryset = queryset.filter(status=status)

        if product:
            queryset = queryset.filter(product__slug=product)

        return queryset


class SellerQuestionAnswerView(UpdateAPIView):
    serializer_class = SellerQuestionAnswerSerializer
    permission_classes = [IsActiveSeller]

    def get_queryset(self):
        seller_profile = self.request.user.seller_profile

        return ProductQuestion.objects.filter(
            product__seller=seller_profile,
        ).select_related(
            "product",
            "user",
            "answered_by",
        )