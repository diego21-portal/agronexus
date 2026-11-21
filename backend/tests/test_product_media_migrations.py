"""Upgrade legacy image flags without losing paths or inventing PDF references."""
import os
from pathlib import Path
import subprocess
import sys


BACKEND = Path(__file__).resolve().parents[1]
OLD = ("products", "0003_stockmovement_operation_key_stockmovement_order_item_and_more")


def test_media_upgrade_normalizes_main_images_and_protects_pdf_rollback(tmp_path):
    environment = {
        **os.environ, "DJANGO_SETTINGS_MODULE": "config.settings.local",
        "DB_ENGINE": "django.db.backends.sqlite3", "DB_NAME": str(tmp_path / "media-upgrade.sqlite3"),
        "DB_HOST": "", "DB_USER": "", "DB_PASSWORD": "", "DB_PORT": "",
    }
    result = subprocess.run(
        [sys.executable, str(Path(__file__).resolve())], cwd=BACKEND,
        env=environment, capture_output=True, text=True, timeout=90,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def verify_upgrade():
    from django.db import connection
    from django.db.migrations.exceptions import IrreversibleError
    from django.db.migrations.executor import MigrationExecutor

    executor = MigrationExecutor(connection)
    latest = executor.loader.graph.leaf_nodes()
    executor.migrate([OLD])
    apps = executor.loader.project_state([OLD]).apps
    user = apps.get_model("users", "User").objects.create(
        username="legacy-media", email="legacy-media@example.test", role="SELLER",
    )
    seller = apps.get_model("sellers", "SellerProfile").objects.create(user=user, business_name="Fotos históricas")
    category = apps.get_model("categories", "Category").objects.create(name="Repuestos históricos", slug="media-legacy")
    region = apps.get_model("regions", "Region").objects.create(name="Mendoza", province="Mendoza", slug="media-legacy")
    Product = apps.get_model("products", "Product")
    products = [Product.objects.create(
        name=f"Producto histórico {index}", slug=f"media-legacy-{index}", sku=f"MEDIA-LEGACY-{index}",
        seller=seller, category=category, region=region, price="10.00", stock=3,
    ) for index in range(3)]
    Image = apps.get_model("products", "ProductImage")
    rows = [
        Image.objects.create(product=products[0], image="legacy/old-main-a.png", is_main=True, order=2),
        Image.objects.create(product=products[0], image="legacy/old-main-b.png", is_main=True, order=0),
        Image.objects.create(product=products[0], image="legacy/old-extra.png", is_main=False, order=0),
        Image.objects.create(product=products[1], image="legacy/no-main-a.png", is_main=False, order=3),
        Image.objects.create(product=products[1], image="legacy/no-main-b.png", is_main=False, order=1),
    ]
    before = list(Image.objects.order_by("pk").values_list("pk", "image", "order", "product_id"))
    executor = MigrationExecutor(connection)
    executor.migrate(latest)
    apps = executor.loader.project_state(latest).apps
    Image = apps.get_model("products", "ProductImage")
    Product = apps.get_model("products", "Product")
    assert list(Image.objects.order_by("pk").values_list("pk", "image", "order", "product_id")) == before
    assert set(Image.objects.filter(is_main=True).values_list("pk", flat=True)) == {rows[1].pk, rows[4].pk}
    assert Product.objects.filter(technical_sheet="").count() == 3
    assert not Image.objects.filter(product_id=products[2].pk).exists()

    # A schema rollback must not silently discard the only PDF reference.
    name = "products/documents/historical-reference.pdf"
    Product.objects.filter(pk=products[0].pk).update(technical_sheet=name)
    try:
        MigrationExecutor(connection).migrate([OLD])
    except IrreversibleError as error:
        assert "PDF" in str(error)
    else:
        raise AssertionError("Rollback with a referenced PDF must be rejected")
    assert Product.objects.get(pk=products[0].pk).technical_sheet == name


if __name__ == "__main__":
    sys.path.insert(0, str(BACKEND))
    import django
    django.setup()
    verify_upgrade()
