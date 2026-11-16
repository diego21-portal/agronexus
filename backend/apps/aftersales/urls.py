from django.urls import path

from .views import (
    AdminCancellationActionView, AdminCancellationListView, CancellationCreateView,
    CancellationWithdrawView, SellerCancellationActionView, SellerCancellationListView,
    UserCancellationListView,
)


urlpatterns = [
    path("shipments/<int:pk>/cancellation/", CancellationCreateView.as_view(), name="cancellation-create"),
    path("cancellations/<int:pk>/withdraw/", CancellationWithdrawView.as_view(), name="cancellation-withdraw"),
    path("users/me/cancellations/", UserCancellationListView.as_view(), name="user-cancellations"),
    path("seller/cancellations/", SellerCancellationListView.as_view(), name="seller-cancellations"),
    path("seller/cancellations/<int:pk>/action/", SellerCancellationActionView.as_view(), name="seller-cancellation-action"),
    path("admin/cancellations/", AdminCancellationListView.as_view(), name="admin-cancellations"),
    path("admin/cancellations/<int:pk>/action/", AdminCancellationActionView.as_view(), name="admin-cancellation-action"),
]
