from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Barrier

import pytest
from django.db import close_old_connections, connection
from rest_framework.test import APIClient

from apps.aftersales.models import CancellationRequest
from apps.orders.models import Order, OrderItem
from apps.payments.models import Payment
from apps.products.models import Product, StockMovement
from apps.shipments.models import Shipment, ShipmentEvent
from apps.users.models import User


pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def fast_password_hashing(settings):
    # These tests authenticate through APIClient; password hashing is unrelated.
    settings.PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]


@pytest.fixture
def platform_admin():
    return User.objects.create_user(
        username="platform-admin", email="platform-admin@example.test", role=User.Role.ADMIN,
    )


@pytest.fixture
def platform_admin_client(platform_admin):
    client = APIClient()
    client.force_authenticate(platform_admin)
    return client


@pytest.fixture
def admin_records(customer_user, product, address):
    amount = Decimal(str(product.current_price))
    order = Order.objects.create(
        user=customer_user, shipping_address=address, status=Order.Status.PAID,
        subtotal=amount, total=amount,
    )
    item = OrderItem.objects.create(
        order=order, product=product, seller=product.seller,
        product_name=product.name, sku=product.sku, quantity=1,
        unit_price=amount, total_price=amount,
    )
    payment = Payment.objects.create(
        order=order, amount=amount, status=Payment.Status.APPROVED,
        payment_method=Payment.PaymentMethod.SIMULATED_CARD,
    )
    shipment = Shipment.objects.create(order=order, seller=product.seller)
    ShipmentEvent.objects.create(
        shipment=shipment, status=shipment.status, description="Compra registrada.",
        created_by=customer_user,
    )
    return {"order": order, "item": item, "payment": payment, "shipment": shipment}


def route_requests(customer_user, product, admin_records):
    return [
        ("get", "/api/v1/admin/users/", None),
        ("get", f"/api/v1/admin/users/{customer_user.pk}/", None),
        ("get", "/api/v1/admin/sellers/", None),
        ("patch", f"/api/v1/admin/sellers/{product.seller_id}/verify/", {"is_verified": True}),
        ("get", "/api/v1/admin/products/", None),
        ("get", f"/api/v1/admin/products/{product.pk}/", None),
        ("get", "/api/v1/admin/orders/", None),
        ("get", f"/api/v1/admin/orders/{admin_records['order'].pk}/", None),
        ("get", "/api/v1/admin/payments/", None),
        ("get", "/api/v1/admin/shipments/", None),
    ]


@pytest.mark.parametrize(
    "role,is_staff,is_superuser,is_active,expected",
    [
        (User.Role.ADMIN, False, False, True, 200),
        (User.Role.SUPER_ADMIN, False, False, True, 200),
        (User.Role.CUSTOMER, False, True, True, 200),
        (User.Role.CUSTOMER, True, False, True, 403),
        (User.Role.CUSTOMER, False, False, True, 403),
        (User.Role.SELLER, True, False, True, 403),
        (User.Role.LOGISTICS_OPERATOR, False, False, True, 403),
        (User.Role.ADMIN, True, True, False, 403),
    ],
)
def test_all_admin_routes_require_an_active_effective_admin(
    api_client, customer_user, product, admin_records,
    role, is_staff, is_superuser, is_active, expected,
):
    actor = User.objects.create_user(
        email="route-actor@example.test", username="route-actor", role=role,
        is_staff=is_staff, is_superuser=is_superuser, is_active=is_active,
    )
    api_client.force_authenticate(actor)

    for method, path, data in route_requests(customer_user, product, admin_records):
        response = getattr(api_client, method)(path, data, format="json")
        assert response.status_code == expected, (method, path, response.data)

    for path, data in [
        (f"/api/v1/admin/users/{customer_user.pk}/", {"is_active": True}),
        (f"/api/v1/admin/products/{product.pk}/", {"is_active": True}),
    ]:
        assert api_client.patch(path, data, format="json").status_code == expected


