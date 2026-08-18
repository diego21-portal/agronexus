from django.urls import path

from .views import SellerStockMovementListCreateView


urlpatterns = [
    path(
        "movements/",
        SellerStockMovementListCreateView.as_view(),
        name="seller-stock-movement-list-create",
    ),
]