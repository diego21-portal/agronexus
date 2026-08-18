from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from apps.carts.models import Cart
from apps.payments.models import Payment
from apps.products.models import Product, StockMovement
from apps.shipments.models import Shipment, ShipmentEvent
from apps.users.models import Address

from .models import Order, OrderItem


class OrderItemSerializer(serializers.ModelSerializer):
    seller_name = serializers.CharField(source="seller.business_name", read_only=True)

    class Meta:
        model = OrderItem
        fields = (
            "id",
            "product",
            "seller",
            "seller_name",
            "product_name",
            "sku",
            "quantity",
            "unit_price",
            "total_price",
        )


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    payment = serializers.SerializerMethodField()
    shipment = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = (
            "id",
            "order_number",
            "status",
            "subtotal",
            "discount_total",
            "shipping_cost",
            "total",
            "items",
            "payment",
            "shipment",
            "created_at",
            "updated_at",
        )

    def get_payment(self, obj):
        from apps.payments.serializers import PaymentSerializer

        payment = getattr(obj, "payment", None)
        if not payment:
            return None
        return PaymentSerializer(payment).data

    def get_shipment(self, obj):
        from apps.shipments.serializers import ShipmentSerializer

        shipment = getattr(obj, "shipment", None)
        if not shipment:
            return None
        return ShipmentSerializer(shipment).data


class CheckoutSerializer(serializers.Serializer):
    address_id = serializers.IntegerField()
    payment_method = serializers.ChoiceField(
        choices=Payment.PaymentMethod.choices,
    )

    def validate(self, attrs):
        request = self.context["request"]
        user = request.user

        address = Address.objects.filter(
            id=attrs["address_id"],
            user=user,
            is_active=True,
        ).first()

        if not address:
            raise serializers.ValidationError(
                {"address_id": "La dirección seleccionada no existe o no te pertenece."}
            )

        cart = (
            Cart.objects.filter(
                user=user,
                status=Cart.Status.ACTIVE,
            )
            .prefetch_related("items__product")
            .first()
        )

        if not cart or not cart.items.exists():
            raise serializers.ValidationError(
                {"cart": "No tienes productos en el carrito."}
            )

        for item in cart.items.all():
            product = item.product

            if not product.is_active:
                raise serializers.ValidationError(
                    {"cart": f"El producto {product.name} no está activo."}
                )

            if product.status != Product.Status.PUBLISHED:
                raise serializers.ValidationError(
                    {"cart": f"El producto {product.name} ya no está publicado."}
                )

            if item.quantity > product.stock:
                raise serializers.ValidationError(
                    {
                        "cart": (
                            f"No hay stock suficiente para {product.name}. "
                            f"Disponible: {product.stock}."
                        )
                    }
                )

        attrs["address"] = address
        attrs["cart"] = cart

        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        user = request.user
        address = validated_data["address"]
        cart = validated_data["cart"]
        payment_method = validated_data["payment_method"]

        with transaction.atomic():
            cart = (
                Cart.objects.select_for_update()
                .prefetch_related("items__product__seller")
                .get(pk=cart.pk)
            )

            items = list(cart.items.select_related("product__seller").all())

            product_ids = [item.product_id for item in items]
            products = {
                product.id: product
                for product in Product.objects.select_for_update().filter(id__in=product_ids)
            }

            subtotal = Decimal("0.00")

            for item in items:
                product = products[item.product_id]

                if item.quantity > product.stock:
                    raise serializers.ValidationError(
                        {
                            "cart": (
                                f"No hay stock suficiente para {product.name}. "
                                f"Disponible: {product.stock}."
                            )
                        }
                    )

                subtotal += product.current_price * item.quantity

            discount_total = Decimal("0.00")
            shipping_cost = Decimal("0.00")
            total = subtotal - discount_total + shipping_cost

            order = Order.objects.create(
                user=user,
                shipping_address=address,
                status=Order.Status.PAID,
                subtotal=subtotal,
                discount_total=discount_total,
                shipping_cost=shipping_cost,
                total=total,
            )

            for item in items:
                product = products[item.product_id]
                unit_price = product.current_price
                total_price = unit_price * item.quantity

                OrderItem.objects.create(
                    order=order,
                    product=product,
                    seller=product.seller,
                    product_name=product.name,
                    sku=product.sku,
                    quantity=item.quantity,
                    unit_price=unit_price,
                    total_price=total_price,
                )

                previous_stock = product.stock
                new_stock = previous_stock - item.quantity

                product.stock = new_stock

                if product.stock == 0:
                    product.status = Product.Status.OUT_OF_STOCK

                product.save(update_fields=["stock", "status", "updated_at"])

                from apps.notifications.models import Notification
                from apps.notifications.services import create_notification

                if product.stock == 0:
                    create_notification(
                        user=product.seller.user,
                        title="Producto agotado",
                        message=f"El producto {product.name} quedó sin stock luego de una venta.",
                        notification_type=Notification.NotificationType.PRODUCT_OUT_OF_STOCK,
                        related_object_type="Product",
                        related_object_id=product.id,
                        action_url=f"/seller/products/{product.id}",
                    )
                elif product.minimum_stock > 0 and product.stock <= product.minimum_stock:
                    create_notification(
                        user=product.seller.user,
                        title="Stock bajo",
                        message=f"El producto {product.name} quedó por debajo del stock mínimo luego de una venta.",
                        notification_type=Notification.NotificationType.STOCK_LOW,
                        related_object_type="Product",
                        related_object_id=product.id,
                        action_url=f"/seller/products/{product.id}",
                    )                

                StockMovement.objects.create(
                    product=product,
                    movement_type=StockMovement.MovementType.SALE,
                    quantity=-item.quantity,
                    previous_stock=previous_stock,
                    new_stock=new_stock,
                    reason=f"Venta generada por orden {order.order_number}.",
                    created_by=user,
                )

            payment = Payment.objects.create(
                order=order,
                payment_method=payment_method,
                status=Payment.Status.PENDING,
                amount=total,
            )
            payment.approve()

            shipment = Shipment.objects.create(
                order=order,
                status=Shipment.Status.CREATED,
            )

            ShipmentEvent.objects.create(
                shipment=shipment,
                status=Shipment.Status.CREATED,
                description="La compra fue registrada y el envío fue creado.",
                location=address.city,
                created_by=user,
            )

            cart.status = Cart.Status.ORDERED
            cart.save(update_fields=["status", "updated_at"])

            from apps.notifications.models import Notification
            from apps.notifications.services import create_notification

            create_notification(
                user=user,
                title="Compra confirmada",
                message=f"Tu compra {order.order_number} fue confirmada correctamente.",
                notification_type=Notification.NotificationType.ORDER_CREATED,
                related_object_type="Order",
                related_object_id=order.id,
                action_url=f"/orders/{order.id}",
            )

            notified_sellers = set()

            for item in items:
                seller_user = item.product.seller.user

                if seller_user.id in notified_sellers:
                    continue

                create_notification(
                    user=seller_user,
                    title="Nuevo pedido recibido",
                    message=f"Recibiste una nueva venta en la orden {order.order_number}.",
                    notification_type=Notification.NotificationType.ORDER_CREATED,
                    related_object_type="Order",
                    related_object_id=order.id,
                    action_url=f"/seller/orders/{order.id}",
                )

                notified_sellers.add(seller_user.id)            

        return order

    def to_representation(self, instance):
        return OrderSerializer(instance, context=self.context).data

class SellerOrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = (
            "id",
            "product",
            "product_name",
            "sku",
            "quantity",
            "unit_price",
            "total_price",
            "created_at",
        )


class SellerOrderSerializer(serializers.ModelSerializer):
    items = serializers.SerializerMethodField()
    seller_subtotal = serializers.SerializerMethodField()
    customer_email = serializers.CharField(source="user.email", read_only=True)
    payment_status = serializers.CharField(source="payment.status", read_only=True)
    tracking_code = serializers.CharField(
        source="shipment.tracking_code",
        read_only=True,
    )
    shipment_status = serializers.CharField(
        source="shipment.status",
        read_only=True,
    )

    class Meta:
        model = Order
        fields = (
            "id",
            "order_number",
            "customer_email",
            "status",
            "seller_subtotal",
            "payment_status",
            "tracking_code",
            "shipment_status",
            "items",
            "created_at",
            "updated_at",
        )

    def get_items(self, obj):
        seller_profile = self.context["request"].user.seller_profile
        items = obj.items.filter(seller=seller_profile)
        return SellerOrderItemSerializer(items, many=True).data

    def get_seller_subtotal(self, obj):
        seller_profile = self.context["request"].user.seller_profile
        total = sum(
            item.total_price
            for item in obj.items.filter(seller=seller_profile)
        )
        return total


class SellerOrderStatusUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = (
            "status",
        )

    def validate_status(self, value):
        allowed_statuses = [
            Order.Status.PREPARING,
            Order.Status.SHIPPED,
            Order.Status.PROBLEM,
            Order.Status.CANCELLED,
        ]

        if value not in allowed_statuses:
            raise serializers.ValidationError(
                "El vendedor solo puede cambiar el pedido a PREPARING, SHIPPED, PROBLEM o CANCELLED."
            )

        if self.instance.status == Order.Status.DELIVERED:
            raise serializers.ValidationError(
                "No se puede modificar una orden ya entregada."
            )

        if self.instance.status == Order.Status.CANCELLED:
            raise serializers.ValidationError(
                "No se puede modificar una orden cancelada."
            )

        return value