def test_all_admin_routes_require_authentication(api_client, customer_user, product, admin_records):
    for method, path, data in route_requests(customer_user, product, admin_records):
        assert getattr(api_client, method)(path, data, format="json").status_code == 401
    for path in [f"/api/v1/admin/users/{customer_user.pk}/", f"/api/v1/admin/products/{product.pk}/"]:
        assert api_client.patch(path, {"is_active": False}, format="json").status_code == 401


def test_admin_user_and_seller_contract(platform_admin_client, admin_user, seller_profile):
    users = platform_admin_client.get("/api/v1/admin/users/")
    assert isinstance(users.data, list)
    effective_super = next(user for user in users.data if user["id"] == admin_user.pk)
    assert effective_super["role"] == User.Role.SUPER_ADMIN
    assert effective_super["is_superuser"] is True
    assert {"email", "username", "first_name", "last_name", "is_active", "date_joined", "last_login"} <= set(effective_super)
    assert not {"password", "user_permissions", "groups"} & set(effective_super)
    detail = platform_admin_client.get(f"/api/v1/admin/users/{admin_user.pk}/")
    assert detail.data == effective_super

    sellers = platform_admin_client.get("/api/v1/admin/sellers/")
    assert sellers.data[0]["user"]["email"] == seller_profile.user.email
    assert sellers.data[0]["business_name"] == seller_profile.business_name
    assert sellers.data[0]["is_active"] is True


@pytest.mark.parametrize("resource", ["users", "sellers", "products", "orders", "payments", "shipments"])
def test_admin_list_supports_paging_and_preserves_the_array_contract(platform_admin_client, admin_records, resource):
    path = f"/api/v1/admin/{resource}/"
    original = platform_admin_client.get(path)

    assert original.status_code == 200
    assert isinstance(original.data, list)
    assert original.data

    response = platform_admin_client.get(path, {"page_size": 1})

    assert response.status_code == 200
    assert response.data["page"] == 1
    assert response.data["count"] == len(original.data)
    assert response.data["results"] == original.data[:1]
    assert response.data["previous"] is None
    assert bool(response.data["next"]) == (len(original.data) > 1)


def test_admin_pagination_bounds_the_page_size_and_returns_the_last_existing_page(platform_admin_client, platform_admin):
    User.objects.bulk_create([
        User(username=f"paging-{number:03}", email=f"paging-{number:03}@example.test")
        for number in range(101)
    ])
    path = "/api/v1/admin/users/"
    params = {"search": "paging-", "page_size": 500}
    first = platform_admin_client.get(path, {**params, "page": 1})
    last = platform_admin_client.get(path, {**params, "page": 99})

    assert first.status_code == last.status_code == 200
    assert first.data["count"] == last.data["count"] == 101
    assert len(first.data["results"]) == 100
    assert last.data["page"] == 2
    assert len(last.data["results"]) == 1
    assert last.data["next"] is None
    assert first.data["results"][-1]["id"] > last.data["results"][0]["id"]


def test_admin_user_search_and_effective_role_are_applied_before_paging(platform_admin_client):
    platform_super = User.objects.create_user(
        username="pager-super", email="sofia@example.test", first_name="Sofía", last_name="Paredes",
        role=User.Role.CUSTOMER, is_superuser=True,
    )
    User.objects.create_user(
        username="pager-customer", email="sofia-cliente@example.test", first_name="Sofía", last_name="Paredes",
        role=User.Role.CUSTOMER,
    )
    path = "/api/v1/admin/users/"
    response = platform_admin_client.get(path, {"page": 1, "search": "Sofía Paredes", "role": User.Role.SUPER_ADMIN})

    assert response.status_code == 200
    assert response.data["count"] == 1
    assert response.data["results"][0]["id"] == platform_super.pk
    assert response.data["results"][0]["role"] == User.Role.SUPER_ADMIN
    assert platform_admin_client.get(path, {"role": "UNKNOWN"}).status_code == 400


