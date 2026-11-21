from rest_framework.generics import CreateAPIView, ListAPIView, RetrieveAPIView, UpdateAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
from drf_spectacular.utils import extend_schema

from apps.shipments.models import Shipment
from apps.shipments.serializers import ShipmentStatusUpdateSerializer

from apps.products.permissions import IsActiveSeller

from .models import Order
from .checkout import create_quote
from .serializers import (
    CheckoutConflictSerializer, CheckoutQuoteResponseSerializer, CheckoutQuoteSerializer,
    CheckoutSerializer, OrderSerializer, OrderTrackingSerializer,
    SellerOrderSerializer, SellerOrderStatusUpdateSerializer,
)


def orders_with_delivery():
    return Order.objects.select_related("user", "payment").prefetch_related(
        "items__seller", "items__product", "shipments__seller", "shipments__events__created_by",
        "items__return_request", "payment__refunds", "shipments__cancellations__events",
        "shipments__cancellations__refunds", "shipments__cancellations__inspections__order_item",
    )


class CheckoutQuoteView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=CheckoutQuoteSerializer, responses={200: CheckoutQuoteResponseSerializer})
    def post(self, request):
        serializer = CheckoutQuoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        quote = create_quote(user=request.user, **serializer.validated_data)
        return Response(quote)


class CheckoutView(CreateAPIView):
    serializer_class = CheckoutSerializer
    permission_classes = [IsAuthenticated]

    @extend_schema(request=CheckoutSerializer, responses={200: OrderSerializer, 201: OrderSerializer, 409: CheckoutConflictSerializer})
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        response_status = status.HTTP_201_CREATED if serializer.was_created else status.HTTP_200_OK
        return Response(serializer.data, status=response_status)


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
