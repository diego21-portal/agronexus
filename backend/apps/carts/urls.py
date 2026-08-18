from django.urls import path

from .views import (
    CartClearView,
    CartDetailView,
    CartItemCreateView,
    CartItemDeleteView,
    CartItemUpdateView,
)


urlpatterns = [
    path("cart/", CartDetailView.as_view(), name="cart-detail"),
    path("cart/items/", CartItemCreateView.as_view(), name="cart-item-create"),
    path(
        "cart/items/<int:pk>/",
        CartItemUpdateView.as_view(),
        name="cart-item-update",
    ),
    path(
        "cart/items/<int:pk>/delete/",
        CartItemDeleteView.as_view(),
        name="cart-item-delete",
    ),
    path("cart/clear/", CartClearView.as_view(), name="cart-clear"),
]