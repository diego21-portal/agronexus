from django.urls import path

from .views import (
    NotificationDeleteView,
    NotificationListView,
    NotificationReadAllView,
    NotificationReadView,
    UnreadNotificationListView,
)


urlpatterns = [
    path(
        "notifications/",
        NotificationListView.as_view(),
        name="notification-list",
    ),
    path(
        "notifications/unread/",
        UnreadNotificationListView.as_view(),
        name="notification-unread-list",
    ),
    path(
        "notifications/<int:pk>/read/",
        NotificationReadView.as_view(),
        name="notification-read",
    ),
    path(
        "notifications/read-all/",
        NotificationReadAllView.as_view(),
        name="notification-read-all",
    ),
    path(
        "notifications/<int:pk>/",
        NotificationDeleteView.as_view(),
        name="notification-delete",
    ),
]