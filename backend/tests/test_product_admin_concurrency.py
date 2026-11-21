"""An older administrative form must not undo committed stock or media writes."""
import pytest
from django.contrib.admin.sites import AdminSite
from django.forms.models import model_to_dict
from django.test import RequestFactory

from apps.products.admin import ProductAdmin
from apps.products.models import Product, ProductImage, StockMovement
from apps.products.services import change_stock
from tests.test_product_media import pdf_upload


pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def isolated_media(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path / "uploads"
    settings.PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]


def edit_form(product, admin_user, *, name=None, file=None):
    request = RequestFactory().post(f"/admin/products/product/{product.pk}/change/")
    request.user = admin_user
    editor = ProductAdmin(Product, AdminSite())
    stale = Product.objects.get(pk=product.pk)
    data = model_to_dict(stale)
    if name is not None:
        data["name"] = name
    files = {"technical_sheet": file} if file is not None else None
    form = editor.get_form(request, obj=stale)(data=data, files=files, instance=stale)
    assert form.is_valid(), form.errors
    return editor, request, form, form.save(commit=False)


@pytest.mark.parametrize("change_name", [False, True])
def test_stale_admin_form_preserves_new_stock_review_values_and_pdf(
    product, seller_user, admin_user, django_capture_on_commit_callbacks, change_name,
):
    product.technical_sheet = pdf_upload(label="Original")
    product.save(update_fields=["technical_sheet"])
    old_name = product.technical_sheet.name
    main_image = ProductImage.objects.create(product=product, image="legacy/main.png")
    desired_name = "Nombre editado desde administración" if change_name else None
    editor, request, form, stale = edit_form(product, admin_user, name=desired_name)
    assert form.changed_data == (["name"] if change_name else [])

    change_stock(
        product_id=product.pk, delta=-2, user=seller_user,
        movement_type=StockMovement.MovementType.MANUAL_ADJUSTMENT,
        reason="Operación confirmada después de cargar el formulario.",
    )
    Product.objects.filter(pk=product.pk).update(
        status=Product.Status.PAUSED, average_rating="4.50", total_reviews=11,
    )
    product.refresh_from_db()
    product.technical_sheet = pdf_upload(label="Archivo nuevo confirmado")
    with django_capture_on_commit_callbacks(execute=True):
        product.save(update_fields=["technical_sheet"])
    confirmed_name = product.technical_sheet.name
    assert not product.technical_sheet.storage.exists(old_name)
    movements = StockMovement.objects.filter(product=product).count()

    with django_capture_on_commit_callbacks(execute=True):
        editor.save_model(request, stale, form, change=True)

    product.refresh_from_db()
    assert product.name == (desired_name or "Filtro hidráulico John Deere X100")
    assert product.stock == stale.stock == 8
    assert product.status == stale.status == Product.Status.PAUSED
    assert product.average_rating == stale.average_rating == pytest.approx(4.5)
    assert product.total_reviews == stale.total_reviews == 11
    assert product.technical_sheet.name == stale.technical_sheet.name == confirmed_name
    assert product.technical_sheet.storage.exists(confirmed_name)
    assert StockMovement.objects.filter(product=product).count() == movements
    assert product.images.get(is_main=True).pk == main_image.pk


def test_explicit_admin_pdf_replacement_removes_the_current_file_after_commit(
    product, admin_user, django_capture_on_commit_callbacks,
):
    product.technical_sheet = pdf_upload(label="Original")
    product.save(update_fields=["technical_sheet"])
    editor, request, form, stale = edit_form(product, admin_user, file=pdf_upload(label="Edición administrativa"))
    assert form.changed_data == ["technical_sheet"]

    product.technical_sheet = pdf_upload(label="Confirmación concurrente")
    with django_capture_on_commit_callbacks(execute=True):
        product.save(update_fields=["technical_sheet"])
    previous_name = product.technical_sheet.name

    with django_capture_on_commit_callbacks(execute=True):
        editor.save_model(request, stale, form, change=True)
        assert product.technical_sheet.storage.exists(previous_name)

    product.refresh_from_db()
    assert product.technical_sheet.name == stale.technical_sheet.name
    assert product.technical_sheet.name != previous_name
    assert product.technical_sheet.storage.exists(product.technical_sheet.name)
    assert not product.technical_sheet.storage.exists(previous_name)
