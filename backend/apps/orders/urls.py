from django.urls import path

from .views import CheckoutQuoteView, CheckoutView, OrderDetailView, OrderListView, OrderTrackingView


urlpatterns = [
    path("checkout/quote/", CheckoutQuoteView.as_view(), name="checkout-quote"),
    path("checkout/", CheckoutView.as_view(), name="checkout"),
    path("orders/", OrderListView.as_view(), name="order-list"),
    path("orders/<int:pk>/", OrderDetailView.as_view(), name="order-detail"),
    path(
        "orders/<int:pk>/tracking/",
        OrderTrackingView.as_view(),
        name="order-tracking",
    ),
]