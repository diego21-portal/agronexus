import pytest

from apps.users.models import User


@pytest.mark.django_db
def test_register_customer_creates_user(api_client):
    response = api_client.post(
        "/api/v1/auth/register/",
        {
            "email": "nuevo@test.com",
            "username": "nuevo",
            "first_name": "Nuevo",
            "last_name": "Cliente",
            "password": "NuevoCliente1234",
            "password_confirm": "NuevoCliente1234",
        },
        format="json",
    )

    assert response.status_code == 201
    assert User.objects.filter(email="nuevo@test.com").exists()

    user = User.objects.get(email="nuevo@test.com")
    assert user.role == User.Role.CUSTOMER
    assert hasattr(user, "profile")


@pytest.mark.django_db
def test_login_returns_tokens(api_client, customer_user):
    response = api_client.post(
        "/api/v1/auth/login/",
        {
            "email": "cliente@test.com",
            "password": "ClienteTest1234",
        },
        format="json",
    )

    assert response.status_code == 200
    assert "access" in response.data
    assert "refresh" in response.data


@pytest.mark.django_db
def test_public_product_list(api_client, product):
    response = api_client.get("/api/v1/products/")

    assert response.status_code == 200
    assert len(response.data) >= 1
    assert response.data[0]["name"] == product.name


@pytest.mark.django_db
def test_public_product_detail(api_client, product):
    response = api_client.get(f"/api/v1/products/{product.slug}/")

    assert response.status_code == 200
    assert response.data["sku"] == product.sku


@pytest.mark.django_db
def test_products_can_be_filtered_by_search(api_client, product):
    response = api_client.get("/api/v1/products/?search=filtro")

    assert response.status_code == 200
    assert len(response.data) >= 1