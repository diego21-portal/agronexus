"""Seller file operations preserve ownership, metadata, stock and committed files."""
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path
from threading import Barrier

import pytest
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError, close_old_connections, connection
from PIL import Image
from rest_framework.test import APIClient

from apps.products.media_validation import IMAGE_MAX_BYTES, PDF_MAX_BYTES
from apps.products.models import Product, ProductImage
from apps.sellers.models import SellerProfile
from apps.users.models import User

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def isolated_media(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path / "uploads"
    settings.PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
    return Path(settings.MEDIA_ROOT)


def image_upload(name="imagen.png", *, image_format="PNG", size=(4, 3), color="green"):
    data = BytesIO()
    Image.new("RGB", size, color).save(data, format=image_format)
    return SimpleUploadedFile(name, data.getvalue(), content_type=f"image/{image_format.lower()}")


def pdf_bytes(label="Ficha agrícola"):
    # A small valid PDF with an empty page tree. Includes a real cross-reference.
    data = bytearray(b"%PDF-1.4\n%" + label.encode("utf-8") + b"\n")
    offsets = [0]
    for number, body in enumerate((b"<< /Type /Catalog /Pages 2 0 R >>", b"<< /Type /Pages /Count 0 /Kids [] >>"), 1):
        offsets.append(len(data))
        data.extend(f"{number} 0 obj\n".encode() + body + b"\nendobj\n")
    position = len(data)
    data.extend(b"xref\n0 3\n0000000000 65535 f \n")
    for offset in offsets[1:]:
        data.extend(f"{offset:010} 00000 n \n".encode())
    data.extend(f"trailer\n<< /Size 3 /Root 1 0 R >>\nstartxref\n{position}\n%%EOF\n".encode())
    return bytes(data)


def pdf_upload(name="ficha.pdf", label="Ficha agrícola"):
    return SimpleUploadedFile(name, pdf_bytes(label), content_type="application/pdf")


def image_url(product, image=None):
    url = f"/api/v1/seller/products/{product.pk}/images/"
    return f"{url}{image.pk}/" if image else url


def pdf_url(product):
    return f"/api/v1/seller/products/{product.pk}/technical-sheet/"


def files_under(root):
    return {path.relative_to(root).as_posix() for path in root.rglob("*") if path.is_file()}


@pytest.fixture
def other_product(product):
    user = User.objects.create_user(username="other-media-seller", email="other-media@example.test", role=User.Role.SELLER)
    seller = SellerProfile.objects.create(user=user, business_name="Otro proveedor", is_active=True)
    return Product.objects.create(
        seller=seller, category=product.category, region=product.region,
        name="Producto ajeno", sku="OTHER-MEDIA", price="50.00", stock=4,
        status=Product.Status.PUBLISHED,
    )


def test_upload_image_returns_public_url_and_canonical_filename_without_changing_stock(seller_client, product, isolated_media):
    response = seller_client.post(image_url(product), {"image": image_upload("nombre-del-cliente.png", image_format="JPEG"), "alt_text": "Filtro instalado"}, format="multipart")
    assert response.status_code == 201, response.data
    image = ProductImage.objects.get(pk=response.data["id"])
    assert image.is_main is True
    assert image.alt_text == "Filtro instalado"
    assert len(Path(image.image.name).stem) == 32
    assert image.image.name.startswith("products/images/") and image.image.name.endswith(".jpg")
    assert response.data["image"] == f"http://testserver/media/{image.image.name}"
    assert files_under(isolated_media) == {image.image.name}
    product.refresh_from_db()
    assert product.stock == 10
    assert product.stock_movements.count() == 0


@pytest.mark.parametrize("field", ["images", "technical_sheet"])
def test_general_product_edit_cannot_bypass_file_endpoints(seller_client, product, field, isolated_media):
    response = seller_client.patch(f"/api/v1/seller/products/{product.pk}/", {field: "injected-file.pdf"}, format="json")
    assert response.status_code == 400
    assert field in response.data
    assert files_under(isolated_media) == set()


def test_first_and_last_image_remain_main_when_unset(seller_client, product):
    created = seller_client.post(image_url(product), {"image": image_upload()}, format="multipart")
    image = ProductImage.objects.get(pk=created.data["id"])
    changed = seller_client.patch(image_url(product, image), {"is_main": False}, format="json")
    assert changed.status_code == 200
    assert changed.data["is_main"] is True
    assert product.images.filter(is_main=True).count() == 1


def test_switch_demote_reorder_and_delete_main_image(seller_client, product, django_capture_on_commit_callbacks):
    images = []
    for index in range(3):
        response = seller_client.post(image_url(product), {"image": image_upload(color=(index, 20, 40)), "order": index}, format="multipart")
        assert response.status_code == 201
        images.append(ProductImage.objects.get(pk=response.data["id"]))
    changed = seller_client.patch(image_url(product, images[1]), {"is_main": True, "alt_text": "Principal"}, format="json")
    assert changed.status_code == 200
    assert list(product.images.filter(is_main=True).values_list("pk", flat=True)) == [images[1].pk]
    # Regression: demoting the main row must happen before promoting a sibling.
    demoted = seller_client.patch(image_url(product, images[1]), {"is_main": False}, format="json")
    assert demoted.status_code == 200
    assert list(product.images.filter(is_main=True).values_list("pk", flat=True)) == [images[0].pk]
    reordered = seller_client.patch(image_url(product, images[2]), {"order": 0, "alt_text": "Última en primer lugar"}, format="json")
    assert reordered.status_code == 200
    listed = seller_client.get(image_url(product))
    assert [row["id"] for row in listed.data] == [images[0].pk, images[2].pk, images[1].pk]
    name = images[0].image.name
    with django_capture_on_commit_callbacks(execute=True):
        deleted = seller_client.delete(image_url(product, images[0]))
        assert deleted.status_code == 204
        assert images[0].image.storage.exists(name), "Deletion waits for commit"
    assert not images[0].image.storage.exists(name)
    assert list(product.images.filter(is_main=True).values_list("pk", flat=True)) == [images[2].pk]


@pytest.mark.parametrize("payload", [
    {"product": 999}, {"image": "other.png"}, {"order": -1}, {"order": 2147483648}, {},
])
def test_image_metadata_rejects_unapproved_or_invalid_fields(seller_client, product, payload):
    image = ProductImage.objects.create(product=product, image="legacy/metadata.png")
    response = seller_client.patch(image_url(product, image), payload, format="json")
    assert response.status_code == 400
    image.refresh_from_db()
    assert image.order == 0 and image.is_main is True


@pytest.mark.parametrize("payload", [None, 1, [], [{}], "not an object"])
def test_image_metadata_rejects_nonobject_json_without_a_server_error(seller_client, product, payload):
    image = ProductImage.objects.create(product=product, image="legacy/nonobject.png")
    response = seller_client.patch(image_url(product, image), payload, format="json")
    assert response.status_code == 400
    image.refresh_from_db()
    assert image.alt_text == "" and image.order == 0 and image.is_main is True


def test_upload_limit_does_not_write_an_extra_file(seller_client, product, isolated_media):
    for index in range(12):
        ProductImage.objects.create(product=product, image=f"legacy/{index}.png")
    response = seller_client.post(image_url(product), {"image": image_upload()}, format="multipart")
    assert response.status_code == 400
    assert product.images.count() == 12
    assert files_under(isolated_media) == set()


@pytest.mark.parametrize("kind", ["text", "svg", "gif", "oversize", "large_dimensions", "animation"])
def test_invalid_images_are_rejected_before_storage(seller_client, product, isolated_media, kind):
    if kind == "text":
        upload = SimpleUploadedFile("fake.png", b"not an image", content_type="image/png")
    elif kind == "svg":
        upload = SimpleUploadedFile("unsafe.svg", b'<svg xmlns="http://www.w3.org/2000/svg"/>', content_type="image/svg+xml")
    elif kind == "gif":
        upload = image_upload("photo.gif", image_format="GIF")
    elif kind == "oversize":
        valid = image_upload()
        upload = SimpleUploadedFile("large.png", valid.read() + b" " * IMAGE_MAX_BYTES, content_type="image/png")
    elif kind == "large_dimensions":
        upload = image_upload(size=(8001, 1))
    else:
        stream = BytesIO()
        Image.new("RGB", (2, 2), "green").save(stream, format="PNG", save_all=True, append_images=[Image.new("RGB", (2, 2), "red")], duration=100)
        upload = SimpleUploadedFile("animated.png", stream.getvalue(), content_type="image/png")
    response = seller_client.post(image_url(product), {"image": upload}, format="multipart")
    assert response.status_code == 400, response.data
    assert not product.images.exists()
    assert files_under(isolated_media) == set()


@pytest.mark.parametrize("kind", ["text", "missing_trailer", "wrong_extension", "oversize"])
def test_invalid_pdf_rejected_before_storage(seller_client, product, isolated_media, kind):
    if kind == "text":
        upload = SimpleUploadedFile("fake.pdf", b"<html>not a PDF</html>", content_type="application/pdf")
    elif kind == "missing_trailer":
        upload = SimpleUploadedFile("fake.pdf", b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\n", content_type="application/pdf")
    elif kind == "wrong_extension":
        upload = pdf_upload("ficha.txt")
    else:
        upload = SimpleUploadedFile("large.pdf", pdf_bytes() + b" " * PDF_MAX_BYTES, content_type="application/pdf")
    response = seller_client.post(pdf_url(product), {"file": upload}, format="multipart")
    assert response.status_code == 400
    product.refresh_from_db()
    assert not product.technical_sheet
    assert files_under(isolated_media) == set()


def test_pdf_upload_replace_delete_and_null_public_dto(seller_client, api_client, product, django_capture_on_commit_callbacks):
    before = api_client.get(f"/api/v1/products/{product.slug}/")
    assert before.status_code == 200 and before.data["technical_sheet"] is None
    response = seller_client.post(pdf_url(product), {"file": pdf_upload()}, format="multipart")
    assert response.status_code == 200, response.data
    product.refresh_from_db()
    original = product.technical_sheet.name
    assert response.data["technical_sheet"] == f"http://testserver/media/{original}"
    assert response.data["category"] == product.category_id
    assert response.data["images"] == []
    with django_capture_on_commit_callbacks(execute=True):
        replaced = seller_client.post(pdf_url(product), {"file": pdf_upload(label="Segunda ficha")}, format="multipart")
        assert replaced.status_code == 200
        assert product.technical_sheet.storage.exists(original)
    product.refresh_from_db()
    replacement = product.technical_sheet.name
    assert replacement != original and len(Path(replacement).stem) == 32
    assert not product.technical_sheet.storage.exists(original)
    assert product.technical_sheet.storage.exists(replacement)
    public = api_client.get(f"/api/v1/products/{product.slug}/")
    assert public.data["technical_sheet"].endswith(replacement)
    with django_capture_on_commit_callbacks(execute=True):
        deleted = seller_client.delete(pdf_url(product))
        assert deleted.status_code == 204
        assert product.technical_sheet.storage.exists(replacement)
    product.refresh_from_db()
    assert not product.technical_sheet.storage.exists(replacement)
    assert not product.technical_sheet


def test_refresh_then_replace_deletes_the_actual_previous_pdf(product, django_capture_on_commit_callbacks):
    product.technical_sheet = pdf_upload(label="Primera")
    product.save(update_fields=["technical_sheet"])
    loaded = Product.objects.get(pk=product.pk)
    product.technical_sheet = pdf_upload(label="Segunda")
    with django_capture_on_commit_callbacks(execute=True):
        product.save(update_fields=["technical_sheet"])
    loaded.refresh_from_db()
    second_name = loaded.technical_sheet.name
    loaded.technical_sheet = pdf_upload(label="Tercera")
    with django_capture_on_commit_callbacks(execute=True):
        loaded.save(update_fields=["technical_sheet"])
    assert not loaded.technical_sheet.storage.exists(second_name)
    assert loaded.technical_sheet.storage.exists(loaded.technical_sheet.name)


def test_deferred_product_metadata_update_preserves_the_pdf(product):
    product.technical_sheet = pdf_upload()
    product.save(update_fields=["technical_sheet"])
    previous_name = product.technical_sheet.name
    deferred = Product.objects.only("name", "stock", "status", "slug").get(pk=product.pk)
    deferred.name = "Nuevo nombre con ficha intacta"
    deferred.save()
    product.refresh_from_db()
    assert product.technical_sheet.name == previous_name
    assert product.technical_sheet.storage.exists(previous_name)


def test_shared_legacy_file_is_kept_while_another_row_references_it(product, other_product, django_capture_on_commit_callbacks):
    product.technical_sheet = pdf_upload()
    product.save(update_fields=["technical_sheet"])
    original = product.technical_sheet.name
    Product.objects.filter(pk=other_product.pk).update(technical_sheet=original)
    with django_capture_on_commit_callbacks(execute=True):
        product.technical_sheet = pdf_upload(label="Solo para primer producto")
        product.save(update_fields=["technical_sheet"])
    assert product.technical_sheet.storage.exists(original)


def test_upload_image_database_failure_cleans_new_file_and_preserves_old_main(seller_client, product, isolated_media, monkeypatch):
    old = ProductImage.objects.create(product=product, image=image_upload())
    original_files = files_under(isolated_media)
    original_save_base = ProductImage.save_base

    def fail_after_write(instance, *args, **kwargs):
        original_save_base(instance, *args, **kwargs)
        raise IntegrityError("Simulated database failure after file persistence")

    monkeypatch.setattr(ProductImage, "save_base", fail_after_write)
    with pytest.raises(IntegrityError):
        seller_client.post(image_url(product), {"image": image_upload(color="red"), "is_main": True}, format="multipart")
    assert product.images.count() == 1
    old.refresh_from_db()
    assert old.is_main is True
    assert files_under(isolated_media) == original_files


def test_upload_pdf_database_failure_preserves_old_file(seller_client, product, isolated_media, monkeypatch):
    product.technical_sheet = pdf_upload()
    product.save(update_fields=["technical_sheet"])
    original_files = files_under(isolated_media)
    original_name = product.technical_sheet.name
    original_save_base = Product.save_base

    def fail_after_write(instance, *args, **kwargs):
        original_save_base(instance, *args, **kwargs)
        raise IntegrityError("Simulated database failure after file persistence")

    monkeypatch.setattr(Product, "save_base", fail_after_write)
    with pytest.raises(IntegrityError):
        seller_client.post(pdf_url(product), {"file": pdf_upload(label="Fallará")}, format="multipart")
    product.refresh_from_db()
    assert product.technical_sheet.name == original_name
    assert files_under(isolated_media) == original_files


def test_failed_delete_keeps_old_pdf_until_transaction_commits(product, django_capture_on_commit_callbacks):
    from django.db import transaction
    product.technical_sheet = pdf_upload()
    product.save(update_fields=["technical_sheet"])
    original_name = product.technical_sheet.name
    with django_capture_on_commit_callbacks(execute=True):
        with pytest.raises(RuntimeError):
            with transaction.atomic():
                product.technical_sheet = ""
                product.save(update_fields=["technical_sheet"])
                raise RuntimeError("Rollback the deletion")
    product.refresh_from_db()
    assert product.technical_sheet.name == original_name
    assert product.technical_sheet.storage.exists(original_name)


def test_media_endpoints_reject_wrong_roles_and_other_owners(api_client, customer_client, seller_client, product, other_product):
    own_image = ProductImage.objects.create(product=product, image="legacy/own.png")
    other_image = ProductImage.objects.create(product=other_product, image="legacy/other.png")
    assert api_client.get(image_url(product)).status_code == 401
    assert customer_client.post(pdf_url(product), {"file": pdf_upload()}, format="multipart").status_code == 403
    assert seller_client.get(image_url(other_product)).status_code == 404
    assert seller_client.post(image_url(other_product), {"image": image_upload()}, format="multipart").status_code == 404
    assert seller_client.patch(image_url(product, other_image), {"is_main": True}, format="json").status_code == 404
    assert seller_client.delete(image_url(other_product, own_image)).status_code == 404
    assert seller_client.post(pdf_url(other_product), {"file": pdf_upload()}, format="multipart").status_code == 404
    assert seller_client.delete(pdf_url(other_product)).status_code == 404
    assert ProductImage.objects.filter(pk=own_image.pk).exists()


@pytest.mark.parametrize("actor_change", ["role", "account", "seller", "deleted_account"])
def test_upload_rechecks_actor_after_file_validation(seller_client, product, seller_user, monkeypatch, actor_change):
    from apps.products.media_views import ProductImageUploadSerializer
    original = ProductImageUploadSerializer.is_valid

    def deactivate_after_validation(instance, *args, **kwargs):
        result = original(instance, *args, **kwargs)
        if actor_change == "role":
            User.objects.filter(pk=seller_user.pk).update(role=User.Role.CUSTOMER)
        elif actor_change == "account":
            User.objects.filter(pk=seller_user.pk).update(is_active=False)
        elif actor_change == "deleted_account":
            User.objects.filter(pk=seller_user.pk).delete()
        else:
            SellerProfile.objects.filter(pk=product.seller_id).update(is_active=False)
        return result

    monkeypatch.setattr(ProductImageUploadSerializer, "is_valid", deactivate_after_validation)
    response = seller_client.post(image_url(product), {"image": image_upload()}, format="multipart")
    assert response.status_code == 403
    assert not product.images.exists()


def test_bulk_image_delete_keeps_one_main_and_waits_for_commit(product, django_capture_on_commit_callbacks):
    images = [ProductImage.objects.create(product=product, image=image_upload(color=(index, 3, 5)), order=index) for index in range(3)]
    deleted_names = [row.image.name for row in images[:2]]
    storage = images[0].image.storage
    with django_capture_on_commit_callbacks(execute=True):
        ProductImage.objects.filter(pk__in=[row.pk for row in images[:2]]).delete()
        assert all(storage.exists(name) for name in deleted_names)
    assert not any(storage.exists(name) for name in deleted_names)
    assert product.images.get(is_main=True).pk == images[2].pk
    remaining_name = images[2].image.name
    with django_capture_on_commit_callbacks(execute=True):
        product.images.all().delete()
    assert not product.images.exists()
    assert not storage.exists(remaining_name)


def test_image_cannot_move_to_another_product(product, other_product):
    image = ProductImage.objects.create(product=product, image="legacy/move.png")
    image.product = other_product
    with pytest.raises(ValidationError, match="trasladar"):
        image.save()
    image.refresh_from_db()
    assert image.product_id == product.pk


def test_database_constraint_prevents_two_main_images(product):
    from django.db import transaction
    first = ProductImage.objects.create(product=product, image="legacy/1.png")
    second = ProductImage.objects.create(product=product, image="legacy/2.png")
    with pytest.raises(IntegrityError), transaction.atomic():
        ProductImage.objects.filter(pk=second.pk).update(is_main=True)
    assert product.images.get(is_main=True).pk == first.pk


def test_django_admin_can_switch_main_images_using_its_form(product):
    from apps.products.admin import ProductImageAdminForm
    first = ProductImage.objects.create(product=product, image=image_upload())
    second = ProductImage.objects.create(product=product, image=image_upload(color="red"))
    form = ProductImageAdminForm(
        data={"product": product.pk, "is_main": True, "order": 0, "alt_text": "Nueva principal"},
        instance=second,
    )
    assert form.is_valid(), form.errors
    form.save()
    first.refresh_from_db()
    assert first.is_main is False
    assert product.images.get(is_main=True).pk == second.pk


def test_django_admin_can_edit_metadata_of_a_missing_legacy_image(product):
    from apps.products.admin import ProductImageAdminForm
    image = ProductImage.objects.create(product=product, image="legacy/not-on-disk.png")
    form = ProductImageAdminForm(
        data={"product": product.pk, "is_main": True, "order": 1, "alt_text": "Imagen histórica"},
        instance=image,
    )
    assert form.is_valid(), form.errors
    form.save()
    image.refresh_from_db()
    assert image.alt_text == "Imagen histórica"


@pytest.mark.django_db(transaction=True)
def test_concurrent_image_uploads_serialize_main_selection_and_capacity(product, seller_user, isolated_media):
    if connection.vendor != "postgresql":
        pytest.skip("Main-image row locks require PostgreSQL.")
    for index in range(11):
        ProductImage.objects.create(product=product, image=f"legacy/concurrent-{index}.png")
    barrier = Barrier(2)

    def upload(index):
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(seller_user)
            barrier.wait(timeout=10)
            return client.post(image_url(product), {"image": image_upload(color=(index, 1, 2)), "is_main": True}, format="multipart").status_code
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(upload, range(2)))
    assert sorted(outcomes) == [201, 400]
    assert product.images.count() == 12
    assert product.images.filter(is_main=True).count() == 1
    assert len(files_under(isolated_media)) == 1


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("kind", ["image", "pdf"])
def test_commit_failure_cleans_new_files_even_with_atomic_requests(
    seller_client, product, isolated_media, monkeypatch, kind,
):
    """The request must own the commit boundary that pairs DB and storage cleanup."""
    def reject_commit():
        raise IntegrityError("Simulated commit failure")

    with monkeypatch.context() as patch:
        patch.setitem(connection.settings_dict, "ATOMIC_REQUESTS", True)
        patch.setattr(connection, "commit", reject_commit)
        with pytest.raises(IntegrityError):
            if kind == "image":
                seller_client.post(image_url(product), {"image": image_upload()}, format="multipart")
            else:
                seller_client.post(pdf_url(product), {"file": pdf_upload()}, format="multipart")
    product.refresh_from_db()
    assert not product.images.exists()
    assert not product.technical_sheet
    assert files_under(isolated_media) == set()
