from datetime import date, datetime, timezone
from decimal import Decimal
import os
from pathlib import Path
import subprocess
import sys

from django.db import connection
from django.db.migrations.executor import MigrationExecutor


MIGRATION_BEFORE = ("shipments", "0001_initial")
BACKEND_DIR = Path(__file__).resolve().parents[1]


def run_migration_case(tmp_path, seller_count):
    """An irreversible migration must be tested on its own fresh database."""
    environment = os.environ.copy()
    environment.update(
        DJANGO_SETTINGS_MODULE="config.settings.local",
        DB_ENGINE="django.db.backends.sqlite3",
        DB_NAME=str(tmp_path / "historical_shipments.sqlite3"),
        DB_USER="",
        DB_PASSWORD="",
        DB_HOST="",
        DB_PORT="",
    )
    result = subprocess.run(
        [sys.executable, str(Path(__file__).resolve()), str(seller_count)],
        cwd=BACKEND_DIR,
        env=environment,
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def verify_migration_in_isolated_database(seller_count):
    """Run old schema -> historical records -> new schema, without rollback."""
    executor = MigrationExecutor(connection)
    latest_targets = executor.loader.graph.leaf_nodes()
    # New apps can depend on shipments.0002. Asking for every current leaf
    # together with shipments.0001 would require both forward and backward
    # migrations. Pin only the historical dependencies used by these records.
    before_targets = [
        MIGRATION_BEFORE,
        ("orders", "0002_initial"),
        ("users", "0003_normalize_super_admin_role"),
    ]

    executor.migrate(before_targets)
    before_apps = executor.loader.project_state(before_targets).apps

    def migrate_forward():
        next_executor = MigrationExecutor(connection)
        next_executor.migrate(latest_targets)
        return next_executor.loader.project_state(latest_targets).apps

    checks = {
        0: check_unassigned_legacy_shipment,
        1: check_single_seller_legacy_shipment,
        2: check_multiple_seller_legacy_shipments,
    }
    checks[seller_count]((before_apps, migrate_forward))


def make_legacy_order(apps, seller_count):
    User = apps.get_model("users", "User")
    Address = apps.get_model("users", "Address")
    Region = apps.get_model("regions", "Region")
    Seller = apps.get_model("sellers", "SellerProfile")
    Order = apps.get_model("orders", "Order")
    OrderItem = apps.get_model("orders", "OrderItem")
    Shipment = apps.get_model("shipments", "Shipment")
    ShipmentEvent = apps.get_model("shipments", "ShipmentEvent")

    customer = User.objects.create(
        username="migration_customer",
        email="migration_customer@example.test",
        role="CUSTOMER",
    )
    region = Region.objects.create(
        name="Mendoza",
        province="Mendoza",
        country="Argentina",
    )
    address = Address.objects.create(
        user_id=customer.pk,
        region_id=region.pk,
        street="San Martín",
        number="123",
        city="Mendoza",
        province="Mendoza",
    )
    order = Order.objects.create(
        user_id=customer.pk,
        shipping_address_id=address.pk,
        order_number="AGX-MIGRATION",
        status="DELIVERED",
        subtotal=Decimal("100.00") * seller_count,
        total=Decimal("100.00") * seller_count,
    )
    sellers = []
    for index in range(seller_count):
        seller_user = User.objects.create(
            username=f"migration_seller_{index}",
            email=f"migration_seller_{index}@example.test",
            role="SELLER",
        )
        sellers.append(
            Seller.objects.create(
                user_id=seller_user.pk,
                business_name=f"Proveedor {index}",
            )
        )

    # The original shipment must be assigned deterministically, independently
    # of which seller happened to have the first order item.
    for index, seller in enumerate(reversed(sellers)):
        # Multiple items from the same seller still need just one shipment.
        for item_index in range(2):
            OrderItem.objects.create(
                order_id=order.pk,
                seller_id=seller.pk,
                product_name=f"Producto histórico {index}-{item_index}",
                sku=f"LEGACY-{index}-{item_index}",
                quantity=1,
                unit_price=Decimal("50.00"),
                total_price=Decimal("50.00"),
            )

    shipment = Shipment.objects.create(
        order_id=order.pk,
        tracking_code="TRK-LEGACY-ORIGINAL",
        status="DELIVERED",
        carrier="Transportista histórico",
        estimated_delivery_date=date(2026, 11, 12),
        delivered_at=datetime(2026, 11, 12, 15, 0, tzinfo=timezone.utc),
    )
    ShipmentEvent.objects.create(
        shipment_id=shipment.pk,
        status="CREATED",
        description="Evento original de creación.",
        location="Mendoza",
        created_by_id=customer.pk,
    )
    ShipmentEvent.objects.create(
        shipment_id=shipment.pk,
        status="DELIVERED",
        description="Evento original de entrega.",
        location="Destino histórico",
        created_by_id=customer.pk,
    )
    return order, sellers, shipment


def event_snapshot(shipment):
    return list(
        shipment.events.order_by("pk").values(
            "id", "status", "description", "location", "created_by_id", "created_at"
        )
    )


def assert_original_shipment_is_preserved(
    migrated, original, original_events, *, inherited_notice=False,
):
    assert migrated.pk == original.pk
    assert migrated.order_id == original.order_id
    assert migrated.tracking_code == original.tracking_code
    assert migrated.status == original.status
    assert migrated.carrier == original.carrier
    assert migrated.estimated_delivery_date == original.estimated_delivery_date
    assert migrated.delivered_at == original.delivered_at
    assert migrated.created_at == original.created_at
    migrated_events = event_snapshot(migrated)
    assert migrated_events[:len(original_events)] == original_events
    if inherited_notice:
        assert len(migrated_events) == len(original_events) + 1
        assert_inherited_notice(migrated.events.latest("pk"), original.status)
    else:
        assert migrated_events == original_events


def assert_inherited_notice(notice, expected_status):
    assert notice.status == expected_status
    assert "heredad" in notice.description.lower()
    assert "verific" in notice.description.lower()


def check_single_seller_legacy_shipment(shipment_migration):
    before_apps, migrate_forward = shipment_migration
    order, sellers, original = make_legacy_order(before_apps, seller_count=1)
    original_events = event_snapshot(original)

    after_apps = migrate_forward()
    Shipment = after_apps.get_model("shipments", "Shipment")
    migrated = Shipment.objects.get(order_id=order.pk)

    assert migrated.seller_id == sellers[0].pk
    assert_original_shipment_is_preserved(migrated, original, original_events)


def check_multiple_seller_legacy_shipments(shipment_migration):
    before_apps, migrate_forward = shipment_migration
    order, sellers, original = make_legacy_order(before_apps, seller_count=2)
    original_events = event_snapshot(original)

    after_apps = migrate_forward()
    Shipment = after_apps.get_model("shipments", "Shipment")
    shipments = list(Shipment.objects.filter(order_id=order.pk).order_by("seller_id"))

    assert len(shipments) == 2
    assert [shipment.seller_id for shipment in shipments] == sorted(
        seller.pk for seller in sellers
    )
    assert_original_shipment_is_preserved(
        shipments[0], original, original_events, inherited_notice=True,
    )

    inherited = shipments[1]
    assert inherited.pk != original.pk
    assert inherited.tracking_code
    assert inherited.tracking_code != original.tracking_code
    assert inherited.status == original.status
    assert inherited.carrier == original.carrier
    assert inherited.estimated_delivery_date == original.estimated_delivery_date
    assert inherited.delivered_at == original.delivered_at
    assert len({shipment.tracking_code for shipment in shipments}) == 2

    # Historical events cannot be attributed to a seller whose separate
    # shipment did not exist. Keep a single explicit migration notice instead.
    assert inherited.events.count() == 1
    notice = inherited.events.get()
    assert_inherited_notice(notice, original.status)
    assert notice.pk not in {event["id"] for event in original_events}


def check_unassigned_legacy_shipment(shipment_migration):
    before_apps, migrate_forward = shipment_migration
    order, _, original = make_legacy_order(before_apps, seller_count=0)
    original_events = event_snapshot(original)

    after_apps = migrate_forward()
    Shipment = after_apps.get_model("shipments", "Shipment")
    migrated = Shipment.objects.get(order_id=order.pk)

    assert migrated.seller_id is None
    assert_original_shipment_is_preserved(migrated, original, original_events)


def test_single_seller_legacy_shipment_keeps_identity_and_history(tmp_path):
    run_migration_case(tmp_path, seller_count=1)


def test_multiple_sellers_get_distinct_shipments_without_fabricated_event_history(
    tmp_path,
):
    run_migration_case(tmp_path, seller_count=2)


def test_legacy_shipment_without_items_stays_unassigned_and_keeps_history(tmp_path):
    run_migration_case(tmp_path, seller_count=0)


if __name__ == "__main__":
    import django

    sys.path.insert(0, str(BACKEND_DIR))
    django.setup()
    verify_migration_in_isolated_database(int(sys.argv[1]))
