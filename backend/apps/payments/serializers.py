from rest_framework import serializers

from .models import Payment, PaymentRefund


class PaymentRefundSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentRefund
        fields = ("id", "order_item", "kind", "amount", "created_at")
        read_only_fields = fields


class PaymentSerializer(serializers.ModelSerializer):
    refunded_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    refundable_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    refunds = PaymentRefundSerializer(many=True, read_only=True)

    class Meta:
        model = Payment
        fields = (
            "id",
            "payment_method",
            "status",
            "amount",
            "refunded_amount",
            "refundable_amount",
            "refund_review_required",
            "refunds",
            "transaction_code",
            "paid_at",
            "created_at",
        )