def test_admin_product_and_order_filters_work_with_paging(platform_admin_client, admin_records, product):
    response = platform_admin_client.get("/api/v1/admin/products/", {"page": 1, "search": product.sku.lower()})
    assert response.status_code == 200
    assert [record["id"] for record in response.data["results"]] == [product.pk]

    pathway = "/api/v1/admin/orders/"
    response = platform_admin_client.get(pathway, {"page": 1, "status": Order.Status.DELIVERED})
    assert response.status_code == 200
    assert response.data["count"] == 0
    response = platform_admin_client.get(pathway, {"page": 1, "status": Order.Status.PAID})
    assert response.status_code == 200
    assert [record["id"] for record in response.data["results"]] == [admin_records["order"].pk]
    assert platform_admin_client.get(pathway, {"status": "UNKNOWN"}).status_code == 400


def test_admin_product_contract_includes_inactive_drafts(platform_admin_client, product):
    product.is_active = False
    product.status = Product.Status.DRAFT
    product.save(update_fields=["is_active", "status"])
    response = platform_admin_client.get("/api/v1/admin/products/")
    assert len(response.data) == 1
    dto = response.data[0]
    assert dto["is_active"] is False
    assert dto["status"] == Product.Status.DRAFT
    assert dto["seller_id"] == product.seller_id
    assert dto["seller_name"] == product.seller.business_name
    assert dto["seller"]["id"] == product.seller_id
    assert dto["category"]["id"] == product.category_id
    assert dto["brand"]["id"] == product.brand_id
    assert dto["region"]["id"] == product.region_id
    assert dto["price"] == "85000.00"
    assert dto["current_price"] == "85000.00"
    assert dto["images"] == []
    detail = platform_admin_client.get(f"/api/v1/admin/products/{product.pk}/")
    assert detail.data == dto


def test_admin_financial_contract_reuses_order_delivery_and_refund_details(platform_admin_client, admin_records):
    order = admin_records["order"]
    orders = platform_admin_client.get("/api/v1/admin/orders/")
    detail = platform_admin_client.get(f"/api/v1/admin/orders/{order.pk}/")
    assert orders.data == [detail.data]
    dto = detail.data
    assert dto["total"] == "85000.00"
    assert dto["refunded_amount"] == "0.00"
    assert dto["net_total"] == "85000.00"
    assert dto["items"][0]["id"] == admin_records["item"].pk
    assert dto["items"][0]["delivery_status"] == Shipment.Status.CREATED
    assert dto["items"][0]["is_delivered"] is False
    assert dto["shipments"][0]["id"] == admin_records["shipment"].pk
    assert dto["payment"]["refundable_amount"] == "85000.00"

    payments = platform_admin_client.get("/api/v1/admin/payments/")
    assert payments.data[0]["order"] == order.pk
    assert payments.data[0]["order_number"] == order.order_number
    assert payments.data[0]["amount"] == dto["total"]
    shipments = platform_admin_client.get("/api/v1/admin/shipments/")
    assert shipments.data[0]["order"] == order.pk
    assert shipments.data[0]["order_number"] == order.order_number
    assert shipments.data[0]["seller_name"] == admin_records["item"].seller.business_name
    assert shipments.data[0]["events"][0]["description"] == "Compra registrada."


def test_admin_financial_serializers_do_not_add_notes_to_public_payloads(
    platform_admin_client, customer_client, admin_records, customer_user,
):
    CancellationRequest.objects.create(
        shipment=admin_records["shipment"], user=customer_user,
        reason="Solicitud del cliente para cancelar la compra.",
        admin_note="PRIVATE ADMIN NOTE MUST NOT LEAK",
    )
    for client, path in [
        (platform_admin_client, "/api/v1/admin/orders/"),
        (platform_admin_client, "/api/v1/admin/shipments/"),
        (customer_client, "/api/v1/orders/"),
    ]:
        response = client.get(path)
        assert response.status_code == 200
        assert "admin_note" not in response.content.decode()
        assert "PRIVATE ADMIN NOTE" not in response.content.decode()


