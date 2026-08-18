from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db.models import Avg, Count, F, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.complaints.models import Complaint, ReturnRequest

from apps.orders.models import Order, OrderItem
from apps.payments.models import Payment
from apps.products.models import Product, StockMovement
from apps.questions.models import ProductQuestion
from apps.reviews.models import ProductReview
from apps.sellers.models import SellerProfile
from apps.shipments.models import Shipment

from .permissions import IsPlatformAdmin


User = get_user_model()


class AdminDashboardView(APIView):
    permission_classes = [IsPlatformAdmin]

    def get(self, request):
        valid_sales_statuses = [
            Order.Status.PAID,
            Order.Status.PREPARING,
            Order.Status.SHIPPED,
            Order.Status.DELIVERED,
        ]

        data = {
            "users": self.get_users_summary(),
            "sellers": self.get_sellers_summary(),
            "products": self.get_products_summary(),
            "orders": self.get_orders_summary(valid_sales_statuses),
            "sales": self.get_sales_summary(valid_sales_statuses),
            "payments": self.get_payments_summary(),
            "shipments": self.get_shipments_summary(),
            "stock": self.get_stock_summary(),
            "questions": self.get_questions_summary(),
            "reviews": self.get_reviews_summary(),
            "top_products": self.get_top_products(valid_sales_statuses),
            "top_sellers": self.get_top_sellers(valid_sales_statuses),
            "recent_orders": self.get_recent_orders(),
            "recent_stock_movements": self.get_recent_stock_movements(),
            "monthly_sales": self.get_monthly_sales(valid_sales_statuses),
            "complaints": self.get_complaints_summary(),
            "returns": self.get_returns_summary(),
        }

        return Response(data)

    def get_users_summary(self):
        thirty_days_ago = timezone.now() - timedelta(days=30)

        return {
            "total_users": User.objects.count(),
            "active_users": User.objects.filter(is_active=True).count(),
            "inactive_users": User.objects.filter(is_active=False).count(),
            "staff_users": User.objects.filter(is_staff=True).count(),
            "superusers": User.objects.filter(is_superuser=True).count(),
            "customers": User.objects.filter(role="CUSTOMER").count(),
            "sellers": User.objects.filter(role="SELLER").count(),
            "logistics_operators": User.objects.filter(
                role="LOGISTICS_OPERATOR"
            ).count(),
            "admins": User.objects.filter(role="ADMIN").count(),
            "superadmins": User.objects.filter(role="SUPERADMIN").count(),
            "new_users_last_30_days": User.objects.filter(
                date_joined__gte=thirty_days_ago
            ).count(),
        }

    def get_sellers_summary(self):
        return {
            "total_sellers": SellerProfile.objects.count(),
            "active_sellers": SellerProfile.objects.filter(is_active=True).count(),
            "inactive_sellers": SellerProfile.objects.filter(is_active=False).count(),
            "verified_sellers": SellerProfile.objects.filter(is_verified=True).count(),
            "unverified_sellers": SellerProfile.objects.filter(
                is_verified=False
            ).count(),
        }

    def get_products_summary(self):
        products = Product.objects.all()

        low_stock_count = (
            products.filter(
                is_active=True,
                stock__lte=F("minimum_stock"),
            )
            .exclude(minimum_stock=0)
            .count()
        )

        return {
            "total_products": products.count(),
            "active_products": products.filter(is_active=True).count(),
            "inactive_products": products.filter(is_active=False).count(),
            "published_products": products.filter(
                status=Product.Status.PUBLISHED,
                is_active=True,
            ).count(),
            "draft_products": products.filter(status=Product.Status.DRAFT).count(),
            "paused_products": products.filter(status=Product.Status.PAUSED).count(),
            "out_of_stock_products": products.filter(
                status=Product.Status.OUT_OF_STOCK,
            ).count(),
            "archived_products": products.filter(
                status=Product.Status.ARCHIVED,
            ).count(),
            "featured_products": products.filter(
                is_featured=True,
                is_active=True,
            ).count(),
            "low_stock_products": low_stock_count,
        }

    def get_orders_summary(self, valid_sales_statuses):
        orders = Order.objects.all()

        return {
            "total_orders": orders.count(),
            "pending_orders": orders.filter(status=Order.Status.PENDING).count(),
            "confirmed_orders": orders.filter(status=Order.Status.CONFIRMED).count(),
            "paid_orders": orders.filter(status=Order.Status.PAID).count(),
            "preparing_orders": orders.filter(status=Order.Status.PREPARING).count(),
            "shipped_orders": orders.filter(status=Order.Status.SHIPPED).count(),
            "delivered_orders": orders.filter(status=Order.Status.DELIVERED).count(),
            "cancelled_orders": orders.filter(status=Order.Status.CANCELLED).count(),
            "problem_orders": orders.filter(status=Order.Status.PROBLEM).count(),
            "valid_sales_orders": orders.filter(
                status__in=valid_sales_statuses,
            ).count(),
        }

    def get_sales_summary(self, valid_sales_statuses):
        valid_orders = Order.objects.filter(status__in=valid_sales_statuses)

        total_revenue = valid_orders.aggregate(
            total=Sum("total"),
        )["total"] or Decimal("0.00")

        total_units_sold = OrderItem.objects.filter(
            order__status__in=valid_sales_statuses,
        ).aggregate(
            total=Sum("quantity"),
        )["total"] or 0

        total_orders = valid_orders.count()

        average_order_value = Decimal("0.00")

        if total_orders > 0:
            average_order_value = total_revenue / total_orders

        today = timezone.now().date()
        thirty_days_ago = timezone.now() - timedelta(days=30)

        revenue_last_30_days = valid_orders.filter(
            created_at__gte=thirty_days_ago,
        ).aggregate(
            total=Sum("total"),
        )["total"] or Decimal("0.00")

        orders_last_30_days = valid_orders.filter(
            created_at__gte=thirty_days_ago,
        ).count()

        revenue_today = valid_orders.filter(
            created_at__date=today,
        ).aggregate(
            total=Sum("total"),
        )["total"] or Decimal("0.00")

        orders_today = valid_orders.filter(
            created_at__date=today,
        ).count()

        return {
            "total_revenue": total_revenue,
            "total_orders": total_orders,
            "total_units_sold": total_units_sold,
            "average_order_value": round(average_order_value, 2),
            "revenue_last_30_days": revenue_last_30_days,
            "orders_last_30_days": orders_last_30_days,
            "revenue_today": revenue_today,
            "orders_today": orders_today,
        }

    def get_payments_summary(self):
        payments = Payment.objects.all()

        by_status = {
            "pending": payments.filter(status=Payment.Status.PENDING).count(),
            "approved": payments.filter(status=Payment.Status.APPROVED).count(),
            "rejected": payments.filter(status=Payment.Status.REJECTED).count(),
            "cancelled": payments.filter(status=Payment.Status.CANCELLED).count(),
            "refunded": payments.filter(status=Payment.Status.REFUNDED).count(),
        }

        by_method = {}

        for item in payments.values("payment_method").annotate(total=Count("id")):
            by_method[item["payment_method"]] = item["total"]

        approved_amount = payments.filter(
            status=Payment.Status.APPROVED,
        ).aggregate(
            total=Sum("amount"),
        )["total"] or Decimal("0.00")

        return {
            "total_payments": payments.count(),
            "approved_amount": approved_amount,
            "by_status": by_status,
            "by_method": by_method,
        }

    def get_shipments_summary(self):
        shipments = Shipment.objects.all()

        by_status = {}

        for item in shipments.values("status").annotate(total=Count("id")):
            by_status[item["status"]] = item["total"]

        return {
            "total_shipments": shipments.count(),
            "created_shipments": shipments.filter(
                status=Shipment.Status.CREATED,
            ).count(),
            "in_transit_shipments": shipments.filter(
                status=Shipment.Status.IN_TRANSIT,
            ).count(),
            "delivered_shipments": shipments.filter(
                status=Shipment.Status.DELIVERED,
            ).count(),
            "problem_shipments": shipments.filter(
                status=Shipment.Status.DELIVERY_PROBLEM,
            ).count(),
            "cancelled_shipments": shipments.filter(
                status=Shipment.Status.CANCELLED,
            ).count(),
            "by_status": by_status,
        }

    def get_stock_summary(self):
        products = Product.objects.filter(is_active=True)

        low_stock_products = (
            products.filter(
                stock__lte=F("minimum_stock"),
            )
            .exclude(minimum_stock=0)
            .select_related(
                "seller",
                "category",
                "brand",
            )
            .order_by("stock")[:10]
        )

        out_of_stock_products = (
            products.filter(stock=0)
            .select_related(
                "seller",
                "category",
                "brand",
            )
            .order_by("-updated_at")[:10]
        )

        return {
            "low_stock_count": products.filter(
                stock__lte=F("minimum_stock"),
            )
            .exclude(minimum_stock=0)
            .count(),
            "out_of_stock_count": products.filter(stock=0).count(),
            "low_stock_products": [
                {
                    "id": product.id,
                    "name": product.name,
                    "sku": product.sku,
                    "seller": product.seller.business_name,
                    "category": product.category.name,
                    "brand": product.brand.name if product.brand else None,
                    "stock": product.stock,
                    "minimum_stock": product.minimum_stock,
                    "status": product.status,
                }
                for product in low_stock_products
            ],
            "out_of_stock_products": [
                {
                    "id": product.id,
                    "name": product.name,
                    "sku": product.sku,
                    "seller": product.seller.business_name,
                    "category": product.category.name,
                    "brand": product.brand.name if product.brand else None,
                    "status": product.status,
                    "updated_at": product.updated_at,
                }
                for product in out_of_stock_products
            ],
        }

    def get_questions_summary(self):
        questions = ProductQuestion.objects.all()

        pending_questions = questions.filter(
            status=ProductQuestion.Status.PENDING,
        ).select_related(
            "product",
            "user",
            "product__seller",
        ).order_by("-created_at")[:10]

        return {
            "total_questions": questions.count(),
            "pending_questions": questions.filter(
                status=ProductQuestion.Status.PENDING,
            ).count(),
            "answered_questions": questions.filter(
                status=ProductQuestion.Status.ANSWERED,
            ).count(),
            "hidden_questions": questions.filter(
                status=ProductQuestion.Status.HIDDEN,
            ).count(),
            "recent_pending_questions": [
                {
                    "id": question.id,
                    "product_id": question.product_id,
                    "product_name": question.product.name,
                    "seller": question.product.seller.business_name,
                    "user_email": question.user.email,
                    "question": question.question,
                    "created_at": question.created_at,
                }
                for question in pending_questions
            ],
        }

    def get_reviews_summary(self):
        reviews = ProductReview.objects.filter(is_public=True)

        stats = reviews.aggregate(
            average_rating=Avg("rating"),
            total_reviews=Count("id"),
        )

        average_rating = stats["average_rating"] or 0
        total_reviews = stats["total_reviews"] or 0

        recent_reviews = reviews.select_related(
            "product",
            "user",
            "product__seller",
        ).order_by("-created_at")[:10]

        return {
            "average_rating": round(average_rating, 2),
            "total_reviews": total_reviews,
            "rating_distribution": {
                "5": reviews.filter(rating=5).count(),
                "4": reviews.filter(rating=4).count(),
                "3": reviews.filter(rating=3).count(),
                "2": reviews.filter(rating=2).count(),
                "1": reviews.filter(rating=1).count(),
            },
            "recent_reviews": [
                {
                    "id": review.id,
                    "product_id": review.product_id,
                    "product_name": review.product.name,
                    "seller": review.product.seller.business_name,
                    "user_email": review.user.email,
                    "rating": review.rating,
                    "comment": review.comment,
                    "created_at": review.created_at,
                }
                for review in recent_reviews
            ],
        }

    def get_top_products(self, valid_sales_statuses):
        top_products = (
            OrderItem.objects.filter(
                order__status__in=valid_sales_statuses,
            )
            .values(
                "product_id",
                "product_name",
                "sku",
                "seller__business_name",
            )
            .annotate(
                units_sold=Sum("quantity"),
                revenue=Sum("total_price"),
            )
            .order_by("-units_sold")[:10]
        )

        return [
            {
                "product_id": item["product_id"],
                "product_name": item["product_name"],
                "sku": item["sku"],
                "seller": item["seller__business_name"],
                "units_sold": item["units_sold"],
                "revenue": item["revenue"],
            }
            for item in top_products
        ]

    def get_top_sellers(self, valid_sales_statuses):
        top_sellers = (
            OrderItem.objects.filter(
                order__status__in=valid_sales_statuses,
            )
            .values(
                "seller_id",
                "seller__business_name",
            )
            .annotate(
                orders_count=Count("order", distinct=True),
                units_sold=Sum("quantity"),
                revenue=Sum("total_price"),
            )
            .order_by("-revenue")[:10]
        )

        return [
            {
                "seller_id": item["seller_id"],
                "seller": item["seller__business_name"],
                "orders_count": item["orders_count"],
                "units_sold": item["units_sold"],
                "revenue": item["revenue"],
            }
            for item in top_sellers
        ]

    def get_recent_orders(self):
        recent_orders = (
            Order.objects.select_related(
                "user",
                "payment",
                "shipment",
            )
            .prefetch_related(
                "items",
            )
            .order_by("-created_at")[:10]
        )

        data = []

        for order in recent_orders:
            payment_status = None
            shipment_status = None
            tracking_code = None

            if hasattr(order, "payment"):
                payment_status = order.payment.status

            if hasattr(order, "shipment"):
                shipment_status = order.shipment.status
                tracking_code = order.shipment.tracking_code

            data.append(
                {
                    "id": order.id,
                    "order_number": order.order_number,
                    "customer_email": order.user.email,
                    "status": order.status,
                    "subtotal": order.subtotal,
                    "shipping_cost": order.shipping_cost,
                    "total": order.total,
                    "items_count": order.items.count(),
                    "payment_status": payment_status,
                    "shipment_status": shipment_status,
                    "tracking_code": tracking_code,
                    "created_at": order.created_at,
                }
            )

        return data

    def get_recent_stock_movements(self):
        movements = (
            StockMovement.objects.select_related(
                "product",
                "product__seller",
                "created_by",
            )
            .order_by("-created_at")[:10]
        )

        return [
            {
                "id": movement.id,
                "product_id": movement.product_id,
                "product_name": movement.product.name,
                "product_sku": movement.product.sku,
                "seller": movement.product.seller.business_name,
                "movement_type": movement.movement_type,
                "quantity": movement.quantity,
                "previous_stock": movement.previous_stock,
                "new_stock": movement.new_stock,
                "reason": movement.reason,
                "created_by_email": (
                    movement.created_by.email if movement.created_by else None
                ),
                "created_at": movement.created_at,
            }
            for movement in movements
        ]

    def get_monthly_sales(self, valid_sales_statuses):
        start_date = timezone.now() - timedelta(days=180)

        monthly_sales = (
            Order.objects.filter(
                status__in=valid_sales_statuses,
                created_at__gte=start_date,
            )
            .annotate(
                month=TruncMonth("created_at"),
            )
            .values("month")
            .annotate(
                revenue=Sum("total"),
                orders_count=Count("id"),
            )
            .order_by("month")
        )

        return [
            {
                "month": item["month"].strftime("%Y-%m") if item["month"] else None,
                "revenue": item["revenue"],
                "orders_count": item["orders_count"],
            }
            for item in monthly_sales
        ]

    def get_complaints_summary(self):
        complaints = Complaint.objects.all()

        recent_open_complaints = (complaints.filter(status=Complaint.Status.OPEN).select_related(
            "order",
            "user",
            "order_item",
            "order_item__seller",
        ).order_by("-created_at")[:10])

        return {
            "total_complaints": complaints.count(),
            "open_complaints": complaints.filter(status=Complaint.Status.OPEN).count(),
            "in_review_complaints": complaints.filter(status=Complaint.Status.IN_REVIEW).count(),
            "waiting_customer_complaints": complaints.filter(status=Complaint.Status.WAITING_CUSTOMER).count(),
            "resolved_complaints": complaints.filter(status=Complaint.Status.RESOLVED).count(),
            "rejected_complaints": complaints.filter(status=Complaint.Status.REJECTED).count(),
            "recent_open_complaints": [
                {
                    "id": complaint.id,
                    "order_number": complaint.order.order_number,
                    "user_email": complaint.user.email,
                    "order_item_id": complaint.order_item.id,
                    "seller": (
                        complaint.order_item.seller.business_name
                        if complaint.order_item.seller
                        else None
                    ),
                    "complaint_type":complaint.complaint_type,
                    "title": complaint.title,
                    "created_at": complaint.created_at,
                }
                for complaint in recent_open_complaints
            ],
        }

    def get_returns_summary(self):
        returns = ReturnRequest.objects.all()

        recent_requested_returns = (
            returns.filter(status=ReturnRequest.Status.REQUESTED)
            .select_related(
                "order_item",
                "order_item__order",
                "order_item__seller",
                "user",
            )
            .order_by("-created_at")[:10]
        )

        total_requested_amount = returns.aggregate(
            total=Sum("requested_refund_amount")
        )["total"] or Decimal("0.00")

        total_approved_amount = returns.aggregate(
            total=Sum("approved_refund_amount")
        )["total"] or Decimal("0.00")

        return {
            "total_returns": returns.count(),
            "requested_returns": returns.filter(
                status=ReturnRequest.Status.REQUESTED,
            ).count(),
            "in_review_returns": returns.filter(
                status=ReturnRequest.Status.IN_REVIEW,
            ).count(),
            "approved_returns": returns.filter(
                status=ReturnRequest.Status.APPROVED,
            ).count(),
            "rejected_returns": returns.filter(
                status=ReturnRequest.Status.REJECTED,
            ).count(),
            "product_received_returns": returns.filter(
                status=ReturnRequest.Status.PRODUCT_RECEIVED,
            ).count(),
            "refunded_returns": returns.filter(
                status=ReturnRequest.Status.REFUNDED,
            ).count(),
            "closed_returns": returns.filter(
                status=ReturnRequest.Status.CLOSED,
            ).count(),
            "total_requested_amount": total_requested_amount,
            "total_approved_amount": total_approved_amount,
            "recent_requested_returns": [
                {
                    "id": return_request.id,
                    "order_number": return_request.order_item.order.order_number,
                    "product_name": return_request.order_item.product_name,
                    "seller": return_request.order_item.seller.business_name,
                    "user_email": return_request.user.email,
                    "reason": return_request.reason,
                    "quantity": return_request.quantity,
                    "requested_refund_amount": return_request.requested_refund_amount,
                    "created_at": return_request.created_at,
                }
                for return_request in recent_requested_returns
            ],
        }    
