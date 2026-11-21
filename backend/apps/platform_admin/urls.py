from django.urls import path

from .views import (
    AdminOrderDetailView, AdminOrderListView, AdminPaymentListView,
    AdminProductDetailView, AdminProductListView, AdminSellerListView,
    AdminSellerVerifyView, AdminShipmentListView, AdminUserDetailView, AdminUserListView,
)


urlpatterns = [
    path("users/", AdminUserListView.as_view(), name="platform-admin-users"),
    path("users/<int:pk>/", AdminUserDetailView.as_view(), name="platform-admin-user-detail"),
    path("sellers/", AdminSellerListView.as_view(), name="platform-admin-sellers"),
    path("sellers/<int:pk>/verify/", AdminSellerVerifyView.as_view(), name="platform-admin-seller-verify"),
    path("products/", AdminProductListView.as_view(), name="platform-admin-products"),
    path("products/<int:pk>/", AdminProductDetailView.as_view(), name="platform-admin-product-detail"),
    path("orders/", AdminOrderListView.as_view(), name="platform-admin-orders"),
    path("orders/<int:pk>/", AdminOrderDetailView.as_view(), name="platform-admin-order-detail"),
    path("payments/", AdminPaymentListView.as_view(), name="platform-admin-payments"),
    path("shipments/", AdminShipmentListView.as_view(), name="platform-admin-shipments"),
]
