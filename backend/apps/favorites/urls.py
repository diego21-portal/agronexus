from django.urls import path

from .views import (
    FavoriteProductCreateView,
    FavoriteProductDeleteView,
    FavoriteProductListView,
    ProductFavoriteStatusView,
    ProductFavoriteToggleView,
)


urlpatterns = [
    path("favorites/", FavoriteProductListView.as_view(), name="favorite-list"),
    path("favorites/add/", FavoriteProductCreateView.as_view(), name="favorite-add"),
    path(
        "favorites/<int:pk>/",
        FavoriteProductDeleteView.as_view(),
        name="favorite-delete",
    ),
    path(
        "products/<slug:slug>/favorite/status/",
        ProductFavoriteStatusView.as_view(),
        name="product-favorite-status",
    ),
    path(
        "products/<slug:slug>/favorite/",
        ProductFavoriteToggleView.as_view(),
        name="product-favorite-toggle",
    ),
]