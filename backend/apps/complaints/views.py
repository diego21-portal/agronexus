from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework.generics import CreateAPIView, ListAPIView, UpdateAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema, extend_schema_view

from apps.dashboards.permissions import IsPlatformAdmin
from apps.orders.models import Order, OrderItem
from apps.products.permissions import IsActiveSeller

from .models import Complaint, ReturnRequest
from .serializers import (
    AdminComplaintSerializer,
    AdminReturnRequestSerializer,
    ComplaintCreateSerializer,
    ComplaintSerializer,
    ComplaintStatusUpdateSerializer,
    ReturnRequestCreateSerializer,
    ReturnRequestSerializer,
    ReturnRequestStatusUpdateSerializer,
    ReturnReceiveSerializer,
    ReturnInspectSerializer,
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


@extend_schema_view(post=extend_schema(responses={201: ComplaintSerializer}))
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
                "inspection",
            )
            .prefetch_related("events")
            .order_by("-created_at")
        )


@extend_schema_view(post=extend_schema(responses={201: ReturnRequestSerializer}))
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
                Q(order_item__seller=seller_profile)
                | Q(order_item__isnull=True, order__items__seller=seller_profile),
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
                "inspection",
            )
            .prefetch_related("events")
            .order_by("-created_at")
        )

        status = self.request.query_params.get("status")

        if status:
            queryset = queryset.filter(status=status)

        return queryset


class AdminComplaintListView(ListAPIView):
    serializer_class = AdminComplaintSerializer
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


@extend_schema_view(
    put=extend_schema(responses=AdminComplaintSerializer),
    patch=extend_schema(responses=AdminComplaintSerializer),
)
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
    serializer_class = AdminReturnRequestSerializer
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
                "inspection",
            )
            .prefetch_related("events")
            .order_by("-created_at")
        )

        status = self.request.query_params.get("status")
        reason = self.request.query_params.get("reason")

        if status:
            queryset = queryset.filter(status=status)

        if reason:
            queryset = queryset.filter(reason=reason)

        return queryset


@extend_schema_view(
    put=extend_schema(responses=AdminReturnRequestSerializer),
    patch=extend_schema(responses=AdminReturnRequestSerializer),
)
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
            "inspection",
        ).prefetch_related("events")


class ReturnPhysicalActionView(APIView):
    """The warehouse records facts; customer endpoints never accept them."""

    permission_classes = [IsActiveSeller]
    administrative = False
    action = None

    def post(self, request, pk):
        from .services import inspect_return, receive_return

        queryset = ReturnRequest.objects.select_related("order_item__seller")
        if not self.administrative:
            queryset = queryset.filter(order_item__seller=request.user.seller_profile)
        record = get_object_or_404(queryset, pk=pk)
        serializer_class = ReturnReceiveSerializer if self.action == "receive" else ReturnInspectSerializer
        payload = serializer_class(data=request.data)
        payload.is_valid(raise_exception=True)
        operation = receive_return if self.action == "receive" else inspect_return
        result = operation(return_request_id=record.pk, user=request.user, **payload.validated_data)
        response_class = AdminReturnRequestSerializer if self.administrative else ReturnRequestSerializer
        return Response(response_class(result, context={"request": request}).data)


@extend_schema_view(post=extend_schema(
    request=ReturnReceiveSerializer, responses=ReturnRequestSerializer,
))
class SellerReturnReceiveView(ReturnPhysicalActionView):
    action = "receive"


@extend_schema_view(post=extend_schema(
    request=ReturnInspectSerializer, responses=ReturnRequestSerializer,
))
class SellerReturnInspectView(ReturnPhysicalActionView):
    action = "inspect"


@extend_schema_view(post=extend_schema(
    request=ReturnReceiveSerializer, responses=AdminReturnRequestSerializer,
))
class AdminReturnReceiveView(ReturnPhysicalActionView):
    permission_classes = [IsPlatformAdmin]
    administrative = True
    action = "receive"


@extend_schema_view(post=extend_schema(
    request=ReturnInspectSerializer, responses=AdminReturnRequestSerializer,
))
class AdminReturnInspectView(ReturnPhysicalActionView):
    permission_classes = [IsPlatformAdmin]
    administrative = True
    action = "inspect"
