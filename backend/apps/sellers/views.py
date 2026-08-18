from datetime import timedelta
from decimal import Decimal

from django.db.models import Avg, Count, Q, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.orders.models import Order, OrderItem
from apps.products.models import Product, StockMovement
from apps.products.permissions import IsActiveSeller
from apps.questions.models import ProductQuestion
from apps.reviews.models import ProductReview

from apps.complaints.models import Complaint, ReturnRequest

from .serializers import SellerProfileSummarySerializer


class SellerDashboardView(APIView):
    permission_classes = [IsAuthenticated, IsActiveSeller]

    def get(self, request):
        seller_profile = request.user.seller_profile

        products_queryset = Product.objects.filter(
            seller=seller_profile,
        )

        active_products_queryset = products_queryset.filter(
            is_active=True,
        )

        seller_order_items_queryset = OrderItem.objects.filter(
            seller=seller_profile,
        ).select_related(
            "order",
            "product",
        )

        valid_sales_statuses = [
            Order.Status.PAID,
            Order.Status.PREPARING,
            Order.Status.SHIPPED,
            Order.Status.DELIVERED,
        ]

        valid_order_items_queryset = seller_order_items_queryset.filter(
            order__status__in=valid_sales_statuses,
        )

        dashboard_data = {
            "seller": self.get_seller_summary(seller_profile),
            "products": self.get_product_summary(products_queryset),
            "sales": self.get_sales_summary(valid_order_items_queryset),
            "orders": self.get_order_summary(seller_profile),
            "stock": self.get_stock_summary(active_products_queryset),
            "questions": self.get_question_summary(seller_profile),
            "reviews": self.get_review_summary(seller_profile),
            "top_products": self.get_top_products(valid_order_items_queryset),
            "recent_orders": self.get_recent_orders(seller_profile),
            "recent_stock_movements": self.get_recent_stock_movements(seller_profile),
            "monthly_sales": self.get_monthly_sales(valid_order_items_queryset),
            "complaints": self.get_complaints_summary(seller_profile),
            "returns": self.get_returns_summary(seller_profile),
        }

        return Response(dashboard_data)

    def get_seller_summary(self, seller_profile):
        return SellerProfileSummarySerializer(seller_profile).data

    def get_product_summary(self, products_queryset):
        total_products = products_queryset.count()

        published_products = products_queryset.filter(
            status=Product.Status.PUBLISHED,
            is_active=True,
        ).count()

        draft_products = products_queryset.filter(
            status=Product.Status.DRAFT,
        ).count()

        paused_products = products_queryset.filter(
            status=Product.Status.PAUSED,
        ).count()

        out_of_stock_products = products_queryset.filter(
            status=Product.Status.OUT_OF_STOCK,
        ).count()

        archived_products = products_queryset.filter(
            status=Product.Status.ARCHIVED,
        ).count()

        featured_products = products_queryset.filter(
            is_featured=True,
            is_active=True,
        ).count()

        low_stock_products = products_queryset.filter(
            is_active=True,
            stock__lte=models_f("minimum_stock"),
        ).exclude(
            minimum_stock=0,
        ).count()

        return {
            "total_products": total_products,
            "published_products": published_products,
            "draft_products": draft_products,
            "paused_products": paused_products,
            "out_of_stock_products": out_of_stock_products,
            "archived_products": archived_products,
            "featured_products": featured_products,
            "low_stock_products": low_stock_products,
        }

    def get_sales_summary(self, valid_order_items_queryset):
        total_revenue = valid_order_items_queryset.aggregate(
            total=Sum("total_price")
        )["total"] or Decimal("0.00")

        total_units_sold = valid_order_items_queryset.aggregate(
            total=Sum("quantity")
        )["total"] or 0

        total_orders = valid_order_items_queryset.values(
            "order_id"
        ).distinct().count()

        average_order_value = Decimal("0.00")

        if total_orders > 0:
            average_order_value = total_revenue / total_orders

        return {
            "total_orders": total_orders,
            "total_units_sold": total_units_sold,
            "total_revenue": total_revenue,
            "average_order_value": round(average_order_value, 2),
        }

    def get_order_summary(self, seller_profile):
        seller_orders_queryset = Order.objects.filter(
            items__seller=seller_profile,
        ).distinct()

        return {
            "total_orders": seller_orders_queryset.count(),
            "paid_orders": seller_orders_queryset.filter(
                status=Order.Status.PAID,
            ).count(),
            "preparing_orders": seller_orders_queryset.filter(
                status=Order.Status.PREPARING,
            ).count(),
            "shipped_orders": seller_orders_queryset.filter(
                status=Order.Status.SHIPPED,
            ).count(),
            "delivered_orders": seller_orders_queryset.filter(
                status=Order.Status.DELIVERED,
            ).count(),
            "cancelled_orders": seller_orders_queryset.filter(
                status=Order.Status.CANCELLED,
            ).count(),
            "problem_orders": seller_orders_queryset.filter(
                status=Order.Status.PROBLEM,
            ).count(),
        }

    def get_stock_summary(self, active_products_queryset):
        out_of_stock = active_products_queryset.filter(
            stock=0,
        ).count()

        low_stock_products = active_products_queryset.filter(
            stock__lte=models_f("minimum_stock"),
        ).exclude(
            minimum_stock=0,
        ).order_by("stock")[:10]

        return {
            "out_of_stock_count": out_of_stock,
            "low_stock_count": low_stock_products.count(),
            "low_stock_products": [
                {
                    "id": product.id,
                    "name": product.name,
                    "sku": product.sku,
                    "stock": product.stock,
                    "minimum_stock": product.minimum_stock,
                    "status": product.status,
                }
                for product in low_stock_products
            ],
        }

    def get_question_summary(self, seller_profile):
        questions_queryset = ProductQuestion.objects.filter(
            product__seller=seller_profile,
        )

        pending_questions = questions_queryset.filter(
            status=ProductQuestion.Status.PENDING,
        )

        answered_questions = questions_queryset.filter(
            status=ProductQuestion.Status.ANSWERED,
        )

        return {
            "total_questions": questions_queryset.count(),
            "pending_questions": pending_questions.count(),
            "answered_questions": answered_questions.count(),
            "recent_pending_questions": [
                {
                    "id": question.id,
                    "product_id": question.product_id,
                    "product_name": question.product.name,
                    "question": question.question,
                    "created_at": question.created_at,
                }
                for question in pending_questions.select_related("product").order_by(
                    "-created_at"
                )[:5]
            ],
        }

    def get_review_summary(self, seller_profile):
        reviews_queryset = ProductReview.objects.filter(
            product__seller=seller_profile,
            is_public=True,
        )

        stats = reviews_queryset.aggregate(
            average_rating=Avg("rating"),
            total_reviews=Count("id"),
        )

        average_rating = stats["average_rating"] or 0
        total_reviews = stats["total_reviews"] or 0

        rating_distribution = {
            "5": reviews_queryset.filter(rating=5).count(),
            "4": reviews_queryset.filter(rating=4).count(),
            "3": reviews_queryset.filter(rating=3).count(),
            "2": reviews_queryset.filter(rating=2).count(),
            "1": reviews_queryset.filter(rating=1).count(),
        }

        recent_reviews = reviews_queryset.select_related(
            "product",
            "user",
        ).order_by("-created_at")[:5]

        return {
            "average_rating": round(average_rating, 2),
            "total_reviews": total_reviews,
            "rating_distribution": rating_distribution,
            "recent_reviews": [
                {
                    "id": review.id,
                    "product_id": review.product_id,
                    "product_name": review.product.name,
                    "user_email": review.user.email,
                    "rating": review.rating,
                    "comment": review.comment,
                    "created_at": review.created_at,
                }
                for review in recent_reviews
            ],
        }

    def get_top_products(self, valid_order_items_queryset):
        top_products = (
            valid_order_items_queryset.values(
                "product_id",
                "product_name",
                "sku",
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
                "units_sold": item["units_sold"],
                "revenue": item["revenue"],
            }
            for item in top_products
        ]

    def get_recent_orders(self, seller_profile):
        recent_orders = (
            Order.objects.filter(
                items__seller=seller_profile,
            )
            .distinct()
            .select_related(
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
            seller_items = order.items.filter(seller=seller_profile)
            seller_total = sum(
                item.total_price for item in seller_items
            )

            data.append(
                {
                    "id": order.id,
                    "order_number": order.order_number,
                    "customer_email": order.user.email,
                    "status": order.status,
                    "seller_total": seller_total,
                    "items_count": seller_items.count(),
                    "payment_status": getattr(order.payment, "status", None),
                    "shipment_status": getattr(order.shipment, "status", None),
                    "tracking_code": getattr(order.shipment, "tracking_code", None),
                    "created_at": order.created_at,
                }
            )

        return data

    def get_recent_stock_movements(self, seller_profile):
        movements = (
            StockMovement.objects.filter(
                product__seller=seller_profile,
            )
            .select_related(
                "product",
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

    def get_monthly_sales(self, valid_order_items_queryset):
        start_date = timezone.now() - timedelta(days=180)

        monthly_sales = (
            valid_order_items_queryset.filter(
                order__created_at__gte=start_date,
            )
            .annotate(
                month=TruncMonth("order__created_at"),
            )
            .values("month")
            .annotate(
                revenue=Sum("total_price"),
                units_sold=Sum("quantity"),
                orders_count=Count("order", distinct=True),
            )
            .order_by("month")
        )

        return [
            {
                "month": item["month"].strftime("%Y-%m") if item["month"] else None,
                "revenue": item["revenue"],
                "units_sold": item["units_sold"],
                "orders_count": item["orders_count"],
            }
            for item in monthly_sales
        ]

    def get_complaints_summary(self, seller_profile):
        complaints = Complaint.objects.filter(
            order__items__seller=seller_profile,
        ).distinct()

        recent_open_complaints = (
            complaints.filter(status=Complaint.Status.OPEN)
            .select_related(
                "order",
                "user",
                "order_item",
            )
            .order_by("-created_at")[:5]
        )

        return {
            "total_complaints": complaints.count(),
            "open_complaints": complaints.filter(
                status=Complaint.Status.OPEN,
            ).count(),
            "in_review_complaints": complaints.filter(
                status=Complaint.Status.IN_REVIEW,
            ).count(),
            "resolved_complaints": complaints.filter(
                status=Complaint.Status.RESOLVED,
            ).count(),
            "recent_open_complaints": [
                {
                    "id": complaint.id,
                    "order_number": complaint.order.order_number,
                    "user_email": complaint.user.email,
                    "complaint_type": complaint.complaint_type,
                    "title": complaint.title,
                    "created_at": complaint.created_at,
                }
                for complaint in recent_open_complaints
            ],
        }

    def get_returns_summary(self, seller_profile):
        returns = ReturnRequest.objects.filter(
            order_item__seller=seller_profile,
        )

        recent_requested_returns = (
            returns.filter(status=ReturnRequest.Status.REQUESTED)
            .select_related(
                "order_item",
                "order_item__order",
                "user",
            )
            .order_by("-created_at")[:5]
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
            "refunded_returns": returns.filter(
                status=ReturnRequest.Status.REFUNDED,
            ).count(),
            "total_requested_amount": total_requested_amount,
            "total_approved_amount": total_approved_amount,
            "recent_requested_returns": [
                {
                    "id": return_request.id,
                    "order_number": return_request.order_item.order.order_number,
                    "product_name": return_request.order_item.product_name,
                    "user_email": return_request.user.email,
                    "reason": return_request.reason,
                    "quantity": return_request.quantity,
                    "requested_refund_amount": return_request.requested_refund_amount,
                    "created_at": return_request.created_at,
                }
                for return_request in recent_requested_returns
            ],
        }        


def models_f(field_name):
    from django.db.models import F

    return F(field_name)