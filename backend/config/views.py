from django.db import DatabaseError, connection
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_safe


SERVICE_NAME = "agronexus-api"


def health_check(request):
    return JsonResponse(
        {
            "status": "ok",
            "service": SERVICE_NAME,
        }
    )


@require_safe
@never_cache
def readiness_check(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except DatabaseError:
        return JsonResponse({"status": "unavailable", "service": SERVICE_NAME}, status=503)

    return JsonResponse({"status": "ok", "service": SERVICE_NAME})
