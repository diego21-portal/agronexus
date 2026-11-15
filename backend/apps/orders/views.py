from rest_framework.generics import CreateAPIView, ListAPIView, RetrieveAPIView, UpdateAPIView
from rest_framework.permissions import IsAuthenticated

from apps.shipments.models import Shipment
from apps.shipments.serializers import ShipmentStatusUpdateSerializer

from apps.products.permissions import IsActiveSeller

from .models import Order
from .serializers import (
    CheckoutSerializer, OrderSerializer, OrderTrackingSerializer,
    SellerOrderSerializer, SellerOrderStatusUpdateSerializer,
)


def orders_with_delivery():
    return Order.objects.select_related("user", "payment").prefetch_related(
        "items__seller", "items__product", "shipments__seller", "shipments__events__created_by",
    )


class CheckoutView(CreateAPIView):
    serializer_class = CheckoutSerializer
    permission_classes = [IsAuthenticated]


class OrderListView(ListAPIView):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            orders_with_delivery().filter(user=self.request.user)
            .order_by("-created_at")
        )


class OrderDetailView(RetrieveAPIView):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            orders_with_delivery().filter(user=self.request.user)
        )


class OrderTrackingView(RetrieveAPIView):
    serializer_class = OrderTrackingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return orders_with_delivery().filter(user=self.request.user)

class SellerOrderListView(ListAPIView):
    serializer_class = SellerOrderSerializer
    permission_classes = [IsActiveSeller]

    def get_queryset(self):
        seller_profile = self.request.user.seller_profile

        return (
            orders_with_delivery().filter(items__seller=seller_profile)
            .distinct()
            .order_by("-created_at")
        )


class SellerOrderDetailView(RetrieveAPIView):
    serializer_class = SellerOrderSerializer
    permission_classes = [IsActiveSeller]

    def get_queryset(self):
        seller_profile = self.request.user.seller_profile

        return (
            orders_with_delivery().filter(items__seller=seller_profile)
            .distinct()
        )


class SellerOrderStatusUpdateView(UpdateAPIView):
    serializer_class = SellerOrderStatusUpdateSerializer
    permission_classes = [IsActiveSeller]

    def get_queryset(self):
        seller_profile = self.request.user.seller_profile

        return orders_with_delivery().filter(items__seller=seller_profile).distinct()


class SellerShipmentStatusUpdateView(UpdateAPIView):
    serializer_class = ShipmentStatusUpdateSerializer
    permission_classes = [IsActiveSeller]

    def get_queryset(self):
        seller_profile = self.request.user.seller_profile

        return (
            Shipment.objects.filter(seller=seller_profile)
            .select_related("order")
            .prefetch_related("events")
        )
