import pytest


@pytest.mark.django_db
def test_customer_cannot_access_seller_dashboard(customer_client):
    response = customer_client.get("/api/v1/seller/dashboard/")

    assert response.status_code in [403, 401]


@pytest.mark.django_db
def test_customer_cannot_access_admin_dashboard(customer_client):
    response = customer_client.get("/api/v1/admin/dashboard/")

    assert response.status_code in [403, 401]


@pytest.mark.django_db
def test_seller_cannot_access_admin_dashboard(seller_client):
    response = seller_client.get("/api/v1/admin/dashboard/")

    assert response.status_code in [403, 401]


@pytest.mark.django_db
def test_anonymous_cannot_access_cart(api_client):
    response = api_client.get("/api/v1/cart/")

    assert response.status_code in [403, 401]


@pytest.mark.django_db
def test_customer_cannot_access_seller_orders(customer_client):
    response = customer_client.get("/api/v1/seller/orders/")

    assert response.status_code in [403, 401]


@pytest.mark.django_db
def test_customer_cannot_access_seller_questions(customer_client):
    response = customer_client.get("/api/v1/seller/questions/")

    assert response.status_code in [403, 401]


@pytest.mark.django_db
def test_customer_cannot_access_admin_complaints(customer_client):
    response = customer_client.get("/api/v1/admin/complaints/")

    assert response.status_code in [403, 401]