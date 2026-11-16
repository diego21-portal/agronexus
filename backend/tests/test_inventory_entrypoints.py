from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Barrier

import pytest
from django.db import IntegrityError, close_old_connections, connection, transaction
from django.test import Client
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.products.models import Product, StockMovement
from apps.products.services import change_stock
from apps.orders.models import Order, OrderItem
from apps.users.models import User


pytestmark = pytest.mark.django_db


def test_product_creation_records_initial_inventory_once(
    seller_client, seller_profile, category, brand, region,
):
    response = seller_client.post("/api/v1/seller/products/", {
        "name": "Producto con inventario inicial auditado",
        "sku": "AUDITED-INITIAL",
        "category": category.pk,
        "brand": brand.pk,
        "region": region.pk,
        "description": "Producto creado desde la API del vendedor.",
        "price": "100.00",
        "stock": 7,
        "status": "PUBLISHED",
    }, format="json")

    assert response.status_code == 201, response.data
    product = Product.objects.get(pk=response.data["id"])
    movement = StockMovement.objects.get(product=product)
    assert (product.stock, product.status) == (7, Product.Status.PUBLISHED)
    assert (movement.movement_type, movement.previous_stock, movement.quantity, movement.new_stock) == (
        StockMovement.MovementType.INITIAL, 0, 7, 7,
    )
    assert movement.created_by_id == seller_profile.user_id


def test_general_product_edit_records_stock_delta_and_preserves_other_fields(seller_client, product):
    response = seller_client.patch(f"/api/v1/seller/products/{product.pk}/", {
        "stock": 14, "name": "Nombre actualizado junto al inventario",
    }, format="json")

    assert response.status_code == 200, response.data
    product.refresh_from_db()
    movement = StockMovement.objects.get(product=product)
    assert product.name == "Nombre actualizado junto al inventario"
    assert product.stock == 14
    assert (movement.previous_stock, movement.quantity, movement.new_stock) == (10, 4, 14)
    assert movement.movement_type == StockMovement.MovementType.MANUAL_ADJUSTMENT


def test_absolute_stock_endpoint_uses_a_single_consistent_audit(seller_client, product):
    response = seller_client.patch(f"/api/v1/seller/products/{product.pk}/stock/", {
        "stock": 7, "minimum_stock": 3, "reason": "Conteo físico de inventario.",
    }, format="json")

    assert response.status_code == 200, response.data
    product.refresh_from_db()
    movement = StockMovement.objects.get(product=product)
    assert (product.stock, product.minimum_stock) == (7, 3)
    assert (movement.previous_stock, movement.quantity, movement.new_stock) == (10, -3, 7)
    assert movement.reason == "Conteo físico de inventario."


@pytest.mark.parametrize("movement_type", ["RETURN", "CANCELLATION"])
def test_manual_stock_endpoint_cannot_fake_a_purchase_return(seller_client, product, movement_type):
    response = seller_client.post("/api/v1/seller/stock/movements/", {
        "product": product.pk, "movement_type": movement_type, "quantity": 2,
    }, format="json")

    assert response.status_code == 400
    product.refresh_from_db()
    assert product.stock == 10
    assert not StockMovement.objects.filter(product=product).exists()


def test_inventory_reference_is_idempotent_and_cannot_be_reused_for_another_quantity(product, seller_user):
    arguments = dict(
        product_id=product.pk, delta=3, user=seller_user,
        movement_type=StockMovement.MovementType.RESTOCK,
        reason="Reposición con referencia estable.", operation_key="stock-test:restock",
    )
    first = change_stock(**arguments)
    second = change_stock(**arguments)

    assert first.pk == second.pk
    product.refresh_from_db()
    assert product.stock == 13
    assert StockMovement.objects.filter(product=product).count() == 1
    with pytest.raises(ValidationError):
        change_stock(**{**arguments, "delta": 4})
    product.refresh_from_db()
    assert product.stock == 13


@pytest.mark.parametrize("field", ["price", "discount_price"])
def test_product_api_rejects_negative_money(seller_client, product, field):
    response = seller_client.patch(
        f"/api/v1/seller/products/{product.pk}/", {field: "-1.00"}, format="json",
    )
    assert response.status_code == 400
    product.refresh_from_db()
    assert product.price == Decimal("85000.00")
    assert product.discount_price is None


@pytest.mark.parametrize("field", ["price", "discount_price"])
def test_database_rejects_negative_prices_even_without_serializer(product, field):
    with pytest.raises(IntegrityError), transaction.atomic():
        Product.objects.filter(pk=product.pk).update(**{field: Decimal("-1.00")})


def test_zero_discount_is_respected_as_the_actual_price(seller_client, product):
    response = seller_client.patch(
        f"/api/v1/seller/products/{product.pk}/", {"discount_price": "0.00"}, format="json",
    )
    assert response.status_code == 200, response.data
    product.refresh_from_db()
    assert product.current_price == Decimal("0.00")
    assert response.data["current_price"] == "0.00"


