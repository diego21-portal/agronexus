from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from django.db import close_old_connections, connection
from rest_framework.test import APIClient

from apps.orders.models import Order
from apps.sellers.models import SellerProfile
from apps.users.models import User
from tests.checkout_helpers import CHECKOUT_URL, QUOTE_URL, prepare_checkout_payload


pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def fast_password_hashing(settings):
    settings.PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]


def promote(client, user, seller_data=None, **fields):
    payload = {"role": User.Role.SELLER, **fields}
    if seller_data is not None:
        payload["seller_profile"] = seller_data
    return client.patch(f"/api/v1/admin/users/{user.pk}/", payload, format="json")


def test_seller_promotion_requires_commercial_details_without_creating_an_orphan(admin_client, customer_user):
    response = promote(admin_client, customer_user, is_active=False)
    assert response.status_code == 400
    assert "business_name" in response.data["seller_profile"]
    customer_user.refresh_from_db()
    assert customer_user.role == User.Role.CUSTOMER
    assert customer_user.is_active is True
    assert not SellerProfile.objects.filter(user=customer_user).exists()


def test_onboarding_creates_a_real_seller_who_can_use_the_portal_and_publish(
    admin_client, customer_user, category, region, brand,
):
    before = admin_client.get(f"/api/v1/admin/users/{customer_user.pk}/")
    assert before.data["seller_profile"] is None
    response = promote(admin_client, customer_user, {
        "business_name": "  Insumos del Sur  ", "tax_id": " 20-12345678-0 ",
        "description": "  Venta de insumos agrícolas.  ",
    })
    assert response.status_code == 200
    profile = SellerProfile.objects.get(user=customer_user)
    assert response.data["seller_profile"] == {
        "id": profile.pk, "business_name": "Insumos del Sur", "tax_id": "20-12345678-0",
        "description": "Venta de insumos agrícolas.", "is_active": True, "is_verified": False,
    }
    assert response.data["role"] == User.Role.SELLER
    assert profile.total_sales == 0
    assert profile.rating_average == 0
    assert profile.is_verified is False
    customer_user.refresh_from_db()
    seller_client = APIClient()
    seller_client.force_authenticate(customer_user)
    assert seller_client.get("/api/v1/seller/dashboard/").status_code == 200
    assert seller_client.get("/api/v1/seller/products/").status_code == 200
    created = seller_client.post("/api/v1/seller/products/", {
        "category": category.pk, "region": region.pk, "brand": brand.pk,
        "name": "Filtro de proveedor nuevo", "sku": "ALTA-VENDEDOR-1",
        "short_description": "Filtro agrícola de prueba.", "description": "Filtro de repuesto para maquinaria.",
        "price": "120.50", "stock": 3, "status": "PUBLISHED", "condition": "NEW", "unit": "unidad",
    }, format="json")
    assert created.status_code == 201, created.data
    assert created.data["seller"] == profile.business_name
    assert "seller_profile" not in seller_client.get("/api/v1/users/me/").data


@pytest.mark.parametrize("profile_active", [False, True])
def test_admin_user_lists_report_the_commercial_profile(admin_client, customer_user, profile_active):
    profile = SellerProfile.objects.create(
        user=customer_user, business_name="Empresa anterior", is_active=profile_active, is_verified=True,
    )
    response = admin_client.get("/api/v1/admin/users/")
    row = next(user for user in response.data if user["id"] == customer_user.pk)
    assert row["seller_profile"]["id"] == profile.pk
    assert row["seller_profile"]["is_active"] is profile_active
    assert row["seller_profile"]["is_verified"] is True


def test_active_existing_profile_is_reused_without_losing_commercial_history(admin_client, customer_user):
    profile = SellerProfile.objects.create(
        user=customer_user, business_name="Agro existente", tax_id="20-12345678-0",
        description="Datos conservados.", is_verified=True, rating_average="4.75", total_sales=12,
    )
    response = promote(admin_client, customer_user)
    assert response.status_code == 200
    assert response.data["seller_profile"]["id"] == profile.pk
    profile.refresh_from_db()
    assert profile.business_name == "Agro existente"
    assert profile.is_verified is True
    assert str(profile.rating_average) == "4.75"
    assert profile.total_sales == 12
    assert SellerProfile.objects.filter(user=customer_user).count() == 1


