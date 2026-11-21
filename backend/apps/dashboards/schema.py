"""Response contracts for the dictionaries returned by dashboard views.

Dashboard values are rendered directly by JSONRenderer: Decimal aggregates are
JSON numbers. Monetary values produced by ModelSerializer remain strings.
"""

from drf_spectacular.utils import inline_serializer
from rest_framework import serializers

from apps.complaints.models import Complaint, ReturnRequest
from apps.orders.models import Order
from apps.payments.models import Payment
from apps.products.models import Product, StockMovement
from apps.sellers.serializers import SellerProfileSummarySerializer
from apps.shipments.models import Shipment
from apps.shipments.serializers import ShipmentSerializer


def counters(*names):
    return {name: serializers.IntegerField() for name in names}


def numbers(*names):
    return {name: serializers.FloatField() for name in names}


def strings(*names):
    return {name: serializers.CharField() for name in names}


def section(name, fields, **kwargs):
    return inline_serializer(name, fields=fields, **kwargs)


def stock_product_fields():
    return {
        **counters("id", "stock", "minimum_stock"),
        **strings("name", "sku"),
        "status": serializers.ChoiceField(choices=Product.Status.choices),
    }


def pending_question_fields():
    return {
        **counters("id", "product_id"),
        **strings("product_name", "question"),
        "created_at": serializers.DateTimeField(),
    }


def review_fields():
    return {
        **counters("id", "product_id", "rating"),
        **strings("product_name", "comment"),
        "user_email": serializers.EmailField(),
        "created_at": serializers.DateTimeField(),
    }


def top_product_fields():
    return {
        "product_id": serializers.IntegerField(allow_null=True),
        **strings("product_name", "sku"),
        **counters("units_sold"),
        **numbers("revenue"),
    }


def recent_order_fields():
    return {
        **counters("id", "items_count"),
        **strings("order_number"),
        "customer_email": serializers.EmailField(),
        "status": serializers.ChoiceField(choices=Order.Status.choices),
        "payment_status": serializers.ChoiceField(choices=Payment.Status.choices, allow_null=True),
        "shipment_status": serializers.ChoiceField(choices=Shipment.Status.choices, allow_null=True),
        "tracking_code": serializers.CharField(allow_null=True, allow_blank=True),
        "created_at": serializers.DateTimeField(),
    }


def stock_movement_fields():
    return {
        **counters("id", "product_id", "quantity", "previous_stock", "new_stock"),
        **strings("product_name", "product_sku", "reason"),
        "movement_type": serializers.ChoiceField(choices=StockMovement.MovementType.choices),
        "created_by_email": serializers.EmailField(allow_null=True),
        "created_at": serializers.DateTimeField(),
    }


def complaint_fields():
    return {
        **counters("id"),
        **strings("order_number", "title"),
        "user_email": serializers.EmailField(),
        "complaint_type": serializers.ChoiceField(choices=Complaint.ComplaintType.choices),
        "created_at": serializers.DateTimeField(),
    }


def return_fields():
    return {
        **counters("id", "quantity"),
        **strings("order_number", "product_name"),
        "user_email": serializers.EmailField(),
        "reason": serializers.ChoiceField(choices=ReturnRequest.Reason.choices),
        **numbers("requested_refund_amount"),
        "created_at": serializers.DateTimeField(),
    }


