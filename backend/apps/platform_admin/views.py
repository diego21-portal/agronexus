from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework.exceptions import ValidationError
from rest_framework.filters import SearchFilter
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.response import Response

from apps.dashboards.permissions import IsPlatformAdmin
from apps.orders.models import Order
from apps.orders.serializers import OrderSerializer
from apps.orders.views import orders_with_delivery
from apps.payments.models import Payment
from apps.products.models import Product
from apps.sellers.models import SellerProfile
from apps.shipments.models import Shipment
from apps.users.models import User

from .pagination import AdminListPagination
from .serializers import (
    AdminPaymentSerializer, AdminProductSerializer, AdminSellerSerializer,
    AdminShipmentSerializer, AdminUserSerializer, ProductVisibilitySerializer,
    SellerVerificationSerializer, UserAccessUpdateSerializer,
)
from .services import lock_active_admin, update_user_access


class PlatformAdminMixin:
    permission_classes = [IsPlatformAdmin]
    pagination_class = None


class AdminListView(PlatformAdminMixin, ListAPIView):
    pagination_class = AdminListPagination


@extend_schema_view(get=extend_schema(parameters=[
    OpenApiParameter("role", str, enum=User.Role.values, description="Rol efectivo del usuario."),
]))
class AdminUserListView(AdminListView):
    serializer_class = AdminUserSerializer
    queryset = User.objects.select_related("profile", "seller_profile").order_by("-date_joined", "-pk")
    filter_backends = [SearchFilter]
    search_fields = ("email", "username", "first_name", "last_name")

    def get_queryset(self):
        queryset = super().get_queryset()
        role = self.request.query_params.get("role")
        if not role:
            return queryset
        if role not in User.Role.values:
            raise ValidationError({"role": "Seleccioná un rol válido."})
        if role == User.Role.SUPER_ADMIN:
            return queryset.filter(Q(role=role) | Q(is_superuser=True))
        return queryset.filter(role=role, is_superuser=False)


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


class AdminSellerListView(AdminListView):
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


class AdminProductListView(AdminListView):
    serializer_class = AdminProductSerializer
    filter_backends = [SearchFilter]
    search_fields = ("name", "sku", "seller__business_name")

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


@extend_schema_view(get=extend_schema(parameters=[
    OpenApiParameter("status", str, enum=Order.Status.values, description="Estado de la orden."),
]))
class AdminOrderListView(AdminListView):
    serializer_class = OrderSerializer

    def get_queryset(self):
        queryset = orders_with_delivery().order_by("-created_at", "-pk")
        status = self.request.query_params.get("status")
        if not status:
            return queryset
        if status not in Order.Status.values:
            raise ValidationError({"status": "Seleccioná un estado válido."})
        return queryset.filter(status=status)


class AdminOrderDetailView(PlatformAdminMixin, RetrieveAPIView):
    serializer_class = OrderSerializer

    def get_queryset(self):
        return orders_with_delivery()


class AdminPaymentListView(AdminListView):
    serializer_class = AdminPaymentSerializer
    queryset = Payment.objects.select_related("order").prefetch_related("refunds").order_by("-created_at", "-pk")


class AdminShipmentListView(AdminListView):
    serializer_class = AdminShipmentSerializer
    queryset = Shipment.objects.select_related("order", "seller").prefetch_related(
        "order__items", "order__shipments", "events__created_by", "cancellations__events",
        "cancellations__refunds", "cancellations__inspections__order_item",
    ).order_by("-created_at", "-pk")
