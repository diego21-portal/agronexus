from django.urls import path

from .views import (
    AddressDetailView,
    AddressListCreateView,
    UserMeView,
    UserPreferencesUpdateView,
    UserProfileUpdateView,
    UserRegisterView,
)


urlpatterns = [
    path("auth/register/", UserRegisterView.as_view(), name="auth-register"),
    path("users/me/", UserMeView.as_view(), name="user-me"),
    path("users/me/profile/", UserProfileUpdateView.as_view(), name="user-profile"),
    path(
        "users/me/preferences/",
        UserPreferencesUpdateView.as_view(),
        name="user-preferences",
    ),
    path("users/me/addresses/", AddressListCreateView.as_view(), name="address-list"),
    path(
        "users/me/addresses/<int:pk>/",
        AddressDetailView.as_view(),
        name="address-detail",
    ),
]