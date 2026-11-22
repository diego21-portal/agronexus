import apps.products.media_validation
from django.db import migrations, models
from django.db.migrations.exceptions import IrreversibleError


def choose_main_images(apps, schema_editor):
    Image = apps.get_model("products", "ProductImage")
    images = Image.objects.using(schema_editor.connection.alias)
    product_ids = images.order_by().values_list("product_id", flat=True).distinct()
    for product_id in product_ids.iterator():
        siblings = images.filter(product_id=product_id)
        chosen = siblings.filter(is_main=True).order_by("order", "pk").first()
        if chosen is None:
            chosen = siblings.order_by("order", "pk").first()
        if chosen is not None:
            siblings.exclude(pk=chosen.pk).filter(is_main=True).update(is_main=False)
            siblings.filter(pk=chosen.pk).update(is_main=True)


def protect_pdf_references(apps, schema_editor):
    Product = apps.get_model("products", "Product")
    if Product.objects.using(schema_editor.connection.alias).exclude(technical_sheet="").exists():
        raise IrreversibleError(
            "Hay fichas PDF asociadas a productos. Restaura un respaldo y su versión "
            "de código para preservar las referencias a estos archivos."
        )


class Migration(migrations.Migration):
    dependencies = [
        ("products", "0003_stockmovement_operation_key_stockmovement_order_item_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="product", name="technical_sheet",
            field=models.FileField(
                blank=True, upload_to=apps.products.media_validation.technical_sheet_path,
                validators=[apps.products.media_validation.validate_technical_sheet],
                verbose_name="Ficha técnica PDF",
            ),
        ),
        migrations.AlterField(
            model_name="productimage", name="image",
            field=models.ImageField(
                upload_to=apps.products.media_validation.product_image_path,
                validators=[apps.products.media_validation.validate_product_image],
                verbose_name="Imagen",
            ),
        ),
        migrations.RunPython(choose_main_images, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="productimage",
            constraint=models.UniqueConstraint(
                fields=("product",), condition=models.Q(is_main=True),
                name="one_main_image_per_product",
            ),
        ),
        migrations.RunPython(migrations.RunPython.noop, protect_pdf_references),
    ]
