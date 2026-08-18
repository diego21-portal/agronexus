import pytest
from rest_framework.test import APIClient

from apps.categories.models import Brand, Category
from apps.products.models import Product
from apps.regions.models import Region
from apps.sellers.models import SellerProfile
from apps.users.models import Address, User


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def customer_user(db):
    return User.objects.create_user(
        email="cliente@test.com",
        username="cliente",
        password="ClienteTest1234",
        first_name="Cliente",
        last_name="Demo",
        role=User.Role.CUSTOMER,
    )


@pytest.fixture
def second_customer_user(db):
    return User.objects.create_user(
        email="cliente2@test.com",
        username="cliente2",
        password="ClienteTest1234",
        first_name="Cliente",
        last_name="Dos",
        role=User.Role.CUSTOMER,
    )


@pytest.fixture
def seller_user(db):
    return User.objects.create_user(
        email="vendedor@test.com",
        username="vendedor",
        password="VendedorTest1234",
        first_name="Vendedor",
        last_name="Demo",
        role=User.Role.SELLER,
    )


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        email="admin@test.com",
        username="admin",
        password="AdminTest1234",
        role=User.Role.ADMIN,
        is_staff=True,
        is_superuser=True,
    )


@pytest.fixture
def customer_client(customer_user):
    client = APIClient()
    client.force_authenticate(user=customer_user)
    return client


@pytest.fixture
def second_customer_client(second_customer_user):
    client = APIClient()
    client.force_authenticate(user=second_customer_user)
    return client


@pytest.fixture
def seller_client(seller_user):
    client = APIClient()
    client.force_authenticate(user=seller_user)
    return client


@pytest.fixture
def admin_client(admin_user):
    client = APIClient()
    client.force_authenticate(user=admin_user)
    return client


@pytest.fixture
def region(db):
    return Region.objects.create(
        name="Mendoza",
        province="Mendoza",
        country="Argentina",
        is_active=True,
    )


@pytest.fixture
def category(db):
    return Category.objects.create(
        name="Repuestos",
        description="Repuestos agrícolas.",
        is_active=True,
    )


@pytest.fixture
def brand(db):
    return Brand.objects.create(
        name="John Deere",
        description="Marca agrícola.",
        is_active=True,
    )


@pytest.fixture
def seller_profile(db, seller_user):
    return SellerProfile.objects.create(
        user=seller_user,
        business_name="Agro Repuestos Mendoza",
        tax_id="20-00000000-0",
        is_verified=True,
        is_active=True,
    )


@pytest.fixture
def product(db, seller_profile, category, brand, region):
    return Product.objects.create(
        seller=seller_profile,
        category=category,
        brand=brand,
        region=region,
        name="Filtro hidráulico John Deere X100",
        sku="JD-FH-X100",
        short_description="Filtro hidráulico para maquinaria agrícola.",
        description="Repuesto técnico para maquinaria agrícola.",
        technical_description="Filtro técnico reforzado.",
        price="85000.00",
        discount_price=None,
        unit="unidad",
        stock=10,
        minimum_stock=2,
        condition=Product.Condition.NEW,
        status=Product.Status.PUBLISHED,
        shipping_available=True,
        is_active=True,
        is_featured=True,
    )


@pytest.fixture
def address(db, customer_user, region):
    return Address.objects.create(
        user=customer_user,
        region=region,
        street="San Martín",
        number="123",
        city="Luján de Cuyo",
        province="Mendoza",
        postal_code="5507",
        reference="Casa con portón negro",
        is_default=True,
        is_active=True,
    )