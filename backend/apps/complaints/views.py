from django.shortcuts import get_object_or_404
from rest_framework.generics import CreateAPIView, ListAPIView, UpdateAPIView
from rest_framework.permissions import IsAuthenticated

from apps.dashboards.permissions import IsPlatformAdmin
from apps.orders.models import Order, OrderItem
from apps.products.permissions import IsActiveSeller

from .models import Complaint, ReturnRequest
from .serializers import (
    ComplaintCreateSerializer,
    ComplaintSerializer,
    ComplaintStatusUpdateSerializer,
    ReturnRequestCreateSerializer,
    ReturnRequestSerializer,
    ReturnRequestStatusUpdateSerializer,
)


class UserComplaintListView(ListAPIView):
    serializer_class = ComplaintSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Complaint.objects.filter(user=self.request.user)
            .select_related(
                "order",
                "order_item",
                "order_item__seller",
                "resolved_by",
            )
            .order_by("-created_at")
        )


class OrderComplaintCreateView(CreateAPIView):
    serializer_class = ComplaintCreateSerializer
    permission_classes = [IsAuthenticated]

    def get_order(self):
        return get_object_or_404(
            Order,
            pk=self.kwargs["pk"],
            user=self.request.user,
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["order"] = self.get_order()
        return context


class UserReturnRequestListView(ListAPIView):
    serializer_class = ReturnRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            ReturnRequest.objects.filter(user=self.request.user)
            .select_related(
                "order_item",
                "order_item__order",
                "order_item__seller",
                "resolved_by",
            )
            .order_by("-created_at")
        )


class OrderItemReturnRequestCreateView(CreateAPIView):
    serializer_class = ReturnRequestCreateSerializer
    permission_classes = [IsAuthenticated]

    def get_order_item(self):
        return get_object_or_404(
            OrderItem,
            pk=self.kwargs["pk"],
            order__user=self.request.user,
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["order_item"] = self.get_order_item()
        return context


class SellerComplaintListView(ListAPIView):
    serializer_class = ComplaintSerializer
    permission_classes = [IsActiveSeller]

    def get_queryset(self):
        seller_profile = self.request.user.seller_profile

        queryset = (
            Complaint.objects.filter(
                order__items__seller=seller_profile,
            )
            .distinct()
            .select_related(
                "order",
                "order_item",
                "order_item__seller",
                "user",
                "resolved_by",
            )
            .order_by("-created_at")
        )

        status = self.request.query_params.get("status")

        if status:
            queryset = queryset.filter(status=status)

        return queryset


class SellerReturnRequestListView(ListAPIView):
    serializer_class = ReturnRequestSerializer
    permission_classes = [IsActiveSeller]

    def get_queryset(self):
        seller_profile = self.request.user.seller_profile

        queryset = (
            ReturnRequest.objects.filter(
                order_item__seller=seller_profile,
            )
            .select_related(
                "order_item",
                "order_item__order",
                "user",
                "resolved_by",
            )
            .order_by("-created_at")
        )

        status = self.request.query_params.get("status")

        if status:
            queryset = queryset.filter(status=status)

        return queryset


class AdminComplaintListView(ListAPIView):
    serializer_class = ComplaintSerializer
    permission_classes = [IsPlatformAdmin]

    def get_queryset(self):
        queryset = (
            Complaint.objects.all()
            .select_related(
                "order",
                "order_item",
                "order_item__seller",
                "user",
                "resolved_by",
            )
            .order_by("-created_at")
        )

        status = self.request.query_params.get("status")
        complaint_type = self.request.query_params.get("type")

        if status:
            queryset = queryset.filter(status=status)

        if complaint_type:
            queryset = queryset.filter(complaint_type=complaint_type)

        return queryset


class AdminComplaintStatusUpdateView(UpdateAPIView):
    serializer_class = ComplaintStatusUpdateSerializer
    permission_classes = [IsPlatformAdmin]

    def get_queryset(self):
        return Complaint.objects.all().select_related(
            "order",
            "order_item",
            "order_item__seller",
            "user",
            "resolved_by",
        )


class AdminReturnRequestListView(ListAPIView):
    serializer_class = ReturnRequestSerializer
    permission_classes = [IsPlatformAdmin]

    def get_queryset(self):
        queryset = (
            ReturnRequest.objects.all()
            .select_related(
                "order_item",
                "order_item__order",
                "order_item__seller",
                "user",
                "resolved_by",
            )
            .order_by("-created_at")
        )

        status = self.request.query_params.get("status")
        reason = self.request.query_params.get("reason")

        if status:
            queryset = queryset.filter(status=status)

        if reason:
            queryset = queryset.filter(reason=reason)

        return queryset


class AdminReturnRequestStatusUpdateView(UpdateAPIView):
    serializer_class = ReturnRequestStatusUpdateSerializer
    permission_classes = [IsPlatformAdmin]

    def get_queryset(self):
        return ReturnRequest.objects.all().select_related(
            "order_item",
            "order_item__order",
            "order_item__seller",
            "user",
            "resolved_by",
        )