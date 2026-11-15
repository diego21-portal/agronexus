from decimal import Decimal
from importlib import import_module
from types import SimpleNamespace

import pytest
from django.apps import apps
from django.db import connection
from rest_framework.test import APIClient

from apps.complaints.models import Complaint, ReturnRequest
from apps.orders.models import Order, OrderItem
from apps.products.models import Product
from apps.sellers.models import SellerProfile
from apps.shipments.models import Shipment
from apps.users.models import User


pytestmark = pytest.mark.django_db

INTERNAL_NOTE = "Nota interna de administración para la prueba."
PUBLIC_RESOLUTION = "Se ofreció un reemplazo al cliente."


@pytest.fixture
def purchased_item(customer_user, product, address):
    amount = Decimal(str(product.current_price))
    order = Order.objects.create(
        user=customer_user,
        shipping_address=address,
        status=Order.Status.DELIVERED,
        subtotal=amount,
        total=amount,
    )
    Shipment.objects.create(
        order=order,
        seller=product.seller,
        status=Shipment.Status.DELIVERED,
    )
    return OrderItem.objects.create(
        order=order,
        product=product,
        seller=product.seller,
        product_name=product.name,
        sku=product.sku,
        quantity=1,
        unit_price=amount,
        total_price=amount,
    )


@pytest.fixture
def issue_records(purchased_item, customer_user, admin_user):
    common = {
        "user": customer_user,
        "admin_note": INTERNAL_NOTE,
        "resolution": PUBLIC_RESOLUTION,
        "resolved_by": admin_user,
    }
    complaint = Complaint.objects.create(
        order=purchased_item.order,
        order_item=purchased_item,
        complaint_type=Complaint.ComplaintType.PRODUCT_PROBLEM,
        title="Reclamo sobre el producto",
        description="El producto presenta una falla de funcionamiento.",
        status=Complaint.Status.RESOLVED,
        **common,
    )
    return_request = ReturnRequest.objects.create(
        order_item=purchased_item,
        reason=ReturnRequest.Reason.DEFECTIVE_PRODUCT,
        description="Se solicita la devolución del producto recibido.",
        quantity=1,
        requested_refund_amount=purchased_item.unit_price,
        **common,
    )
    return {"complaints": complaint, "returns": return_request}


@pytest.mark.parametrize("kind", ["complaints", "returns"])
@pytest.mark.parametrize("reader", ["customer_client", "seller_client"])
def test_private_issue_fields_are_absent_from_customer_and_seller_responses(
    request, issue_records, kind, reader,
):
    client = request.getfixturevalue(reader)
    prefix = "users/me" if reader == "customer_client" else "seller"

    response = client.get(f"/api/v1/{prefix}/{kind}/")

    assert response.status_code == 200
    assert len(response.data) == 1
    item = response.data[0]
    assert item["id"] == issue_records[kind].pk
    assert "admin_note" not in item
    assert "resolved_by_email" not in item
    assert INTERNAL_NOTE not in response.content.decode()
    assert item["resolution"] == PUBLIC_RESOLUTION


@pytest.mark.parametrize("kind", ["complaints", "returns"])
def test_admin_lists_keep_private_issue_fields(admin_client, admin_user, issue_records, kind):
    response = admin_client.get(f"/api/v1/admin/{kind}/")

    assert response.status_code == 200
    assert response.data[0]["admin_note"] == INTERNAL_NOTE
    assert response.data[0]["resolved_by_email"] == admin_user.email


@pytest.mark.parametrize("kind", ["complaints", "returns"])
def test_admin_update_returns_admin_serializer(admin_client, issue_records, kind):
    record = issue_records[kind]
    response = admin_client.patch(
        f"/api/v1/admin/{kind}/{record.pk}/status/",
        {"admin_note": "Nota interna actualizada para seguimiento."},
        format="json",
    )

    assert response.status_code == 200
    record.refresh_from_db()
    assert response.data["admin_note"] == record.admin_note
    assert record.admin_note == "Nota interna actualizada para seguimiento."


@pytest.mark.parametrize("kind", ["complaints", "returns"])
@pytest.mark.parametrize("reader", ["customer_client", "seller_client"])
def test_nonadmins_cannot_write_internal_notes(request, issue_records, kind, reader):
    client = request.getfixturevalue(reader)
    record = issue_records[kind]

    response = client.patch(
        f"/api/v1/admin/{kind}/{record.pk}/status/",
        {"admin_note": "Intento de modificar una nota interna."},
        format="json",
    )

    assert response.status_code == 403
    record.refresh_from_db()
    assert record.admin_note == INTERNAL_NOTE


@pytest.mark.parametrize("kind", ["complaints", "returns"])
def test_customer_cannot_read_other_customers_issues(second_customer_client, issue_records, kind):
    response = second_customer_client.get(f"/api/v1/users/me/{kind}/")

    assert response.status_code == 200
    assert response.data == []


def test_complaint_creation_ignores_internal_fields(customer_client, purchased_item):
    response = customer_client.post(
        f"/api/v1/orders/{purchased_item.order_id}/complaints/",
        {
            "order_item_id": purchased_item.pk,
            "complaint_type": Complaint.ComplaintType.PRODUCT_PROBLEM,
            "title": "Producto con un inconveniente",
            "description": "El producto recibido no funciona correctamente.",
            "admin_note": INTERNAL_NOTE,
        },
        format="json",
    )

    assert response.status_code == 201
    assert "admin_note" not in response.data
    assert "resolved_by_email" not in response.data
    assert Complaint.objects.get(pk=response.data["id"]).admin_note == ""


