"""Development equivalent of Nginx's public technical-document download."""
from django.core.exceptions import SuspiciousFileOperation
from django.http import Http404
from django.views.static import serve


def serve_product_document(request, path, document_root=None):
    try:
        response = serve(request, path, document_root=document_root)
    except SuspiciousFileOperation as exc:
        raise Http404 from exc
    response["Content-Disposition"] = "attachment"
    response["X-Content-Type-Options"] = "nosniff"
    return response