def test_role_change_stops_new_sales_and_preserves_the_vendor_profile(
    api_client, admin_client, customer_client, seller_user, product, address,
):
    detail_url = f"/api/v1/products/{product.slug}/"
    item = {"product_id": product.pk, "quantity": 1}
    assert api_client.get(detail_url).status_code == 200
    assert customer_client.post("/api/v1/cart/items/", item, format="json").status_code == 201
    confirmation = prepare_checkout_payload(customer_client, address.pk)
    starting_stock = product.stock

    demoted = admin_client.patch(f"/api/v1/admin/users/{seller_user.pk}/", {
        "role": User.Role.CUSTOMER,
    }, format="json")
    assert demoted.status_code == 200
    assert demoted.data["seller_profile"]["id"] == product.seller_id
    assert api_client.get(detail_url).status_code == 404
    assert api_client.get("/api/v1/products/").data["count"] == 0
    assert customer_client.post("/api/v1/cart/items/", item, format="json").status_code == 400
    assert customer_client.post(QUOTE_URL, {
        "address_id": address.pk, "payment_method": "SIMULATED_CARD",
    }, format="json").status_code == 400
    rejected = customer_client.post(CHECKOUT_URL, confirmation, format="json")
    assert rejected.status_code == 409
    assert rejected.data["code"] == "quote_changed"
    assert rejected.data["quote"] is None
    assert not Order.objects.exists()
    product.refresh_from_db()
    assert product.stock == starting_stock

    restored = promote(admin_client, seller_user)
    assert restored.status_code == 200
    assert restored.data["seller_profile"]["id"] == product.seller_id
    assert api_client.get(detail_url).status_code == 200


@pytest.mark.parametrize("payload", [None, {"business_name": "Otra empresa"}])
def test_inactive_profile_requires_explicit_reactivation(admin_client, customer_user, payload):
    profile = SellerProfile.objects.create(user=customer_user, business_name="Empresa inactiva", is_active=False)
    response = promote(admin_client, customer_user, payload)
    assert response.status_code == 400
    assert "is_active" in response.data["seller_profile"]
    customer_user.refresh_from_db()
    profile.refresh_from_db()
    assert customer_user.role == User.Role.CUSTOMER
    assert profile.is_active is False
    assert profile.business_name == "Empresa inactiva"


def test_explicit_reactivation_reuses_the_profile_and_restores_seller_access(admin_client, customer_user):
    profile = SellerProfile.objects.create(
        user=customer_user, business_name="Empresa inactiva", tax_id="CUIT-anterior", is_active=False,
    )
    response = promote(admin_client, customer_user, {"is_active": True})
    assert response.status_code == 200
    profile.refresh_from_db()
    assert profile.is_active is True
    assert profile.business_name == "Empresa inactiva"
    assert profile.tax_id == "CUIT-anterior"
    assert response.data["seller_profile"]["id"] == profile.pk
    customer_user.refresh_from_db()
    client = APIClient()
    client.force_authenticate(customer_user)
    assert client.get("/api/v1/seller/products/").status_code == 200


def test_commercial_reactivation_does_not_implicitly_reactivate_the_user(admin_client, customer_user):
    customer_user.is_active = False
    customer_user.save(update_fields=["is_active"])
    profile = SellerProfile.objects.create(user=customer_user, business_name="Empresa", is_active=False)
    response = promote(admin_client, customer_user, {"is_active": True})
    assert response.status_code == 200
    customer_user.refresh_from_db()
    profile.refresh_from_db()
    assert profile.is_active is True
    assert customer_user.is_active is False


def test_repeated_onboarding_preserves_a_single_profile(admin_client, customer_user):
    details = {"business_name": "Agro repetido", "tax_id": "20-12345678-0"}
    first = promote(admin_client, customer_user, details)
    second = promote(admin_client, customer_user, details)
    assert first.status_code == second.status_code == 200
    assert first.data["seller_profile"]["id"] == second.data["seller_profile"]["id"]
    assert SellerProfile.objects.filter(user=customer_user).count() == 1


def test_onboarding_can_repair_an_existing_seller_without_a_profile(admin_client, seller_user):
    response = promote(admin_client, seller_user, {"business_name": "Vendedor reparado"})
    assert response.status_code == 200
    assert SellerProfile.objects.get(user=seller_user).business_name == "Vendedor reparado"


