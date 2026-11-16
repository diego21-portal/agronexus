"""Upgrade old databases without inventing refunds, receipts or prices."""

import os
from pathlib import Path
import subprocess
import sys

import pytest


BACKEND = Path(__file__).resolve().parents[1]


@pytest.mark.parametrize("scenario", ["payment_refunded", "return_refunded", "return_closed", "invalid_price", "refund_rollback"])
def test_aftersales_upgrade_preserves_and_flags_historical_data(tmp_path, scenario):
    environment = {
        **os.environ,
        "DJANGO_SETTINGS_MODULE": "config.settings.local",
        "DB_ENGINE": "django.db.backends.sqlite3",
        "DB_NAME": str(tmp_path / "upgrade.sqlite3"),
        "DB_HOST": "", "DB_USER": "", "DB_PASSWORD": "", "DB_PORT": "",
    }
    result = subprocess.run(
        [sys.executable, str(Path(__file__).resolve()), scenario],
        cwd=BACKEND, env=environment, capture_output=True, text=True, timeout=90,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def migration_case(scenario):
    from decimal import Decimal

    from django.db import connection
    from django.db.migrations.exceptions import IrreversibleError
    from django.db.migrations.executor import MigrationExecutor
    from test_shipments_migration import make_legacy_order

    executor = MigrationExecutor(connection)
    latest = executor.loader.graph.leaf_nodes()
    old = [
        ("payments", "0001_initial"), ("complaints", "0001_initial"),
        ("products", "0002_stockmovement"), ("shipments", "0002_seller_shipments"),
        ("users", "0003_normalize_super_admin_role"),
    ]
    executor.migrate(old)
    apps = executor.loader.project_state(old).apps
    order, sellers, shipment = make_legacy_order(apps, seller_count=1)
    item = order.items.first()
    payment = apps.get_model("payments", "Payment").objects.create(
        order_id=order.pk, amount=Decimal("100.00"), payment_method="SIMULATED_CARD",
        status="REFUNDED" if scenario == "payment_refunded" else "APPROVED",
    )
    if scenario.startswith("return_"):
        apps.get_model("complaints", "ReturnRequest").objects.create(
            user_id=order.user_id, order_item_id=item.pk, reason="DEFECTIVE_PRODUCT",
            quantity=1, description="Devolución histórica registrada.",
            status="CLOSED" if scenario == "return_closed" else "REFUNDED",
            requested_refund_amount=Decimal("50.00"), approved_refund_amount=Decimal("50.00"),
        )
    if scenario == "invalid_price":
        category = apps.get_model("categories", "Category").objects.create(name="Legacy price")
        product = apps.get_model("products", "Product").objects.create(
            name="Importe histórico inválido", sku="LEGACY-INVALID", seller_id=sellers[0].pk,
            category_id=category.pk, region_id=order.shipping_address.region_id,
            price=Decimal("100.00"), discount_price=Decimal("-1.00"),
        )
        with pytest.raises(RuntimeError, match="importes inválidos"):
            MigrationExecutor(connection).migrate(latest)
        product.refresh_from_db()
        assert product.discount_price == Decimal("-1.00")
        return

    executor = MigrationExecutor(connection)
    executor.migrate(latest)
    apps = executor.loader.project_state(latest).apps
    migrated = apps.get_model("payments", "Payment").objects.get(pk=payment.pk)
    assert migrated.amount == Decimal("100.00")
    assert migrated.refund_review_required is (scenario != "refund_rollback")
    Refund = apps.get_model("payments", "PaymentRefund")
    assert Refund.objects.count() == 0
    assert apps.get_model("aftersales", "ReturnInspection").objects.count() == 0
    if scenario == "refund_rollback":
        case = apps.get_model("aftersales", "CancellationRequest").objects.create(
            shipment_id=shipment.pk, user_id=order.user_id, status="COMPLETED",
            reason="Caso registrado durante la nueva versión.", is_pre_dispatch=True,
        )
        entry = Refund.objects.create(
            payment_id=payment.pk, order_item_id=item.pk, cancellation_request=case,
            kind="PRODUCT", amount=Decimal("10.00"), operation_key="rollback-proof",
        )
        with pytest.raises(IrreversibleError, match="reembolsos"):
            MigrationExecutor(connection).migrate([("payments", "0001_initial")])
        assert Refund.objects.filter(pk=entry.pk).exists()


if __name__ == "__main__":
    sys.path.insert(0, str(BACKEND))
    import django
    django.setup()
    migration_case(sys.argv[1])
