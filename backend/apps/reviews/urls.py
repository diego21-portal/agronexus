from django.urls import path

from .views import ProductReviewDetailView, ProductReviewListCreateView


urlpatterns = [
    path(
        "products/<slug:slug>/reviews/",
        ProductReviewListCreateView.as_view(),
        name="product-review-list-create",
    ),
    path(
        "reviews/<int:pk>/",
        ProductReviewDetailView.as_view(),
        name="product-review-detail",
    ),
]