@pytest.mark.parametrize("value", [False, True])
def test_admin_can_update_user_access_with_persistence(platform_admin_client, customer_user, value):
    response = platform_admin_client.patch(
        f"/api/v1/admin/users/{customer_user.pk}/",
        {"role": User.Role.SELLER, "is_active": value,
         "seller_profile": {"business_name": "Agro Cliente"}}, format="json",
    )
    assert response.status_code == 200
    customer_user.refresh_from_db()
    assert customer_user.role == response.data["role"] == User.Role.SELLER
    assert customer_user.is_active == response.data["is_active"] == value


@pytest.mark.parametrize("payload", [
    {"is_staff": True}, {"is_superuser": True}, {"password": "changed"},
    {"email": "changed@example.test"}, {"username": "changed"}, {"groups": []},
    {"role": "SUPERADMIN"}, {"is_active": "not-a-boolean"}, {"role": None},
    {"is_active": None}, {}, [], "invalid", None,
])
def test_user_updates_reject_unapproved_or_malformed_payloads(platform_admin_client, customer_user, payload):
    original = (customer_user.role, customer_user.email, customer_user.password, customer_user.is_active)
    response = platform_admin_client.patch(
        f"/api/v1/admin/users/{customer_user.pk}/", payload, format="json",
    )
    assert response.status_code == 400
    customer_user.refresh_from_db()
    assert (customer_user.role, customer_user.email, customer_user.password, customer_user.is_active) == original
    assert customer_user.is_staff is False
    assert customer_user.is_superuser is False


@pytest.mark.parametrize("legacy", [False, True])
@pytest.mark.parametrize("payload", [{"role": User.Role.CUSTOMER}, {"is_active": False}])
def test_admin_cannot_modify_any_effective_super_admin(platform_admin_client, legacy, payload):
    target = User.objects.create_user(
        username="protected-super", email="protected-super@example.test",
        role=User.Role.CUSTOMER if legacy else User.Role.SUPER_ADMIN, is_superuser=legacy,
    )
    response = platform_admin_client.patch(f"/api/v1/admin/users/{target.pk}/", payload, format="json")
    assert response.status_code == 403
    target.refresh_from_db()
    assert target.effective_role == User.Role.SUPER_ADMIN
    assert target.is_active is True


def test_admin_cannot_promote_super_admin(platform_admin_client, customer_user):
    response = platform_admin_client.patch(
        f"/api/v1/admin/users/{customer_user.pk}/", {"role": User.Role.SUPER_ADMIN}, format="json",
    )
    assert response.status_code == 403
    customer_user.refresh_from_db()
    assert customer_user.role == User.Role.CUSTOMER


def test_super_admin_can_promote_and_demote_other_roles(admin_client, customer_user):
    path = f"/api/v1/admin/users/{customer_user.pk}/"
    assert admin_client.patch(path, {"role": User.Role.SUPER_ADMIN}, format="json").status_code == 200
    customer_user.refresh_from_db()
    assert customer_user.effective_role == User.Role.SUPER_ADMIN
    assert customer_user.is_superuser is False
    assert admin_client.patch(path, {"role": User.Role.ADMIN}, format="json").status_code == 200
    customer_user.refresh_from_db()
    assert customer_user.role == User.Role.ADMIN


def test_accounts_cannot_disable_themselves(platform_admin_client, platform_admin):
    response = platform_admin_client.patch(
        f"/api/v1/admin/users/{platform_admin.pk}/", {"is_active": False}, format="json",
    )
    assert response.status_code == 400
    platform_admin.refresh_from_db()
    assert platform_admin.is_active is True


