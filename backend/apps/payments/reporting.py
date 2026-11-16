from decimal import Decimal

from django.db.models import DecimalField, F, OuterRef, Subquery, Sum, Value
from django.db.models.functions import Coalesce

from .models import PaymentRefund


def with_item_refunds(queryset):
    totals = PaymentRefund.objects.filter(
        order_item_id=OuterRef("pk"), kind=PaymentRefund.Kind.PRODUCT,
    ).order_by().values("order_item_id").annotate(total=Sum("amount")).values("total")
    return queryset.annotate(
        refund_total=Coalesce(
            Subquery(totals), Value(Decimal("0.00")),
            output_field=DecimalField(max_digits=12, decimal_places=2),
        ),
    ).annotate(net_revenue=F("total_price") - F("refund_total"))


def with_order_refunds(queryset):
    totals = PaymentRefund.objects.filter(payment__order_id=OuterRef("pk")).order_by().values(
        "payment__order_id",
    ).annotate(total=Sum("amount")).values("total")
    return queryset.annotate(
        refund_total=Coalesce(
            Subquery(totals), Value(Decimal("0.00")),
            output_field=DecimalField(max_digits=12, decimal_places=2),
        ),
    ).annotate(net_revenue=F("total") - F("refund_total"))
