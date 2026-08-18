from django.urls import path

from .views import (
    MyQuestionListView,
    ProductQuestionListCreateView,
    SellerQuestionAnswerView,
    SellerQuestionListView,
)


urlpatterns = [
    path(
        "products/<slug:slug>/questions/",
        ProductQuestionListCreateView.as_view(),
        name="product-question-list-create",
    ),
    path(
        "users/me/questions/",
        MyQuestionListView.as_view(),
        name="my-question-list",
    ),
    path(
        "seller/questions/",
        SellerQuestionListView.as_view(),
        name="seller-question-list",
    ),
    path(
        "seller/questions/<int:pk>/answer/",
        SellerQuestionAnswerView.as_view(),
        name="seller-question-answer",
    ),
]