from django.db import transaction
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.response import Response

from apps.dashboards.permissions import IsPlatformAdmin
from apps.orders.serializers import OrderSerializer
from apps.orders.views import orders_with_delivery
from apps.payments.models import Payment
from apps.products.models import Product
from apps.sellers.models import SellerProfile
from apps.shipments.models import Shipment
from apps.users.models import User

from .serializers import (
    AdminPaymentSerializer, AdminProductSerializer, AdminSellerSerializer,
    AdminShipmentSerializer, AdminUserSerializer, ProductVisibilitySerializer,
    SellerVerificationSerializer, UserAccessUpdateSerializer,
)
from .services import lock_active_admin, update_user_access


class PlatformAdminMixin:
    permission_classes = [IsPlatformAdmin]
    pagination_class = None


class AdminUserListView(PlatformAdminMixin, ListAPIView):
    serializer_class = AdminUserSerializer
    queryset = User.objects.select_related("profile", "seller_profile").order_by("-date_joined", "-pk")


class AdminUserDetailView(PlatformAdminMixin, RetrieveAPIView):
    serializer_class = AdminUserSerializer
    queryset = User.objects.select_related("profile", "seller_profile")

    @extend_schema(request=UserAccessUpdateSerializer, responses=AdminUserSerializer)
    def patch(self, request, *args, **kwargs):
        user = self.get_object()
        payload = UserAccessUpdateSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        user = update_user_access(
            actor_id=request.user.pk, user_id=user.pk, changes=payload.validated_data,
        )
        return Response(self.get_serializer(user).data)


class AdminSellerListView(PlatformAdminMixin, ListAPIView):
    serializer_class = AdminSellerSerializer
    queryset = SellerProfile.objects.select_related("user__profile", "user__seller_profile").order_by("business_name", "pk")


class AdminSellerVerifyView(PlatformAdminMixin, RetrieveAPIView):
    serializer_class = AdminSellerSerializer
    queryset = SellerProfile.objects.select_related("user__profile", "user__seller_profile")
    http_method_names = ["patch", "options"]

    @extend_schema(request=SellerVerificationSerializer, responses=AdminSellerSerializer)
    def patch(self, request, *args, **kwargs):
        self.get_object()
        payload = SellerVerificationSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        with transaction.atomic():
            lock_active_admin(request.user.pk)
            seller = get_object_or_404(SellerProfile.objects.select_for_update(), pk=kwargs["pk"])
            seller.is_verified = payload.validated_data["is_verified"]
            seller.save(update_fields=["is_verified", "updated_at"])
        return Response(self.get_serializer(seller).data)


def admin_products():
    return Product.objects.select_related("seller", "category", "brand", "region").prefetch_related("images")


class AdminProductListView(PlatformAdminMixin, ListAPIView):
    serializer_class = AdminProductSerializer

    def get_queryset(self):
        return admin_products().order_by("-created_at", "-pk")


class AdminProductDetailView(PlatformAdminMixin, RetrieveAPIView):
    serializer_class = AdminProductSerializer

    def get_queryset(self):
        return admin_products()

    @extend_schema(request=ProductVisibilitySerializer, responses=AdminProductSerializer)
    def patch(self, request, *args, **kwargs):
        self.get_object()
        payload = ProductVisibilitySerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        with transaction.atomic():
            lock_active_admin(request.user.pk)
            product = get_object_or_404(Product.objects.select_for_update(), pk=kwargs["pk"])
            product.is_active = payload.validated_data["is_active"]
            product.save(update_fields=["is_active", "updated_at"])
        return Response(self.get_serializer(product).data)


class AdminOrderListView(PlatformAdminMixin, ListAPIView):
    serializer_class = OrderSerializer

    def get_queryset(self):
        return orders_with_delivery().order_by("-created_at", "-pk")


class AdminOrderDetailView(PlatformAdminMixin, RetrieveAPIView):
    serializer_class = OrderSerializer

    def get_queryset(self):
        return orders_with_delivery()


class AdminPaymentListView(PlatformAdminMixin, ListAPIView):
    serializer_class = AdminPaymentSerializer
    queryset = Payment.objects.select_related("order").prefetch_related("refunds").order_by("-created_at", "-pk")


class AdminShipmentListView(PlatformAdminMixin, ListAPIView):
    serializer_class = AdminShipmentSerializer
    queryset = Shipment.objects.select_related("order", "seller").prefetch_related(
        "order__items", "order__shipments", "events__created_by", "cancellations__events",
        "cancellations__refunds", "cancellations__inspections__order_item",
    ).order_by("-created_at", "-pk")
