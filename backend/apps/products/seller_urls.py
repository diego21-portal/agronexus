from django.urls import path

from .views import (
    SellerProductDetailView,
    SellerProductListCreateView,
    SellerProductStockUpdateView,
)


urlpatterns = [
    path(
        "",
        SellerProductListCreateView.as_view(),
        name="seller-product-list-create",
    ),
    path(
        "<int:pk>/",
        SellerProductDetailView.as_view(),
        name="seller-product-detail",
    ),
    path(
        "<int:pk>/stock/",
        SellerProductStockUpdateView.as_view(),
        name="seller-product-stock-update",
    ),
]