def test_last_active_admin_cannot_be_demoted(platform_admin_client, platform_admin):
    User.objects.create_user(
        username="inactive-admin", email="inactive-admin@example.test", role=User.Role.ADMIN, is_active=False,
    )
    response = platform_admin_client.patch(
        f"/api/v1/admin/users/{platform_admin.pk}/", {"role": User.Role.CUSTOMER}, format="json",
    )
    assert response.status_code == 400
    platform_admin.refresh_from_db()
    assert platform_admin.role == User.Role.ADMIN


def test_last_canonical_super_admin_cannot_be_demoted(api_client, platform_admin):
    actor = User.objects.create_user(
        username="canonical-super", email="canonical-super@example.test", role=User.Role.SUPER_ADMIN,
    )
    api_client.force_authenticate(actor)
    response = api_client.patch(f"/api/v1/admin/users/{actor.pk}/", {"role": User.Role.ADMIN}, format="json")
    assert response.status_code == 400
    actor.refresh_from_db()
    assert actor.role == User.Role.SUPER_ADMIN


def test_legacy_super_admin_cannot_receive_misleading_role_change(admin_client, admin_user):
    response = admin_client.patch(
        f"/api/v1/admin/users/{admin_user.pk}/", {"role": User.Role.CUSTOMER}, format="json",
    )
    assert response.status_code == 400
    admin_user.refresh_from_db()
    assert admin_user.effective_role == User.Role.SUPER_ADMIN


def test_stale_authenticated_admin_is_rechecked_before_user_mutation(platform_admin_client, platform_admin, customer_user):
    User.objects.filter(pk=platform_admin.pk).update(role=User.Role.CUSTOMER)
    response = platform_admin_client.patch(
        f"/api/v1/admin/users/{customer_user.pk}/", {"is_active": False}, format="json",
    )
    assert response.status_code == 403
    customer_user.refresh_from_db()
    assert customer_user.is_active is True


@pytest.mark.parametrize("resource", ["seller", "product"])
def test_stale_admin_cannot_change_seller_or_product(platform_admin_client, platform_admin, product, resource):
    User.objects.filter(pk=platform_admin.pk).update(is_active=False)
    if resource == "seller":
        path = f"/api/v1/admin/sellers/{product.seller_id}/verify/"
        payload = {"is_verified": False}
    else:
        path = f"/api/v1/admin/products/{product.pk}/"
        payload = {"is_active": False}
    assert platform_admin_client.patch(path, payload, format="json").status_code == 403
    product.refresh_from_db()
    product.seller.refresh_from_db()
    assert product.is_active is True
    assert product.seller.is_verified is True


@pytest.mark.parametrize("value", [True, False])
def test_admin_seller_verification_is_persisted(platform_admin_client, seller_profile, value):
    response = platform_admin_client.patch(
        f"/api/v1/admin/sellers/{seller_profile.pk}/verify/", {"is_verified": value}, format="json",
    )
    assert response.status_code == 200
    seller_profile.refresh_from_db()
    assert seller_profile.is_verified == response.data["is_verified"] == value
    assert response.data["user"]["id"] == seller_profile.user_id


@pytest.mark.parametrize("payload", [
    {"is_verified": True, "is_active": False}, {"business_name": "Changed"},
    {"user": 1}, {"is_verified": "invalid"}, {"is_verified": None}, {}, [],
])
def test_seller_verification_rejects_other_changes(platform_admin_client, seller_profile, payload):
    response = platform_admin_client.patch(
        f"/api/v1/admin/sellers/{seller_profile.pk}/verify/", payload, format="json",
    )
    assert response.status_code == 400
    seller_profile.refresh_from_db()
    assert seller_profile.is_verified is True
    assert seller_profile.is_active is True
    assert seller_profile.business_name == "Agro Repuestos Mendoza"


