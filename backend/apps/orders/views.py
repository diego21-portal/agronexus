from rest_framework.generics import CreateAPIView, ListAPIView, RetrieveAPIView, UpdateAPIView
from rest_framework.permissions import IsAuthenticated

from apps.shipments.models import Shipment
from apps.shipments.serializers import ShipmentSerializer, ShipmentStatusUpdateSerializer

from apps.products.permissions import IsActiveSeller

from .models import Order
from .serializers import CheckoutSerializer, OrderSerializer, SellerOrderSerializer, SellerOrderStatusUpdateSerializer


class CheckoutView(CreateAPIView):
    serializer_class = CheckoutSerializer
    permission_classes = [IsAuthenticated]


class OrderListView(ListAPIView):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Order.objects.filter(user=self.request.user)
            .prefetch_related(
                "items",
                "items__seller",
                "payment",
                "shipment",
                "shipment__events",
            )
            .order_by("-created_at")
        )


class OrderDetailView(RetrieveAPIView):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Order.objects.filter(user=self.request.user)
            .prefetch_related(
                "items",
                "items__seller",
                "payment",
                "shipment",
                "shipment__events",
            )
        )


class OrderTrackingView(RetrieveAPIView):
    serializer_class = ShipmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Shipment.objects.filter(order__user=self.request.user)
            .select_related("order")
            .prefetch_related("events")
        )

    def get_object(self):
        order_id = self.kwargs["pk"]
        return self.get_queryset().get(order_id=order_id)

class SellerOrderListView(ListAPIView):
    serializer_class = SellerOrderSerializer
    permission_classes = [IsActiveSeller]

    def get_queryset(self):
        seller_profile = self.request.user.seller_profile

        return (
            Order.objects.filter(items__seller=seller_profile)
            .distinct()
            .select_related(
                "user",
                "payment",
                "shipment",
            )
            .prefetch_related(
                "items",
                "items__seller",
            )
            .order_by("-created_at")
        )


class SellerOrderDetailView(RetrieveAPIView):
    serializer_class = SellerOrderSerializer
    permission_classes = [IsActiveSeller]

    def get_queryset(self):
        seller_profile = self.request.user.seller_profile

        return (
            Order.objects.filter(items__seller=seller_profile)
            .distinct()
            .select_related(
                "user",
                "payment",
                "shipment",
            )
            .prefetch_related(
                "items",
                "items__seller",
            )
        )


class SellerOrderStatusUpdateView(UpdateAPIView):
    serializer_class = SellerOrderStatusUpdateSerializer
    permission_classes = [IsActiveSeller]

    def get_queryset(self):
        seller_profile = self.request.user.seller_profile

        return Order.objects.filter(items__seller=seller_profile).distinct()


class SellerShipmentStatusUpdateView(UpdateAPIView):
    serializer_class = ShipmentStatusUpdateSerializer
    permission_classes = [IsActiveSeller]

    def get_queryset(self):
        seller_profile = self.request.user.seller_profile

        return (
            Shipment.objects.filter(order__items__seller=seller_profile)
            .distinct()
            .select_related("order")
            .prefetch_related("events")
        )