import pytest

from apps.complaints.models import Complaint, ReturnRequest
from apps.notifications.models import Notification
from apps.orders.models import Order
from apps.shipments.models import Shipment


def create_delivered_order(customer_client, seller_client, product, address):
    customer_client.post(
        "/api/v1/cart/items/",
        {
            "product_id": product.id,
            "quantity": 1,
        },
        format="json",
    )

    checkout_response = customer_client.post(
        "/api/v1/checkout/",
        {
            "address_id": address.id,
            "payment_method": "SIMULATED_CARD",
        },
        format="json",
    )

    order = Order.objects.get(id=checkout_response.data["id"])
    shipment = Shipment.objects.get(order=order)

    seller_client.patch(
        f"/api/v1/seller/shipments/{shipment.id}/status/",
        {
            "status": "DELIVERED",
            "carrier": "Logística AgroNexus",
            "description": "Pedido entregado.",
            "location": "Mendoza",
        },
        format="json",
    )

    order.refresh_from_db()
    return order


@pytest.mark.django_db
def test_checkout_creates_notifications_for_customer_and_seller(
    customer_client,
    customer_user,
    seller_user,
    product,
    address,
):
    customer_client.post(
        "/api/v1/cart/items/",
        {
            "product_id": product.id,
            "quantity": 1,
        },
        format="json",
    )

    response = customer_client.post(
        "/api/v1/checkout/",
        {
            "address_id": address.id,
            "payment_method": "SIMULATED_CARD",
        },
        format="json",
    )

    assert response.status_code == 201

    assert Notification.objects.filter(
        user=customer_user,
        notification_type=Notification.NotificationType.ORDER_CREATED,
    ).exists()

    assert Notification.objects.filter(
        user=seller_user,
        notification_type=Notification.NotificationType.ORDER_CREATED,
    ).exists()


@pytest.mark.django_db
def test_user_can_list_and_mark_notifications_as_read(
    customer_client,
    customer_user,
):
    notification = Notification.objects.create(
        user=customer_user,
        title="Prueba",
        message="Mensaje de prueba",
        notification_type=Notification.NotificationType.SYSTEM,
    )

    list_response = customer_client.get("/api/v1/notifications/")
    assert list_response.status_code == 200
    assert len(list_response.data) == 1

    read_response = customer_client.patch(
        f"/api/v1/notifications/{notification.id}/read/",
        {},
        format="json",
    )

    assert read_response.status_code == 200

    notification.refresh_from_db()
    assert notification.is_read is True
    assert notification.read_at is not None


