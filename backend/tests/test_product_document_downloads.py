from contextlib import closing

import pytest
from django.http import Http404
from django.test import RequestFactory

from apps.products.downloads import serve_product_document


@pytest.mark.django_db
def test_public_technical_document_downloads_with_attachment_headers(tmp_path):
    content = b"%PDF-1.4\nexample public test document\n%%EOF\n"
    (tmp_path / "guide.pdf").write_bytes(content)
    request = RequestFactory().get("/media/products/documents/guide.pdf")
    # Closing a streaming response runs Django's request-finished receivers.
    with closing(serve_product_document(request, "guide.pdf", tmp_path)) as response:
        assert response.status_code == 200
        assert response["Content-Disposition"] == "attachment"
        assert response["X-Content-Type-Options"] == "nosniff"
        assert b"".join(response.streaming_content) == content


def test_technical_document_download_does_not_escape_its_directory(tmp_path):
    documents = tmp_path / "documents"
    documents.mkdir()
    (tmp_path / "private.txt").write_text("Not in the public documents directory")
    with pytest.raises(Http404):
        serve_product_document(RequestFactory().get("/"), "../private.txt", documents)
