from django.urls import path

from .views import (
    SellerOrderDetailView,
    SellerOrderListView,
    SellerOrderStatusUpdateView,
    SellerShipmentStatusUpdateView,
)


urlpatterns = [
    path(
        "orders/",
        SellerOrderListView.as_view(),
        name="seller-order-list",
    ),
    path(
        "orders/<int:pk>/",
        SellerOrderDetailView.as_view(),
        name="seller-order-detail",
    ),
    path(
        "orders/<int:pk>/status/",
        SellerOrderStatusUpdateView.as_view(),
        name="seller-order-status-update",
    ),
    path(
        "shipments/<int:pk>/status/",
        SellerShipmentStatusUpdateView.as_view(),
        name="seller-shipment-status-update",
    ),
]