class AdminDashboardSerializer(serializers.Serializer):
    users = section("AdminDashboardUsers", counters(
        "total_users", "active_users", "inactive_users", "staff_users", "superusers",
        "customers", "sellers", "logistics_operators", "admins", "superadmins", "new_users_last_30_days",
    ))
    sellers = section("AdminDashboardSellers", counters(
        "total_sellers", "active_sellers", "inactive_sellers", "verified_sellers", "unverified_sellers",
    ))
    products = section("AdminDashboardProducts", counters(
        "total_products", "active_products", "inactive_products", "published_products",
        "draft_products", "paused_products", "out_of_stock_products", "archived_products",
        "featured_products", "low_stock_products",
    ))
    orders = section("AdminDashboardOrders", counters(
        "total_orders", "pending_orders", "confirmed_orders", "paid_orders", "preparing_orders",
        "shipped_orders", "delivered_orders", "cancelled_orders", "problem_orders", "valid_sales_orders",
    ))
    sales = section("AdminDashboardSales", {
        **counters("total_orders", "total_units_sold", "orders_last_30_days", "orders_today"),
        **numbers("total_revenue", "gross_revenue", "refunded_amount", "average_order_value", "revenue_last_30_days", "revenue_today"),
    })
    payments = section("AdminDashboardPayments", {
        **counters("total_payments", "refund_review_required"),
        **numbers("approved_amount", "refunded_amount"),
        "by_status": section("AdminDashboardPaymentCounts", counters(
            "pending", "approved", "rejected", "cancelled", "refunded", "partially_refunded",
        )),
        "by_method": serializers.DictField(child=serializers.IntegerField()),
    })
    shipments = section("AdminDashboardShipments", {
        **counters("total_shipments", "created_shipments", "in_transit_shipments", "delivered_shipments", "problem_shipments", "cancelled_shipments"),
        "by_status": serializers.DictField(child=serializers.IntegerField()),
    })
    stock = section("AdminDashboardStock", {
        **counters("low_stock_count", "out_of_stock_count"),
        "low_stock_products": section("AdminDashboardLowStockProduct", {
            **stock_product_fields(), **strings("seller", "category"),
            "brand": serializers.CharField(allow_null=True),
        }, many=True),
        "out_of_stock_products": section("AdminDashboardOutOfStockProduct", {
            **counters("id"), **strings("name", "sku", "seller", "category"),
            "brand": serializers.CharField(allow_null=True),
            "status": serializers.ChoiceField(choices=Product.Status.choices),
            "updated_at": serializers.DateTimeField(),
        }, many=True),
    })
    questions = section("AdminDashboardQuestions", {
        **counters("total_questions", "pending_questions", "answered_questions", "hidden_questions"),
        "recent_pending_questions": section("AdminDashboardQuestion", {
            **pending_question_fields(), **strings("seller"), "user_email": serializers.EmailField(),
        }, many=True),
    })
    reviews = section("AdminDashboardReviews", {
        **numbers("average_rating"), **counters("total_reviews"),
        "rating_distribution": serializers.DictField(child=serializers.IntegerField()),
        "recent_reviews": section("AdminDashboardReview", {
            **review_fields(), **strings("seller"),
        }, many=True),
    })
    top_products = section("AdminDashboardTopProduct", {
        **top_product_fields(), "seller": serializers.CharField(allow_null=True),
    }, many=True)
    top_sellers = section("AdminDashboardTopSeller", {
        "seller_id": serializers.IntegerField(allow_null=True),
        "seller": serializers.CharField(allow_null=True),
        **counters("orders_count", "units_sold"), **numbers("revenue"),
    }, many=True)
    recent_orders = section("AdminDashboardRecentOrder", {
        **recent_order_fields(), **numbers("subtotal", "shipping_cost", "total"),
        "shipments": section("AdminDashboardOrderShipment", {
            **counters("id"),
            "seller": serializers.IntegerField(allow_null=True),
            "seller_name": serializers.CharField(allow_null=True),
            "status": serializers.ChoiceField(choices=Shipment.Status.choices),
            **strings("tracking_code"),
        }, many=True),
    }, many=True)
    recent_stock_movements = section("AdminDashboardStockMovement", {
        **stock_movement_fields(), **strings("seller"),
    }, many=True)
    monthly_sales = section("AdminDashboardMonthlySale", {
        "month": serializers.CharField(allow_null=True),
        **numbers("revenue"), **counters("orders_count"),
    }, many=True)
    complaints = section("AdminDashboardComplaints", {
        **counters("total_complaints", "open_complaints", "in_review_complaints", "waiting_customer_complaints", "resolved_complaints", "rejected_complaints"),
        "recent_open_complaints": section("AdminDashboardComplaint", {
            **complaint_fields(), "order_item_id": serializers.IntegerField(allow_null=True),
            "seller": serializers.CharField(allow_null=True),
        }, many=True),
    })
    returns = section("AdminDashboardReturns", {
        **counters("total_returns", "requested_returns", "in_review_returns", "approved_returns", "rejected_returns", "product_received_returns", "refunded_returns", "closed_returns"),
        **numbers("total_requested_amount", "total_approved_amount"),
        "recent_requested_returns": section("AdminDashboardReturn", {
            **return_fields(), **strings("seller"),
        }, many=True),
    })


class SellerDashboardSerializer(serializers.Serializer):
    seller = SellerProfileSummarySerializer()
    products = section("SellerDashboardProducts", counters(
        "total_products", "published_products", "draft_products", "paused_products",
        "out_of_stock_products", "archived_products", "featured_products", "low_stock_products",
    ))
    sales = section("SellerDashboardSales", {
        **counters("total_orders", "total_units_sold"),
        **numbers("total_revenue", "gross_revenue", "refunded_amount", "average_order_value"),
    })
    orders = section("SellerDashboardOrders", counters(
        "total_orders", "paid_orders", "preparing_orders", "shipped_orders",
        "delivered_orders", "cancelled_orders", "problem_orders",
    ))
    stock = section("SellerDashboardStock", {
        **counters("out_of_stock_count", "low_stock_count"),
        "low_stock_products": section("SellerDashboardLowStockProduct", stock_product_fields(), many=True),
    })
    questions = section("SellerDashboardQuestions", {
        **counters("total_questions", "pending_questions", "answered_questions"),
        "recent_pending_questions": section("SellerDashboardQuestion", pending_question_fields(), many=True),
    })
    reviews = section("SellerDashboardReviews", {
        **numbers("average_rating"), **counters("total_reviews"),
        "rating_distribution": serializers.DictField(child=serializers.IntegerField()),
        "recent_reviews": section("SellerDashboardReview", review_fields(), many=True),
    })
    top_products = section("SellerDashboardTopProduct", top_product_fields(), many=True)
    recent_orders = section("SellerDashboardRecentOrder", {
        **recent_order_fields(),
        "order_status": serializers.ChoiceField(choices=Order.Status.choices),
        **strings("seller_subtotal"), **numbers("seller_total"),
        "shipment": ShipmentSerializer(allow_null=True),
    }, many=True)
    recent_stock_movements = section("SellerDashboardStockMovement", stock_movement_fields(), many=True)
    monthly_sales = section("SellerDashboardMonthlySale", {
        "month": serializers.CharField(allow_null=True),
        **numbers("revenue"), **counters("units_sold", "orders_count"),
    }, many=True)
    complaints = section("SellerDashboardComplaints", {
        **counters("total_complaints", "open_complaints", "in_review_complaints", "resolved_complaints"),
        "recent_open_complaints": section("SellerDashboardComplaint", complaint_fields(), many=True),
    })
    returns = section("SellerDashboardReturns", {
        **counters("total_returns", "requested_returns", "in_review_returns", "approved_returns", "refunded_returns"),
        **numbers("total_requested_amount", "total_approved_amount"),
        "recent_requested_returns": section("SellerDashboardReturn", return_fields(), many=True),
    })