@pytest.mark.django_db
def test_user_can_mark_all_notifications_as_read(customer_client, customer_user):
    Notification.objects.create(
        user=customer_user,
        title="Prueba 1",
        message="Mensaje 1",
        notification_type=Notification.NotificationType.SYSTEM,
    )
    Notification.objects.create(
        user=customer_user,
        title="Prueba 2",
        message="Mensaje 2",
        notification_type=Notification.NotificationType.SYSTEM,
    )

    response = customer_client.patch(
        "/api/v1/notifications/read-all/",
        {},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["updated_count"] == 2
    assert Notification.objects.filter(user=customer_user, is_read=False).count() == 0


@pytest.mark.django_db
def test_customer_can_create_complaint(
    customer_client,
    product,
    address,
):
    customer_client.post(
        "/api/v1/cart/items/",
        {
            "product_id": product.id,
            "quantity": 1,
        },
        format="json",
    )

    checkout_response = customer_client.post(
        "/api/v1/checkout/",
        {
            "address_id": address.id,
            "payment_method": "SIMULATED_CARD",
        },
        format="json",
    )

    order = Order.objects.get(id=checkout_response.data["id"])
    order_item = order.items.first()

    response = customer_client.post(
        f"/api/v1/orders/{order.id}/complaints/",
        {
            "order_item_id": order_item.id,
            "complaint_type": "PRODUCT_PROBLEM",
            "title": "Producto con falla",
            "description": "El producto presenta una falla al utilizarlo.",
        },
        format="json",
    )

    assert response.status_code == 201
    assert Complaint.objects.filter(order=order).exists()


@pytest.mark.django_db
def test_admin_can_resolve_complaint(
    customer_client,
    admin_client,
    product,
    address,
):
    customer_client.post(
        "/api/v1/cart/items/",
        {
            "product_id": product.id,
            "quantity": 1,
        },
        format="json",
    )

    checkout_response = customer_client.post(
        "/api/v1/checkout/",
        {
            "address_id": address.id,
            "payment_method": "SIMULATED_CARD",
        },
        format="json",
    )

    order = Order.objects.get(id=checkout_response.data["id"])
    order_item = order.items.first()

    complaint_response = customer_client.post(
        f"/api/v1/orders/{order.id}/complaints/",
        {
            "order_item_id": order_item.id,
            "complaint_type": "PRODUCT_PROBLEM",
            "title": "Producto con falla",
            "description": "El producto presenta una falla al utilizarlo.",
        },
        format="json",
    )

    complaint_id = complaint_response.data["id"]

    response = admin_client.patch(
        f"/api/v1/admin/complaints/{complaint_id}/status/",
        {
            "status": "RESOLVED",
            "admin_note": "Revisado por administración.",
            "resolution": "Se ofreció reemplazo del producto.",
        },
        format="json",
    )

    assert response.status_code == 200

    complaint = Complaint.objects.get(id=complaint_id)
    assert complaint.status == Complaint.Status.RESOLVED
    assert complaint.resolved_by is not None


@pytest.mark.django_db
def test_customer_can_create_return_request_only_for_delivered_order(
    customer_client,
    seller_client,
    product,
    address,
):
    order = create_delivered_order(customer_client, seller_client, product, address)
    order_item = order.items.first()

    response = customer_client.post(
        f"/api/v1/order-items/{order_item.id}/returns/",
        {
            "reason": "DEFECTIVE_PRODUCT",
            "description": "El producto no funciona correctamente.",
            "quantity": 1,
        },
        format="json",
    )

    assert response.status_code == 201
    assert ReturnRequest.objects.filter(order_item=order_item).exists()


@pytest.mark.django_db
def test_admin_can_approve_return_request(
    customer_client,
    seller_client,
    admin_client,
    product,
    address,
):
    order = create_delivered_order(customer_client, seller_client, product, address)
    order_item = order.items.first()

    return_response = customer_client.post(
        f"/api/v1/order-items/{order_item.id}/returns/",
        {
            "reason": "DEFECTIVE_PRODUCT",
            "description": "El producto no funciona correctamente.",
            "quantity": 1,
        },
        format="json",
    )

    return_id = return_response.data["id"]

    response = admin_client.patch(
        f"/api/v1/admin/returns/{return_id}/status/",
        {
            "status": "APPROVED",
            "approved_refund_amount": "85000.00",
            "admin_note": "Devolución aprobada.",
            "resolution": "El cliente debe enviar el producto.",
        },
        format="json",
    )

    assert response.status_code == 200

    return_request = ReturnRequest.objects.get(id=return_id)
    assert return_request.status == ReturnRequest.Status.APPROVED
    assert return_request.approved_refund_amount == 85000


@pytest.mark.django_db
def test_seller_dashboard_works(seller_client, product):
    response = seller_client.get("/api/v1/seller/dashboard/")

    assert response.status_code == 200
    assert "seller" in response.data
    assert "products" in response.data
    assert "sales" in response.data


@pytest.mark.django_db
def test_admin_dashboard_works(admin_client, product):
    response = admin_client.get("/api/v1/admin/dashboard/")

    assert response.status_code == 200
    assert "users" in response.data
    assert "products" in response.data
    assert "orders" in response.data
    assert "sales" in response.data