from django.urls import path

from .views import FeaturedProductListView, ProductDetailView, ProductListView


urlpatterns = [
    path("", ProductListView.as_view(), name="product-list"),
    path("featured/", FeaturedProductListView.as_view(), name="product-featured-list"),
    path("<slug:slug>/", ProductDetailView.as_view(), name="product-detail"),
]