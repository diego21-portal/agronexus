from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from django.db.models import F, Q, Sum

from apps.complaints.models import ReturnRequest
from apps.payments.models import Payment
from apps.products.models import Product


class Command(BaseCommand):
    help = "Revisa importes históricos y recepciones pendientes sin modificar datos."
    requires_system_checks = []

    def handle(self, *args, **options):
        tables = set(connection.introspection.table_names())
        if Product._meta.db_table not in tables:
            self.stdout.write("La base todavía no tiene el esquema inicial; aplica las migraciones.")
            return
        invalid = list(Product.objects.filter(
            Q(price__lt=0) | Q(discount_price__lt=0) | Q(discount_price__gte=F("price"))
        ).values_list("pk", flat=True))
        self.stdout.write(f"Productos con precios o descuentos inválidos: {len(invalid)}")
        if invalid:
            self.stdout.write(f"Identificadores: {invalid[:50]}")

        reviews = 0
        if Payment._meta.db_table in tables:
            with connection.cursor() as cursor:
                columns = {column.name for column in connection.introspection.get_table_description(cursor, Payment._meta.db_table)}
            if "refund_review_required" in columns:
                reviews = Payment.objects.filter(refund_review_required=True).count()
            elif ReturnRequest._meta.db_table in tables:
                old_returns = ReturnRequest.objects.filter(status__in=["REFUNDED", "CLOSED"]).values("order_item__order_id")
                reviews = Payment.objects.filter(Q(status="REFUNDED") | Q(order_id__in=old_returns)).count()
        self.stdout.write(f"Pagos históricos que requieren conciliación de reembolsos: {reviews}")

        from apps.aftersales.models import ReturnInspection
        if ReturnInspection._meta.db_table in tables:
            pending = ReturnInspection.objects.aggregate(
                total=Sum(F("received_quantity") - F("restocked_quantity") - F("defective_quantity")),
            )["total"] or 0
            self.stdout.write(f"Unidades recibidas pendientes de inspección: {pending}")
        self.stdout.write("Revisión de lectura completada; no se modificaron importes ni inventario.")
        if invalid:
            raise CommandError("Corrige los importes indicados antes de aplicar las nuevas restricciones de precios.")
