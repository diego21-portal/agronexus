from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from config.views import health_check


urlpatterns = [
    path("health/", health_check, name="health-check"),
    path("admin/", admin.site.urls),

    path("api/v1/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/v1/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),

    path("api/v1/auth/login/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/v1/auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    path("api/v1/", include("apps.users.urls")),
    path("api/v1/", include("apps.carts.urls")),
    path("api/v1/", include("apps.orders.urls")),
    path("api/v1/", include("apps.reviews.urls")),
    path("api/v1/", include("apps.favorites.urls")),
    path("api/v1/", include("apps.questions.urls")),
    path("api/v1/", include("apps.dashboards.urls")),
    path("api/v1/", include("apps.complaints.urls")),
    path("api/v1/", include("apps.notifications.urls")),

    path("api/v1/regions/", include("apps.regions.urls")),
    path("api/v1/", include("apps.categories.urls")),
    path("api/v1/products/", include("apps.products.urls")),

    path("api/v1/seller/products/", include("apps.products.seller_urls")),
    path("api/v1/seller/stock/", include("apps.products.stock_urls")),
    path("api/v1/seller/", include("apps.orders.seller_urls")),
    path("api/v1/seller/", include("apps.sellers.urls")),
]


if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)