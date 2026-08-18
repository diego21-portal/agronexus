from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.carts.models import Cart, CartItem
from apps.categories.models import Brand, Category
from apps.complaints.models import Complaint, ReturnRequest
from apps.favorites.models import FavoriteProduct
from apps.notifications.models import Notification
from apps.notifications.services import create_notification
from apps.orders.models import Order, OrderItem
from apps.payments.models import Payment
from apps.products.models import Product, StockMovement
from apps.questions.models import ProductQuestion
from apps.regions.models import Region
from apps.reviews.models import ProductReview
from apps.sellers.models import SellerProfile
from apps.shipments.models import Shipment, ShipmentEvent
from apps.users.models import Address, User


DEMO_PASSWORD = "Demo123456"

DEMO_EMAILS = [
    "admin@agronexus.com",
    "cliente@agronexus.com",
    "cliente2@agronexus.com",
    "vendedor@agronexus.com",
]


class Command(BaseCommand):
    help = "Crea datos demo para probar AgroNexus."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Elimina datos demo anteriores antes de crear nuevos datos.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        reset = options["reset"]

        if reset:
            self.stdout.write(self.style.WARNING("Eliminando datos demo anteriores..."))
            self.reset_demo_data()

        self.stdout.write("Creando datos demo de AgroNexus...")

        admin_user = self.create_admin_user()
        customer_user = self.create_customer_user()
        second_customer_user = self.create_second_customer_user()
        seller_user = self.create_seller_user()

        region = self.create_region()
        categories = self.create_categories()
        brands = self.create_brands()

        seller_profile = self.create_seller_profile(seller_user)

        products = self.create_products(
            seller_profile=seller_profile,
            categories=categories,
            brands=brands,
            region=region,
        )

        address = self.create_address(customer_user, region)

        self.create_active_cart(customer_user, products)

        delivered_order = self.create_demo_order(
            order_number="AGX-DEMO-0001",
            user=customer_user,
            address=address,
            status=Order.Status.DELIVERED,
            products=[
                (products["filter"], 2),
                (products["pump"], 1),
            ],
            payment_status=Payment.Status.APPROVED,
            shipment_status=Shipment.Status.DELIVERED,
        )

        paid_order = self.create_demo_order(
            order_number="AGX-DEMO-0002",
            user=customer_user,
            address=address,
            status=Order.Status.PAID,
            products=[
                (products["belt"], 1),
            ],
            payment_status=Payment.Status.APPROVED,
            shipment_status=Shipment.Status.CREATED,
        )

        shipped_order = self.create_demo_order(
            order_number="AGX-DEMO-0003",
            user=second_customer_user,
            address=self.create_address(second_customer_user, region),
            status=Order.Status.SHIPPED,
            products=[
                (products["sensor"], 1),
            ],
            payment_status=Payment.Status.APPROVED,
            shipment_status=Shipment.Status.IN_TRANSIT,
        )

        self.create_stock_movements(customer_user, seller_user, products)
        self.create_questions(customer_user, seller_user, products)
        self.create_favorites(customer_user, products)
        self.create_reviews(customer_user, delivered_order, products)
        self.create_complaints(customer_user, admin_user, delivered_order)
        self.create_returns(customer_user, admin_user, delivered_order)
        self.create_notifications(
            admin_user=admin_user,
            customer_user=customer_user,
            second_customer_user=second_customer_user,
            seller_user=seller_user,
            delivered_order=delivered_order,
            paid_order=paid_order,
            shipped_order=shipped_order,
            products=products,
        )

        self.stdout.write(self.style.SUCCESS("Seed demo creado correctamente."))
        self.print_credentials()

    def reset_demo_data(self):
        Notification.objects.filter(user__email__in=DEMO_EMAILS).delete()

        ReturnRequest.objects.filter(user__email__in=DEMO_EMAILS).delete()
        Complaint.objects.filter(user__email__in=DEMO_EMAILS).delete()

        ProductReview.objects.filter(user__email__in=DEMO_EMAILS).delete()
        ProductQuestion.objects.filter(user__email__in=DEMO_EMAILS).delete()
        FavoriteProduct.objects.filter(user__email__in=DEMO_EMAILS).delete()

        Order.objects.filter(order_number__startswith="AGX-DEMO").delete()

        Cart.objects.filter(user__email__in=DEMO_EMAILS).delete()
        Address.objects.filter(user__email__in=DEMO_EMAILS).delete()

        StockMovement.objects.filter(product__sku__startswith="DEMO-").delete()
        Product.objects.filter(sku__startswith="DEMO-").delete()

        SellerProfile.objects.filter(user__email__in=DEMO_EMAILS).delete()
        User.objects.filter(email__in=DEMO_EMAILS).delete()

        Brand.objects.filter(name__in=["John Deere", "AgroTech", "CampoSur"]).delete()
        Category.objects.filter(
            name__in=["Repuestos", "Maquinaria", "Insumos técnicos"]
        ).delete()
        Region.objects.filter(name="Mendoza").delete()

    def create_admin_user(self):
        user, created = User.objects.update_or_create(
            email="admin@agronexus.com",
            defaults={
                "username": "admin",
                "first_name": "Admin",
                "last_name": "AgroNexus",
                "role": User.Role.SUPER_ADMIN,
                "is_staff": True,
                "is_superuser": True,
                "is_active": True,
            },
        )

        if created:
            user.set_password(DEMO_PASSWORD)
            user.save()

        return user

    def create_customer_user(self):
        user, created = User.objects.update_or_create(
            email="cliente@agronexus.com",
            defaults={
                "username": "cliente",
                "first_name": "Micaela",
                "last_name": "Portal",
                "role": User.Role.CUSTOMER,
                "is_active": True,
            },
        )

        if created:
            user.set_password(DEMO_PASSWORD)
            user.save()

        return user

    def create_second_customer_user(self):
        user, created = User.objects.update_or_create(
            email="cliente2@agronexus.com",
            defaults={
                "username": "cliente2",
                "first_name": "Diego",
                "last_name": "Cliente",
                "role": User.Role.CUSTOMER,
                "is_active": True,
            },
        )

        if created:
            user.set_password(DEMO_PASSWORD)
            user.save()

        return user

    def create_seller_user(self):
        user, created = User.objects.update_or_create(
            email="vendedor@agronexus.com",
            defaults={
                "username": "vendedor",
                "first_name": "Vendedor",
                "last_name": "Mendoza",
                "role": User.Role.SELLER,
                "is_active": True,
            },
        )

        if created:
            user.set_password(DEMO_PASSWORD)
            user.save()

        return user

    def create_region(self):
        region, _ = Region.objects.update_or_create(
            name="Mendoza",
            defaults={
                "province": "Mendoza",
                "country": "Argentina",
                "is_active": True,
            },
        )

        return region

    def create_categories(self):
        repuestos, _ = Category.objects.update_or_create(
            name="Repuestos",
            defaults={
                "description": "Repuestos para maquinaria agrícola.",
                "is_active": True,
            },
        )

        maquinaria, _ = Category.objects.update_or_create(
            name="Maquinaria",
            defaults={
                "description": "Maquinaria agrícola y herramientas de trabajo.",
                "is_active": True,
            },
        )

        insumos, _ = Category.objects.update_or_create(
            name="Insumos técnicos",
            defaults={
                "description": "Insumos técnicos para producción agrícola.",
                "is_active": True,
            },
        )

        return {
            "repuestos": repuestos,
            "maquinaria": maquinaria,
            "insumos": insumos,
        }

    def create_brands(self):
        john_deere, _ = Brand.objects.update_or_create(
            name="John Deere",
            defaults={
                "description": "Marca reconocida de maquinaria agrícola.",
                "is_active": True,
            },
        )

        agrotech, _ = Brand.objects.update_or_create(
            name="AgroTech",
            defaults={
                "description": "Tecnología aplicada al agro.",
                "is_active": True,
            },
        )

        camposur, _ = Brand.objects.update_or_create(
            name="CampoSur",
            defaults={
                "description": "Insumos y repuestos agrícolas.",
                "is_active": True,
            },
        )

        return {
            "john_deere": john_deere,
            "agrotech": agrotech,
            "camposur": camposur,
        }

    def create_seller_profile(self, seller_user):
        seller_profile, _ = SellerProfile.objects.update_or_create(
            user=seller_user,
            defaults={
                "business_name": "Agro Repuestos Mendoza",
                "tax_id": "20-00000000-0",
                "description": (
                    "Proveedor mendocino de repuestos, maquinaria e insumos técnicos "
                    "para el sector agrícola."
                ),
                "is_verified": True,
                "is_active": True,
            },
        )

        return seller_profile

    def create_products(self, seller_profile, categories, brands, region):
        filter_product, _ = Product.objects.update_or_create(
            sku="DEMO-JD-FH-X100",
            defaults={
                "seller": seller_profile,
                "category": categories["repuestos"],
                "brand": brands["john_deere"],
                "region": region,
                "name": "Filtro hidráulico John Deere X100",
                "short_description": "Filtro hidráulico para maquinaria agrícola.",
                "description": (
                    "Filtro hidráulico reforzado para maquinaria John Deere. "
                    "Ideal para mantenimiento preventivo."
                ),
                "technical_description": "Compatible con líneas hidráulicas agrícolas.",
                "price": Decimal("85000.00"),
                "discount_price": Decimal("79000.00"),
                "unit": "unidad",
                "stock": 18,
                "minimum_stock": 5,
                "condition": Product.Condition.NEW,
                "status": Product.Status.PUBLISHED,
                "warranty": "Garantía de 6 meses por falla de fabricación.",
                "shipping_available": True,
                "is_active": True,
                "is_featured": True,
            },
        )

        pump_product, _ = Product.objects.update_or_create(
            sku="DEMO-AGT-BP-200",
            defaults={
                "seller": seller_profile,
                "category": categories["maquinaria"],
                "brand": brands["agrotech"],
                "region": region,
                "name": "Bomba pulverizadora AgroTech 200L",
                "short_description": "Bomba pulverizadora para uso agrícola.",
                "description": (
                    "Bomba pulverizadora de 200 litros para trabajos agrícolas "
                    "de mediana escala."
                ),
                "technical_description": "Capacidad 200L. Estructura reforzada.",
                "price": Decimal("320000.00"),
                "discount_price": None,
                "unit": "unidad",
                "stock": 3,
                "minimum_stock": 5,
                "condition": Product.Condition.NEW,
                "status": Product.Status.PUBLISHED,
                "warranty": "Garantía de 12 meses.",
                "shipping_available": True,
                "is_active": True,
                "is_featured": True,
            },
        )

        belt_product, _ = Product.objects.update_or_create(
            sku="DEMO-CS-COR-AX45",
            defaults={
                "seller": seller_profile,
                "category": categories["repuestos"],
                "brand": brands["camposur"],
                "region": region,
                "name": "Correa agrícola reforzada AX-45",
                "short_description": "Correa reforzada para maquinaria agrícola.",
                "description": "Correa de alta resistencia para transmisión agrícola.",
                "technical_description": "Modelo AX-45 reforzado.",
                "price": Decimal("42000.00"),
                "discount_price": None,
                "unit": "unidad",
                "stock": 0,
                "minimum_stock": 4,
                "condition": Product.Condition.NEW,
                "status": Product.Status.OUT_OF_STOCK,
                "warranty": "Garantía por defecto de fabricación.",
                "shipping_available": True,
                "is_active": True,
                "is_featured": False,
            },
        )

        sensor_product, _ = Product.objects.update_or_create(
            sku="DEMO-AGT-SH-01",
            defaults={
                "seller": seller_profile,
                "category": categories["insumos"],
                "brand": brands["agrotech"],
                "region": region,
                "name": "Sensor de humedad de suelo AgroTech SH-01",
                "short_description": "Sensor para medición de humedad de suelo.",
                "description": (
                    "Sensor técnico para monitoreo de humedad de suelo en cultivos."
                ),
                "technical_description": "Medición digital. Uso agrícola.",
                "price": Decimal("125000.00"),
                "discount_price": Decimal("110000.00"),
                "unit": "unidad",
                "stock": 12,
                "minimum_stock": 3,
                "condition": Product.Condition.NEW,
                "status": Product.Status.PUBLISHED,
                "warranty": "Garantía de 6 meses.",
                "shipping_available": True,
                "is_active": True,
                "is_featured": False,
            },
        )

        draft_product, _ = Product.objects.update_or_create(
            sku="DEMO-CS-FERT-01",
            defaults={
                "seller": seller_profile,
                "category": categories["insumos"],
                "brand": brands["camposur"],
                "region": region,
                "name": "Fertilizante técnico CampoSur 25kg",
                "short_description": "Fertilizante técnico para cultivos.",
                "description": "Producto demo en borrador para probar dashboard.",
                "technical_description": "Presentación 25kg.",
                "price": Decimal("36000.00"),
                "discount_price": None,
                "unit": "bolsa",
                "stock": 25,
                "minimum_stock": 8,
                "condition": Product.Condition.NEW,
                "status": Product.Status.DRAFT,
                "warranty": "",
                "shipping_available": True,
                "is_active": True,
                "is_featured": False,
            },
        )

        return {
            "filter": filter_product,
            "pump": pump_product,
            "belt": belt_product,
            "sensor": sensor_product,
            "draft": draft_product,
        }

    def create_address(self, user, region):
        address, _ = Address.objects.update_or_create(
            user=user,
            street="San Martín",
            number="123",
            defaults={
                "region": region,
                "city": "Luján de Cuyo",
                "province": "Mendoza",
                "postal_code": "5507",
                "reference": "Casa con portón negro.",
                "is_default": True,
                "is_active": True,
            },
        )

        return address

    def create_active_cart(self, customer_user, products):
        cart, _ = Cart.objects.update_or_create(
            user=customer_user,
            status=Cart.Status.ACTIVE,
            defaults={},
        )

        CartItem.objects.update_or_create(
            cart=cart,
            product=products["sensor"],
            defaults={
                "quantity": 1,
                "unit_price": products["sensor"].current_price,
            },
        )

        return cart

    def create_demo_order(
        self,
        order_number,
        user,
        address,
        status,
        products,
        payment_status,
        shipment_status,
    ):
        subtotal = Decimal("0.00")

        for product, quantity in products:
            subtotal += product.current_price * quantity

        shipping_cost = Decimal("5000.00")
        total = subtotal + shipping_cost

        order, _ = Order.objects.update_or_create(
            order_number=order_number,
            defaults={
                "user": user,
                "shipping_address": address,
                "status": status,
                "subtotal": subtotal,
                "discount_total": Decimal("0.00"),
                "shipping_cost": shipping_cost,
                "total": total,
            },
        )

        order.items.all().delete()

        for product, quantity in products:
            unit_price = product.current_price
            total_price = unit_price * quantity

            OrderItem.objects.create(
                order=order,
                product=product,
                seller=product.seller,
                product_name=product.name,
                sku=product.sku,
                quantity=quantity,
                unit_price=unit_price,
                total_price=total_price,
            )

        Payment.objects.update_or_create(
            order=order,
            defaults={
                "payment_method": "SIMULATED_CARD",
                "status": payment_status,
                "amount": total,
                "transaction_code": f"SIM-{order_number}",
                "paid_at": timezone.now(),
            },
        )

        shipment, _ = Shipment.objects.update_or_create(
            order=order,
            defaults={
                "status": shipment_status,
                "carrier": "Logística AgroNexus",
                "estimated_delivery_date": timezone.now().date(),
                "delivered_at": (
                    timezone.now()
                    if shipment_status == Shipment.Status.DELIVERED
                    else None
                ),
            },
        )

        ShipmentEvent.objects.get_or_create(
            shipment=shipment,
            status=shipment_status,
            description=f"Estado demo del envío: {shipment_status}.",
            location="Mendoza",
            defaults={
                "created_by": user,
            },
        )

        return order

    def create_stock_movements(self, customer_user, seller_user, products):
        StockMovement.objects.get_or_create(
            product=products["filter"],
            movement_type=StockMovement.MovementType.SALE,
            reason="Venta demo AGX-DEMO-0001",
            defaults={
                "quantity": -2,
                "previous_stock": 20,
                "new_stock": 18,
                "created_by": customer_user,
            },
        )

        StockMovement.objects.get_or_create(
            product=products["pump"],
            movement_type=StockMovement.MovementType.MANUAL_ADJUSTMENT,
            reason="Ajuste manual demo para stock bajo.",
            defaults={
                "quantity": -2,
                "previous_stock": 5,
                "new_stock": 3,
                "created_by": seller_user,
            },
        )

        StockMovement.objects.get_or_create(
            product=products["belt"],
            movement_type=StockMovement.MovementType.MANUAL_ADJUSTMENT,
            reason="Producto demo agotado.",
            defaults={
                "quantity": -4,
                "previous_stock": 4,
                "new_stock": 0,
                "created_by": seller_user,
            },
        )

    def create_questions(self, customer_user, seller_user, products):
        ProductQuestion.objects.update_or_create(
            product=products["filter"],
            user=customer_user,
            question="¿Este filtro sirve para maquinaria John Deere serie 5000?",
            defaults={
                "answer": (
                    "Sí, sirve para maquinaria John Deere serie 5000, "
                    "pero recomendamos verificar el código original."
                ),
                "answered_by": seller_user,
                "answered_at": timezone.now(),
                "status": ProductQuestion.Status.ANSWERED,
                "is_public": True,
            },
        )

        ProductQuestion.objects.update_or_create(
            product=products["pump"],
            user=customer_user,
            question="¿La bomba incluye manguera y accesorios?",
            defaults={
                "answer": "",
                "answered_by": None,
                "answered_at": None,
                "status": ProductQuestion.Status.PENDING,
                "is_public": True,
            },
        )

    def create_favorites(self, customer_user, products):
        FavoriteProduct.objects.get_or_create(
            user=customer_user,
            product=products["filter"],
        )

        FavoriteProduct.objects.get_or_create(
            user=customer_user,
            product=products["sensor"],
        )

    def create_reviews(self, customer_user, delivered_order, products):
        filter_item = delivered_order.items.filter(product=products["filter"]).first()

        if filter_item:
            ProductReview.objects.update_or_create(
                order_item=filter_item,
                defaults={
                    "product": products["filter"],
                    "user": customer_user,
                    "rating": 5,
                    "comment": "Excelente producto. Llegó en buen estado y funcionó correctamente.",
                    "is_public": True,
                },
            )

    def create_complaints(self, customer_user, admin_user, delivered_order):
        order_item = delivered_order.items.first()

        Complaint.objects.update_or_create(
            user=customer_user,
            order=delivered_order,
            title="Consulta por producto recibido",
            defaults={
                "order_item": order_item,
                "complaint_type": Complaint.ComplaintType.PRODUCT_PROBLEM,
                "description": (
                    "El producto llegó correctamente, pero solicito revisión "
                    "por una duda técnica."
                ),
                "status": Complaint.Status.RESOLVED,
                "admin_note": "Reclamo demo revisado.",
                "resolution": "Se contactó al vendedor y se brindó respuesta técnica.",
                "resolved_by": admin_user,
                "resolved_at": timezone.now(),
            },
        )

    def create_returns(self, customer_user, admin_user, delivered_order):
        return_item = delivered_order.items.exclude(product__sku="DEMO-JD-FH-X100").first()

        if return_item:
            ReturnRequest.objects.update_or_create(
                order_item=return_item,
                defaults={
                    "user": customer_user,
                    "reason": ReturnRequest.Reason.DEFECTIVE_PRODUCT,
                    "description": "Solicitud demo de devolución por falla del producto.",
                    "quantity": 1,
                    "requested_refund_amount": return_item.unit_price,
                    "approved_refund_amount": return_item.unit_price,
                    "status": ReturnRequest.Status.APPROVED,
                    "admin_note": "Devolución demo aprobada.",
                    "resolution": "El cliente debe enviar el producto para completar el proceso.",
                    "resolved_by": admin_user,
                    "resolved_at": timezone.now(),
                },
            )

    def create_notifications(
        self,
        admin_user,
        customer_user,
        second_customer_user,
        seller_user,
        delivered_order,
        paid_order,
        shipped_order,
        products,
    ):
        Notification.objects.filter(user__email__in=DEMO_EMAILS).delete()

        create_notification(
            user=customer_user,
            title="Compra confirmada",
            message=f"Tu compra {delivered_order.order_number} fue confirmada correctamente.",
            notification_type=Notification.NotificationType.ORDER_CREATED,
            related_object_type="Order",
            related_object_id=delivered_order.id,
            action_url=f"/orders/{delivered_order.id}",
        )

        create_notification(
            user=seller_user,
            title="Nuevo pedido recibido",
            message=f"Recibiste una nueva venta en la orden {paid_order.order_number}.",
            notification_type=Notification.NotificationType.ORDER_CREATED,
            related_object_type="Order",
            related_object_id=paid_order.id,
            action_url=f"/seller/orders/{paid_order.id}",
        )

        create_notification(
            user=second_customer_user,
            title="Actualización de envío",
            message=f"El envío de tu orden {shipped_order.order_number} está en tránsito.",
            notification_type=Notification.NotificationType.SHIPMENT_UPDATED,
            related_object_type="Shipment",
            related_object_id=shipped_order.shipment.id,
            action_url=f"/orders/{shipped_order.id}/tracking",
        )

        create_notification(
            user=seller_user,
            title="Nueva pregunta recibida",
            message=f"Recibiste una pregunta sobre {products['pump'].name}.",
            notification_type=Notification.NotificationType.QUESTION_CREATED,
            related_object_type="Product",
            related_object_id=products["pump"].id,
            action_url="/seller/questions/",
        )

        create_notification(
            user=customer_user,
            title="Tu pregunta fue respondida",
            message=f"El vendedor respondió tu pregunta sobre {products['filter'].name}.",
            notification_type=Notification.NotificationType.QUESTION_ANSWERED,
            related_object_type="Product",
            related_object_id=products["filter"].id,
            action_url=f"/products/{products['filter'].slug}",
        )

        create_notification(
            user=admin_user,
            title="Reclamo demo resuelto",
            message="Existe un reclamo demo resuelto en la plataforma.",
            notification_type=Notification.NotificationType.COMPLAINT_RESOLVED,
            related_object_type="Order",
            related_object_id=delivered_order.id,
            action_url="/admin/complaints/",
        )

        create_notification(
            user=seller_user,
            title="Stock bajo",
            message=f"El producto {products['pump'].name} está por debajo del stock mínimo.",
            notification_type=Notification.NotificationType.STOCK_LOW,
            related_object_type="Product",
            related_object_id=products["pump"].id,
            action_url=f"/seller/products/{products['pump'].id}",
        )

        create_notification(
            user=seller_user,
            title="Producto agotado",
            message=f"El producto {products['belt'].name} quedó sin stock.",
            notification_type=Notification.NotificationType.PRODUCT_OUT_OF_STOCK,
            related_object_type="Product",
            related_object_id=products["belt"].id,
            action_url=f"/seller/products/{products['belt'].id}",
        )

    def print_credentials(self):
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("Usuarios demo creados:"))
        self.stdout.write("")
        self.stdout.write("Admin:")
        self.stdout.write("  email: admin@agronexus.com")
        self.stdout.write(f"  password: {DEMO_PASSWORD}")
        self.stdout.write("")
        self.stdout.write("Cliente:")
        self.stdout.write("  email: cliente@agronexus.com")
        self.stdout.write(f"  password: {DEMO_PASSWORD}")
        self.stdout.write("")
        self.stdout.write("Cliente 2:")
        self.stdout.write("  email: cliente2@agronexus.com")
        self.stdout.write(f"  password: {DEMO_PASSWORD}")
        self.stdout.write("")
        self.stdout.write("Vendedor:")
        self.stdout.write("  email: vendedor@agronexus.com")
        self.stdout.write(f"  password: {DEMO_PASSWORD}")
        self.stdout.write("")
        self.stdout.write("URLs útiles:")
        self.stdout.write("  Admin:   http://127.0.0.1:8000/admin/")
        self.stdout.write("  Swagger: http://127.0.0.1:8000/api/v1/docs/")