def test_return_creation_ignores_internal_fields(customer_client, purchased_item):
    response = customer_client.post(
        f"/api/v1/order-items/{purchased_item.pk}/returns/",
        {
            "reason": ReturnRequest.Reason.DEFECTIVE_PRODUCT,
            "description": "El producto recibido presenta una falla importante.",
            "quantity": 1,
            "admin_note": INTERNAL_NOTE,
        },
        format="json",
    )

    assert response.status_code == 201
    assert "admin_note" not in response.data
    assert "resolved_by_email" not in response.data
    assert ReturnRequest.objects.get(pk=response.data["id"]).admin_note == ""


def test_seller_reads_own_item_complaints_and_shared_order_complaints_only(
    seller_client, purchased_item, customer_user,
):
    other_user = User.objects.create_user(
        email="otro-vendedor@example.test", username="otro-vendedor", role=User.Role.SELLER,
    )
    other_seller = SellerProfile.objects.create(
        user=other_user, business_name="Otro vendedor", tax_id="AUDIT-OTHER", is_active=True,
    )
    product = purchased_item.product
    other_product = Product.objects.create(
        seller=other_seller, category=product.category, region=product.region,
        name="Producto de otro vendedor", sku="PRIVACY-OTHER", price="100.00", stock=1,
        description="Producto usado para comprobar la separación entre vendedores.",
    )
    other_item = OrderItem.objects.create(
        order=purchased_item.order, product=other_product, seller=other_seller,
        product_name=other_product.name, sku=other_product.sku, quantity=1,
        unit_price="100.00", total_price="100.00",
    )
    common = {
        "user": customer_user, "order": purchased_item.order,
        "complaint_type": Complaint.ComplaintType.GENERAL,
        "title": "Reclamo para comprobar permisos", "description": "Descripción del reclamo.",
    }
    own = Complaint.objects.create(order_item=purchased_item, **common)
    other = Complaint.objects.create(order_item=other_item, **common)
    general = Complaint.objects.create(**common)

    response = seller_client.get("/api/v1/seller/complaints/")
    assert response.status_code == 200
    assert {item["id"] for item in response.data} == {own.pk, general.pk}

    other_client = APIClient()
    other_client.force_authenticate(user=other_user)
    response = other_client.get("/api/v1/seller/complaints/")
    assert response.status_code == 200
    assert {item["id"] for item in response.data} == {other.pk, general.pk}


@pytest.mark.parametrize(
    "role,is_staff,is_superuser,is_active,expected",
    [
        (User.Role.ADMIN, False, False, True, 200),
        (User.Role.SUPER_ADMIN, False, False, True, 200),
        (User.Role.CUSTOMER, False, True, True, 200),
        (User.Role.CUSTOMER, True, False, True, 403),
        (User.Role.SELLER, True, False, True, 403),
        (User.Role.LOGISTICS_OPERATOR, False, False, True, 403),
        (User.Role.ADMIN, True, True, False, 403),
    ],
)
def test_platform_admin_access_uses_active_account_and_explicit_role(
    api_client, customer_user, role, is_staff, is_superuser, is_active, expected,
):
    customer_user.role = role
    customer_user.is_staff = is_staff
    customer_user.is_superuser = is_superuser
    customer_user.is_active = is_active
    customer_user.save(update_fields=["role", "is_staff", "is_superuser", "is_active"])
    api_client.force_authenticate(user=customer_user)

    response = api_client.get("/api/v1/admin/dashboard/")

    assert response.status_code == expected


def test_dashboard_counts_canonical_super_admin_role(admin_client, customer_user):
    customer_user.role = User.Role.SUPER_ADMIN
    customer_user.save(update_fields=["role"])

    response = admin_client.get("/api/v1/admin/dashboard/")

    assert response.status_code == 200
    assert response.data["users"]["superadmins"] == 2


@pytest.mark.parametrize(
    "role,is_staff,is_superuser,expected_role",
    [
        (User.Role.CUSTOMER, False, True, User.Role.SUPER_ADMIN),
        (User.Role.CUSTOMER, True, False, User.Role.CUSTOMER),
        (User.Role.ADMIN, False, False, User.Role.ADMIN),
    ],
)
def test_current_user_and_permissions_share_effective_role(
    api_client, customer_user, role, is_staff, is_superuser, expected_role,
):
    customer_user.role = role
    customer_user.is_staff = is_staff
    customer_user.is_superuser = is_superuser
    customer_user.save(update_fields=["role", "is_staff", "is_superuser"])
    api_client.force_authenticate(user=customer_user)

    response = api_client.get("/api/v1/users/me/")

    assert response.status_code == 200
    assert response.data["role"] == expected_role


def test_role_data_migration_preserves_canonical_and_unrelated_roles(customer_user, admin_user):
    legacy = User.objects.create_user(
        email="legacy-admin@example.test", username="legacy-admin", role="SUPERADMIN",
    )
    admin_user.role = User.Role.SUPER_ADMIN
    admin_user.save(update_fields=["role"])
    migration = import_module("apps.users.migrations.0003_normalize_super_admin_role")

    migration.normalize_super_admin_role(apps, SimpleNamespace(connection=connection))

    legacy.refresh_from_db()
    admin_user.refresh_from_db()
    customer_user.refresh_from_db()
    assert legacy.role == User.Role.SUPER_ADMIN
    assert admin_user.role == User.Role.SUPER_ADMIN
    assert customer_user.role == User.Role.CUSTOMER
