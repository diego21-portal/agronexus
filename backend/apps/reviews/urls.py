from django.urls import path

from .views import MyProductReviewListView, ProductReviewDetailView, ProductReviewListCreateView


urlpatterns = [
    path("users/me/reviews/", MyProductReviewListView.as_view(), name="my-product-reviews"),
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
