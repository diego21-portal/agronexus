from rest_framework.generics import ListAPIView, RetrieveAPIView

from .models import Region
from .serializers import RegionSerializer


class RegionListView(ListAPIView):
    serializer_class = RegionSerializer

    def get_queryset(self):
        return Region.objects.filter(is_active=True)


class RegionDetailView(RetrieveAPIView):
    serializer_class = RegionSerializer
    lookup_field = "slug"

    def get_queryset(self):
        return Region.objects.filter(is_active=True)