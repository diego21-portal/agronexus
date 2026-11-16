from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.dashboards.permissions import IsPlatformAdmin
from apps.products.permissions import IsActiveSeller

from .models import CancellationRequest
from .serializers import (
    AdminCancellationSerializer, CancellationActionSerializer,
    CancellationCreateSerializer, CancellationSerializer,
)
from .services import process_cancellation, request_cancellation, withdraw_cancellation


def cancellations_with_details():
    return CancellationRequest.objects.select_related(
        "user", "shipment__seller", "shipment__order__payment",
    ).prefetch_related(
        "inspections__order_item", "events", "refunds", "shipment__order__payment__refunds",
    )


class CancellationCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        serializer = CancellationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        case, created = request_cancellation(shipment_id=pk, user=request.user, **serializer.validated_data)
        return Response(CancellationSerializer(case).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class CancellationWithdrawView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        case = withdraw_cancellation(case_id=pk, user=request.user)
        return Response(CancellationSerializer(case).data)


class UserCancellationListView(ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CancellationSerializer

    def get_queryset(self):
        return cancellations_with_details().filter(user=self.request.user)


class SellerCancellationListView(ListAPIView):
    permission_classes = [IsActiveSeller]
    serializer_class = CancellationSerializer

    def get_queryset(self):
        return cancellations_with_details().filter(shipment__seller=self.request.user.seller_profile)


class AdminCancellationListView(ListAPIView):
    permission_classes = [IsPlatformAdmin]
    serializer_class = AdminCancellationSerializer

    def get_queryset(self):
        return cancellations_with_details()


class SellerCancellationActionView(APIView):
    permission_classes = [IsActiveSeller]
    serializer_class = CancellationSerializer

    def post(self, request, pk):
        serializer = CancellationActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        case = process_cancellation(case_id=pk, user=request.user, **serializer.validated_data)
        return Response(self.serializer_class(case).data)


class AdminCancellationActionView(SellerCancellationActionView):
    permission_classes = [IsPlatformAdmin]
    serializer_class = AdminCancellationSerializer
