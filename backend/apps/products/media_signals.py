from django.db.models.signals import post_delete
from django.dispatch import receiver

from .models import Product, ProductImage, _delete_file_after_commit


@receiver(post_delete, sender=ProductImage)
def clean_deleted_product_image(sender, instance, **kwargs):
    _delete_file_after_commit(instance.image.storage, instance.image.name)
    images = ProductImage.objects.filter(product_id=instance.product_id)
    if not images.filter(is_main=True).exists():
        replacement = images.order_by("order", "pk").first()
        if replacement:
            images.filter(pk=replacement.pk).update(is_main=True)


@receiver(post_delete, sender=Product)
def clean_deleted_technical_sheet(sender, instance, **kwargs):
    _delete_file_after_commit(instance.technical_sheet.storage, instance.technical_sheet.name)
