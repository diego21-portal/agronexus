from django.urls import path

from .views import RegionDetailView, RegionListView


urlpatterns = [
    path("", RegionListView.as_view(), name="region-list"),
    path("<slug:slug>/", RegionDetailView.as_view(), name="region-detail"),
]