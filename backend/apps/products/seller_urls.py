from django.urls import path

from .views import (
    SellerProductDetailView,
    SellerProductListCreateView,
    SellerProductStockUpdateView,
)
from .media_views import (
    SellerProductImageDetailView, SellerProductImageListCreateView, SellerProductTechnicalSheetView,
)


urlpatterns = [
    path("<int:pk>/images/", SellerProductImageListCreateView.as_view(), name="seller-product-images"),
    path("<int:pk>/images/<int:image_id>/", SellerProductImageDetailView.as_view(), name="seller-product-image-detail"),
    path("<int:pk>/technical-sheet/", SellerProductTechnicalSheetView.as_view(), name="seller-product-technical-sheet"),
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