def test_legacy_blank_commercial_name_must_be_completed(admin_client, customer_user):
    profile = SellerProfile.objects.create(user=customer_user, business_name=" ")
    assert promote(admin_client, customer_user).status_code == 400
    response = promote(admin_client, customer_user, {"business_name": "Empresa completa"})
    assert response.status_code == 200
    assert response.data["seller_profile"]["id"] == profile.pk


@pytest.mark.parametrize("seller_data", [
    {"business_name": ""}, {"business_name": " "}, {"business_name": "A"},
    {"business_name": "A" * 161}, {"business_name": "Empresa", "tax_id": "1" * 31},
    {"business_name": "Empresa", "description": "x" * 5001},
    {"business_name": "Empresa", "is_active": False},
    {"business_name": "Empresa", "is_verified": True},
    {"business_name": "Empresa", "total_sales": 200},
    {"business_name": "Empresa", "rating_average": "5.00"},
    {"business_name": "Empresa", "user": 999},
    {"business_name": "Empresa", "id": 999},
    {"business_name": "Empresa", "logo": "https://example.test/logo.png"},
    [], "invalid", {},
])
def test_invalid_commercial_data_is_rejected_without_changing_user_or_creating_profile(
    admin_client, customer_user, seller_data,
):
    response = promote(admin_client, customer_user, seller_data, is_active=False)
    assert response.status_code == 400
    customer_user.refresh_from_db()
    assert customer_user.role == User.Role.CUSTOMER
    assert customer_user.is_active is True
    assert not SellerProfile.objects.filter(user=customer_user).exists()


@pytest.mark.parametrize("role", [None, User.Role.CUSTOMER, User.Role.ADMIN])
def test_commercial_data_cannot_be_used_outside_the_seller_promotion(admin_client, customer_user, role):
    payload = {"seller_profile": {"business_name": "Empresa"}}
    if role is not None:
        payload["role"] = role
    response = admin_client.patch(f"/api/v1/admin/users/{customer_user.pk}/", payload, format="json")
    assert response.status_code == 400
    customer_user.refresh_from_db()
    assert customer_user.role == User.Role.CUSTOMER
    assert not SellerProfile.objects.filter(user=customer_user).exists()


def test_non_admin_and_anonymous_cannot_create_a_seller_profile(customer_client, api_client, customer_user):
    assert promote(customer_client, customer_user, {"business_name": "Empresa"}).status_code == 403
    assert promote(api_client, customer_user, {"business_name": "Empresa"}).status_code == 401
    assert not SellerProfile.objects.filter(user=customer_user).exists()


def test_stale_admin_role_is_rechecked_before_commercial_creation(admin_client, admin_user, customer_user):
    # The fixture has a legacy effective superuser; remove both privileges only in DB.
    User.objects.filter(pk=admin_user.pk).update(role=User.Role.CUSTOMER, is_superuser=False)
    response = promote(admin_client, customer_user, {"business_name": "Empresa"})
    assert response.status_code == 403
    assert not SellerProfile.objects.filter(user=customer_user).exists()


def test_last_admin_cannot_escape_its_protection_by_creating_a_seller_profile():
    actor = User.objects.create_user(email="last@example.test", username="last", role=User.Role.ADMIN)
    client = APIClient()
    client.force_authenticate(actor)
    response = promote(client, actor, {"business_name": "Empresa"})
    assert response.status_code == 400
    actor.refresh_from_db()
    assert actor.role == User.Role.ADMIN
    assert not SellerProfile.objects.filter(user=actor).exists()


@pytest.mark.django_db(transaction=True)
def test_simultaneous_onboarding_creates_one_commercial_profile(customer_user, admin_user):
    if connection.vendor != "postgresql":
        pytest.skip("Row-lock concurrency requires PostgreSQL.")
    barrier = Barrier(2)

    def onboard(_):
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(admin_user)
            barrier.wait(timeout=10)
            response = promote(client, customer_user, {"business_name": "Empresa concurrente"})
            return response.status_code
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = list(pool.map(onboard, range(2)))
    assert statuses == [200, 200]
    customer_user.refresh_from_db()
    assert customer_user.role == User.Role.SELLER
    assert SellerProfile.objects.filter(user=customer_user).count() == 1