@pytest.mark.parametrize(
    ("status", "active"), [(Product.Status.ARCHIVED, True), (Product.Status.OUT_OF_STOCK, False)],
)
def test_restock_does_not_republish_archived_or_inactive_products(product, seller_user, status, active):
    Product.objects.filter(pk=product.pk).update(status=status, is_active=active)

    change_stock(
        product_id=product.pk, delta=1, user=seller_user,
        movement_type=StockMovement.MovementType.RESTOCK, reason="Reposición controlada.",
    )

    product.refresh_from_db()
    assert product.stock == 11
    assert product.status == status
    assert product.is_active == active


def test_shared_service_rejects_manual_inventory_change_by_customer(product, customer_user):
    with pytest.raises(PermissionDenied):
        change_stock(
            product_id=product.pk, delta=1, user=customer_user,
            movement_type=StockMovement.MovementType.MANUAL_ADJUSTMENT,
            reason="Intento de editar inventario ajeno.",
        )
    product.refresh_from_db()
    assert product.stock == 10


@pytest.fixture
def sale_item(product, customer_user, address):
    unit_price = Decimal(str(product.current_price))
    order = Order.objects.create(
        user=customer_user, shipping_address=address, status=Order.Status.PAID,
        subtotal=unit_price * 2, total=unit_price * 2,
    )
    return OrderItem.objects.create(
        order=order, seller=product.seller, product=product,
        product_name=product.name, sku=product.sku, quantity=2,
        unit_price=unit_price, total_price=unit_price * 2,
    )


def test_purchase_owner_can_record_a_linked_sale_once(sale_item, customer_user):
    values = dict(
        product_id=sale_item.product_id, delta=-2, user=customer_user,
        movement_type=StockMovement.MovementType.SALE, reason="Venta de la compra.",
        operation_key=f"sale:{sale_item.pk}", order_item=sale_item,
    )
    first = change_stock(**values)
    repeated = change_stock(**values)

    assert repeated.pk == first.pk
    sale_item.product.refresh_from_db()
    assert sale_item.product.stock == 8
    assert first.order_item_id == sale_item.pk
    assert StockMovement.objects.filter(order_item=sale_item).count() == 1


@pytest.mark.parametrize("with_source", [False, True])
def test_sale_rejects_missing_source_or_quantity_different_from_purchase(sale_item, customer_user, with_source):
    with pytest.raises(ValidationError):
        change_stock(
            product_id=sale_item.product_id, delta=-1, user=customer_user,
            movement_type=StockMovement.MovementType.SALE, reason="Venta incoherente.",
            operation_key=f"sale-invalid:{sale_item.pk}", order_item=sale_item if with_source else None,
        )
    sale_item.product.refresh_from_db()
    assert sale_item.product.stock == 10
    assert not StockMovement.objects.filter(order_item=sale_item).exists()


def test_sale_rejects_a_customer_who_does_not_own_the_purchase(sale_item, second_customer_user):
    with pytest.raises(PermissionDenied):
        change_stock(
            product_id=sale_item.product_id, delta=-2, user=second_customer_user,
            movement_type=StockMovement.MovementType.SALE, reason="Venta de compra ajena.",
            operation_key=f"sale-foreign:{sale_item.pk}", order_item=sale_item,
        )
    sale_item.product.refresh_from_db()
    assert sale_item.product.stock == 10


def test_django_admin_cannot_forge_a_purchase_stock_movement(admin_user, product):
    client = Client()
    client.force_login(admin_user)

    response = client.post("/admin/products/stockmovement/add/", {
        "product": product.pk, "movement_type": "RETURN", "quantity": 1000,
        "previous_stock": 10, "new_stock": 1010,
    })

    assert response.status_code == 403
    assert not StockMovement.objects.filter(product=product).exists()
    product.refresh_from_db()
    assert product.stock == 10


@pytest.mark.django_db(transaction=True)
def test_concurrent_stock_retries_apply_one_audit_and_one_increment(product, seller_user):
    if connection.vendor != "postgresql":
        pytest.skip("La idempotencia bajo bloqueo concurrente requiere PostgreSQL.")
    barrier = Barrier(2)

    def apply():
        close_old_connections()
        try:
            actor = User.objects.get(pk=seller_user.pk)
            barrier.wait(timeout=15)
            return change_stock(
                product_id=product.pk, delta=3, user=actor,
                movement_type=StockMovement.MovementType.RESTOCK,
                reason="Reintento concurrente de reposición.",
                operation_key="stock-test:parallel-restock",
            ).pk
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        ids = list(pool.map(lambda _: apply(), range(2)))

    assert ids[0] == ids[1]
    product.refresh_from_db()
    assert product.stock == 13
    assert StockMovement.objects.filter(product=product).count() == 1
