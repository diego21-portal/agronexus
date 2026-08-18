from django.utils import timezone
from rest_framework import status
from rest_framework.generics import DestroyAPIView, ListAPIView, UpdateAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification
from .serializers import NotificationReadSerializer, NotificationSerializer


class NotificationListView(ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Notification.objects.filter(
            user=self.request.user,
        ).order_by("-created_at")

        is_read = self.request.query_params.get("is_read")
        notification_type = self.request.query_params.get("type")

        if is_read == "true":
            queryset = queryset.filter(is_read=True)

        if is_read == "false":
            queryset = queryset.filter(is_read=False)

        if notification_type:
            queryset = queryset.filter(notification_type=notification_type)

        return queryset


class UnreadNotificationListView(ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(
            user=self.request.user,
            is_read=False,
        ).order_by("-created_at")


class NotificationReadView(UpdateAPIView):
    serializer_class = NotificationReadSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)


class NotificationReadAllView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        now = timezone.now()

        updated_count = Notification.objects.filter(
            user=request.user,
            is_read=False,
        ).update(
            is_read=True,
            read_at=now,
            updated_at=now,
        )

        return Response(
            {
                "detail": "Todas las notificaciones fueron marcadas como leídas.",
                "updated_count": updated_count,
            },
            status=status.HTTP_200_OK,
        )


class NotificationDeleteView(DestroyAPIView):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)