@pytest.mark.parametrize("value", [False, True])
def test_admin_product_visibility_is_persisted_without_inventory_changes(platform_admin_client, product, value):
    before = (product.stock, Decimal(str(product.price)), product.status, StockMovement.objects.count())
    response = platform_admin_client.patch(
        f"/api/v1/admin/products/{product.pk}/", {"is_active": value}, format="json",
    )
    assert response.status_code == 200
    product.refresh_from_db()
    assert product.is_active == response.data["is_active"] == value
    assert (product.stock, product.price, product.status, StockMovement.objects.count()) == before


@pytest.mark.parametrize("field,value", [
    ("stock", 999), ("minimum_stock", 999), ("price", "1.00"),
    ("seller", 999), ("seller_id", 999), ("status", "PUBLISHED"), ("name", "Changed"),
])
def test_admin_product_updates_cannot_bypass_seller_inventory_rules(platform_admin_client, product, field, value):
    response = platform_admin_client.patch(
        f"/api/v1/admin/products/{product.pk}/", {"is_active": False, field: value}, format="json",
    )
    assert response.status_code == 400
    product.refresh_from_db()
    assert product.is_active is True
    assert product.stock == 10
    assert product.price == Decimal("85000.00")
    assert product.status == Product.Status.PUBLISHED
    assert StockMovement.objects.count() == 0


@pytest.mark.parametrize("payload", [{}, [], {"is_active": None}, {"is_active": "invalid"}])
def test_admin_product_updates_reject_malformed_payloads(platform_admin_client, product, payload):
    response = platform_admin_client.patch(f"/api/v1/admin/products/{product.pk}/", payload, format="json")
    assert response.status_code == 400
    product.refresh_from_db()
    assert product.is_active is True


@pytest.mark.parametrize("method,path,payload", [
    ("get", "users/999999/", None), ("patch", "users/999999/", {"is_active": False}),
    ("patch", "sellers/999999/verify/", {"is_verified": True}),
    ("get", "products/999999/", None), ("patch", "products/999999/", {"is_active": False}),
    ("get", "orders/999999/", None),
])
def test_admin_missing_objects_return_404(platform_admin_client, method, path, payload):
    response = getattr(platform_admin_client, method)(f"/api/v1/admin/{path}", payload, format="json")
    assert response.status_code == 404


@pytest.mark.parametrize("method", ["post", "put", "patch", "delete"])
def test_admin_financial_resources_are_read_only(platform_admin_client, admin_records, method):
    order = admin_records["order"]
    for path in ["orders/", f"orders/{order.pk}/", "payments/", "shipments/"]:
        response = getattr(platform_admin_client, method)(
            f"/api/v1/admin/{path}", {"status": "CANCELLED", "amount": "0.00", "total": "0.00"}, format="json",
        )
        assert response.status_code == 405, path
    for record in admin_records.values():
        record.refresh_from_db()
    assert order.status == Order.Status.PAID
    assert order.total == Decimal("85000.00")
    assert admin_records["payment"].status == Payment.Status.APPROVED
    assert admin_records["payment"].amount == Decimal("85000.00")
    assert admin_records["shipment"].status == Shipment.Status.CREATED


@pytest.mark.django_db(transaction=True)
def test_concurrent_super_admin_demotions_leave_an_operational_super_admin():
    if connection.vendor != "postgresql":
        pytest.skip("Row-lock concurrency requires PostgreSQL.")
    actors = [User.objects.create_user(
        username=f"concurrent-super-{index}", email=f"concurrent-super-{index}@example.test",
        role=User.Role.SUPER_ADMIN,
    ) for index in range(2)]
    barrier = Barrier(2)

    def demote_other(index):
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(actors[index])
            barrier.wait(timeout=10)
            response = client.patch(
                f"/api/v1/admin/users/{actors[1-index].pk}/", {"role": User.Role.ADMIN}, format="json",
            )
            return response.status_code
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = list(pool.map(demote_other, range(2)))
    assert sorted(statuses) == [200, 403]
    assert User.objects.filter(role=User.Role.SUPER_ADMIN, is_active=True).count() == 1
