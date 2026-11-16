from django.urls import path

from .views import (
    AdminComplaintListView,
    AdminComplaintStatusUpdateView,
    AdminReturnRequestListView,
    AdminReturnRequestStatusUpdateView,
    AdminReturnReceiveView,
    AdminReturnInspectView,
    OrderComplaintCreateView,
    OrderItemReturnRequestCreateView,
    SellerComplaintListView,
    SellerReturnRequestListView,
    SellerReturnReceiveView,
    SellerReturnInspectView,
    UserComplaintListView,
    UserReturnRequestListView,
)


urlpatterns = [
    path(
        "users/me/complaints/",
        UserComplaintListView.as_view(),
        name="user-complaint-list",
    ),
    path(
        "orders/<int:pk>/complaints/",
        OrderComplaintCreateView.as_view(),
        name="order-complaint-create",
    ),
    path(
        "users/me/returns/",
        UserReturnRequestListView.as_view(),
        name="user-return-list",
    ),
    path(
        "order-items/<int:pk>/returns/",
        OrderItemReturnRequestCreateView.as_view(),
        name="order-item-return-create",
    ),
    path(
        "seller/complaints/",
        SellerComplaintListView.as_view(),
        name="seller-complaint-list",
    ),
    path(
        "seller/returns/",
        SellerReturnRequestListView.as_view(),
        name="seller-return-list",
    ),
    path(
        "admin/complaints/",
        AdminComplaintListView.as_view(),
        name="admin-complaint-list",
    ),
    path(
        "admin/complaints/<int:pk>/status/",
        AdminComplaintStatusUpdateView.as_view(),
        name="admin-complaint-status-update",
    ),
    path(
        "admin/returns/",
        AdminReturnRequestListView.as_view(),
        name="admin-return-list",
    ),
    path(
        "admin/returns/<int:pk>/status/",
        AdminReturnRequestStatusUpdateView.as_view(),
        name="admin-return-status-update",
    ),
    path("seller/returns/<int:pk>/receive/", SellerReturnReceiveView.as_view(), name="seller-return-receive"),
    path("seller/returns/<int:pk>/inspect/", SellerReturnInspectView.as_view(), name="seller-return-inspect"),
    path("admin/returns/<int:pk>/receive/", AdminReturnReceiveView.as_view(), name="admin-return-receive"),
    path("admin/returns/<int:pk>/inspect/", AdminReturnInspectView.as_view(), name="admin-return-inspect"),
]
