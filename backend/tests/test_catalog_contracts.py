from decimal import Decimal

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.orders.models import Order, OrderItem
from apps.products.models import Product, ProductImage
from apps.reviews.models import ProductReview
from apps.shipments.models import Shipment


pytestmark = pytest.mark.django_db


@pytest.fixture
def make_product(product):
    def create(suffix, **overrides):
        values = {
            "seller": product.seller,
            "category": product.category,
            "brand": product.brand,
            "region": product.region,
            "name": f"Producto {suffix}",
            "sku": f"CAT-{suffix}",
            "description": "Repuesto agrícola.",
            "price": "100.00",
            "stock": 5,
            "status": Product.Status.PUBLISHED,
            "is_featured": True,
        }
        values.update(overrides)
        return Product.objects.create(**values)

    return create


@pytest.fixture
def make_review(product, address):
    def create(user, *, is_public=True):
        order = Order.objects.create(user=user, shipping_address=address)
        Shipment.objects.create(
            order=order, seller=product.seller, status=Shipment.Status.DELIVERED,
        )
        item = OrderItem.objects.create(
            order=order, seller=product.seller, product=product,
            product_name=product.name, sku=product.sku, quantity=1,
            unit_price=product.current_price, total_price=product.current_price,
        )
        return ProductReview.objects.create(
            product=product, user=user, order_item=item,
            rating=4, comment="Producto recibido.", is_public=is_public,
        )

    return create


@pytest.mark.parametrize("endpoint", ["/api/v1/products/", "/api/v1/products/featured/"])
@pytest.mark.parametrize("params", [
    {"min_price": "abc"},
    {"max_price": "NaN"},
    {"min_price": "Infinity"},
    {"min_price": "-Infinity"},
    {"max_price": "1e1000000"},
    {"min_price": "-0.01"},
    {"max_price": "10000000000.00"},
    {"min_price": "0.001"},
    {"min_price": "20", "max_price": "10"},
    {"in_stock": "sometimes"},
    {"ordering": "seller__user__password"},
])
def test_catalog_rejects_invalid_filters(api_client, endpoint, params):
    response = api_client.get(endpoint, params)
    assert response.status_code == 400, response.data


def test_catalog_filters_and_orders_by_effective_price(api_client, product, make_product):
    discounted = make_product("discounted", price="500.00", discount_price="50.00")
    regular = make_product("regular", price="75.00")
    free = make_product("free", price="100.00", discount_price="0.00")

    ascending = api_client.get("/api/v1/products/", {"ordering": "price"})
    assert ascending.status_code == 200
    assert [item["id"] for item in ascending.data["results"]] == [
        free.pk, discounted.pk, regular.pk, product.pk,
    ]
    assert ascending.data["results"][0]["current_price"] == "0.00"

    descending = api_client.get("/api/v1/products/", {"ordering": "-price"})
    assert [item["id"] for item in descending.data["results"]] == [
        product.pk, regular.pk, discounted.pk, free.pk,
    ]
    filtered = api_client.get("/api/v1/products/", {"min_price": "0", "max_price": "50"})
    assert {item["id"] for item in filtered.data["results"]} == {free.pk, discounted.pk}
    zero = api_client.get("/api/v1/products/", {"min_price": "0.00", "max_price": "0.00"})
    assert [item["id"] for item in zero.data["results"]] == [free.pk]
    bounded = api_client.get("/api/v1/products/", {"max_price": "9999999999.99"})
    assert bounded.status_code == 200


@pytest.mark.parametrize("ordering", ["rating", "-average_rating", "average_rating"])
def test_catalog_accepts_rating_ordering(api_client, product, make_product, ordering):
    rated = make_product("rated", average_rating=Decimal("4.50"))
    response = api_client.get("/api/v1/products/", {"ordering": ordering})
    assert response.status_code == 200
    expected = [product.pk, rated.pk] if ordering == "average_rating" else [rated.pk, product.pk]
    assert [item["id"] for item in response.data["results"]] == expected


def test_catalog_stock_and_slug_filters(api_client, product, make_product):
    empty = make_product("empty")
    Product.objects.filter(pk=empty.pk).update(stock=0)
    in_stock = api_client.get("/api/v1/products/", {"in_stock": "true"})
    assert [item["id"] for item in in_stock.data["results"]] == [product.pk]
    unfiltered = api_client.get("/api/v1/products/", {"in_stock": "false"})
    assert unfiltered.data["count"] == 2
    slugs = api_client.get("/api/v1/products/", {
        "category": product.category.slug, "brand": product.brand.slug,
        "region": product.region.slug, "search": product.sku,
    })
    assert [item["id"] for item in slugs.data["results"]] == [product.pk]


@pytest.mark.parametrize("visibility", ["seller", "seller_user", "product", "draft"])
def test_nonpublic_product_is_hidden_everywhere(
    api_client, customer_client, product, visibility,
):
    if visibility == "seller":
        product.seller.is_active = False
        product.seller.save(update_fields=["is_active"])
    elif visibility == "seller_user":
        product.seller.user.is_active = False
        product.seller.user.save(update_fields=["is_active"])
    elif visibility == "product":
        Product.objects.filter(pk=product.pk).update(is_active=False)
    else:
        Product.objects.filter(pk=product.pk).update(status=Product.Status.DRAFT)

    for endpoint in ["/api/v1/products/", "/api/v1/products/featured/"]:
        response = api_client.get(endpoint)
        assert response.status_code == 200
        assert response.data["count"] == 0
    assert api_client.get(f"/api/v1/products/{product.slug}/").status_code == 404
    reviews_url = f"/api/v1/products/{product.slug}/reviews/"
    assert api_client.get(reviews_url).status_code == 404
    assert customer_client.post(reviews_url, {
        "order_item_id": 1, "rating": 5, "comment": "Prueba",
    }).status_code == 404
    questions_url = f"/api/v1/products/{product.slug}/questions/"
    assert api_client.get(questions_url).status_code == 404
    assert customer_client.post(questions_url, {"question": "¿Está disponible?"}).status_code == 404


