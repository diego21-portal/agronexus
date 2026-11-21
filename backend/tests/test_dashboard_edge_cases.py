import pytest

from apps.complaints.models import Complaint
from apps.orders.models import Order


@pytest.mark.django_db
def test_admin_dashboard_handles_a_general_complaint_without_an_order_item(
    admin_client, customer_client, customer_user, address,
):
    order = Order.objects.create(user=customer_user, shipping_address=address)
    complaint = Complaint.objects.create(
        user=customer_user, order=order, order_item=None,
        complaint_type=Complaint.ComplaintType.GENERAL,
        title="Consulta general sobre el pedido", description="No corresponde a un producto concreto.",
    )
    response = admin_client.get("/api/v1/admin/dashboard/")
    assert response.status_code == 200
    row = next(item for item in response.data["complaints"]["recent_open_complaints"] if item["id"] == complaint.pk)
    assert row["order_item_id"] is None
    assert row["seller"] is None
    assert customer_client.get("/api/v1/admin/dashboard/").status_code == 403