@pytest.mark.parametrize("endpoint", ["/api/v1/products/", "/api/v1/products/featured/"])
def test_catalog_pages_cover_all_results_with_stable_order(
    api_client, product, make_product, endpoint,
):
    for index in range(30):
        make_product(str(index))
    first = api_client.get(endpoint, {"ordering": "price"})
    assert first.status_code == 200
    assert first.data["count"] == 31
    assert len(first.data["results"]) == 24
    assert first.data["previous"] is None
    second = api_client.get(first.data["next"])
    assert second.status_code == 200
    assert len(second.data["results"]) == 7
    assert second.data["next"] is None
    assert second.data["previous"]
    ids = [item["id"] for item in first.data["results"] + second.data["results"]]
    assert len(set(ids)) == 31
    assert ids[-1] == product.pk
    small = api_client.get(endpoint, {"page_size": 2})
    assert len(small.data["results"]) == 2
    assert api_client.get(endpoint, {"page": 1000}).status_code == 404


def test_catalog_caps_requested_page_size(api_client, product, make_product):
    for index in range(104):
        make_product(str(index))
    response = api_client.get("/api/v1/products/", {"page_size": 1000})
    assert response.status_code == 200
    assert response.data["count"] == 105
    assert len(response.data["results"]) == 100
    assert "page_size=1000" in response.data["next"]


@pytest.mark.parametrize("endpoint", ["/api/v1/products/", "/api/v1/products/featured/"])
def test_catalog_image_queries_do_not_grow_per_product(
    api_client, product, make_product, endpoint,
):
    ProductImage.objects.create(product=product, image="products/fallback.jpg")
    main = ProductImage.objects.create(
        product=product, image="products/main.jpg", is_main=True, order=5,
    )
    with CaptureQueriesContext(connection) as single_queries:
        single = api_client.get(endpoint)
    assert single.status_code == 200
    assert single.data["results"][0]["main_image"].endswith(main.image.url)

    for index in range(23):
        other = make_product(str(index))
        if index % 3:
            ProductImage.objects.create(
                product=other, image=f"products/{index}.jpg", is_main=index % 3 == 1,
            )
    with CaptureQueriesContext(connection) as many_queries:
        many = api_client.get(endpoint)
    assert many.status_code == 200
    assert len(many.data["results"]) == 24
    assert len(many_queries) == len(single_queries)
    assert len(many_queries) <= 3
    assert any(item["main_image"] is None for item in many.data["results"])
    assert any((item["main_image"] or "").endswith("products/2.jpg") for item in many.data["results"])


def test_missing_product_reviews_returns_404(api_client, customer_client):
    endpoint = "/api/v1/products/no-existe/reviews/"
    assert api_client.get(endpoint).status_code == 404
    assert customer_client.post(endpoint, {"order_item_id": 1, "rating": 5}).status_code == 404
    questions_url = "/api/v1/products/no-existe/questions/"
    assert api_client.get(questions_url).status_code == 404
    assert customer_client.post(questions_url, {"question": "¿Está disponible?"}).status_code == 404


def test_my_reviews_is_private_and_includes_own_hidden_reviews(
    api_client, customer_client, customer_user, second_customer_user,
    product, make_review,
):
    public = make_review(customer_user)
    hidden = make_review(customer_user, is_public=False)
    foreign = make_review(second_customer_user)
    assert api_client.get("/api/v1/users/me/reviews/").status_code == 401
    response = customer_client.get("/api/v1/users/me/reviews/", {"user": second_customer_user.pk})
    assert response.status_code == 200
    assert {item["id"] for item in response.data} == {public.pk, hidden.pk}
    assert all(set(item) == {
        "id", "product", "product_name", "user_name", "rating", "comment",
        "is_public", "created_at", "updated_at",
    } for item in response.data)
    public_response = api_client.get(f"/api/v1/products/{product.slug}/reviews/")
    assert {item["id"] for item in public_response.data} == {public.pk, foreign.pk}

    Product.objects.filter(pk=product.pk).update(is_active=False)
    own = customer_client.get("/api/v1/users/me/reviews/")
    assert {item["id"] for item in own.data} == {public.pk, hidden.pk}


@pytest.mark.parametrize("method", ["get", "patch", "delete"])
def test_review_detail_requires_authentication_and_ownership(
    api_client, customer_client, second_customer_user, make_review, method,
):
    foreign = make_review(second_customer_user)
    endpoint = f"/api/v1/reviews/{foreign.pk}/"
    kwargs = {"data": {"comment": "Otro usuario"}, "format": "json"} if method == "patch" else {}
    assert getattr(api_client, method)(endpoint, **kwargs).status_code == 401
    assert getattr(customer_client, method)(endpoint, **kwargs).status_code == 404
    foreign.refresh_from_db()
    assert foreign.comment == "Producto recibido."
