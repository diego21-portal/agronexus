"""Session credentials are exercised through the real JWT HTTP boundary."""

from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier
from uuid import uuid4

import pytest
from django.core.cache import cache
from django.db import close_old_connections, connection
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from apps.users.models import AuthSession, User


pytestmark = pytest.mark.django_db

LOGIN = "/api/v1/auth/login/"
REFRESH = "/api/v1/auth/refresh/"
LOGOUT = "/api/v1/auth/logout/"
ME = "/api/v1/users/me/"
PASSWORD = "ClienteTest1234"


@pytest.fixture(autouse=True)
def isolated_auth_throttle_cache():
    # Rate-limit history must not escape a test or pollute existing API tests.
    cache.clear()
    yield
    cache.clear()


def login(user, password=PASSWORD, **headers):
    return APIClient().post(
        LOGIN, {"email": user.email, "password": password}, format="json", **headers,
    )


def credentials(user):
    response = login(user)
    assert response.status_code == 200, response.data
    return response.data


def bearer(raw_access):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {raw_access}")
    return client


def post_refresh(raw_refresh):
    return APIClient().post(REFRESH, {"refresh": raw_refresh}, format="json")


def post_logout(raw_refresh):
    return APIClient().post(LOGOUT, {"refresh": raw_refresh}, format="json")


def session_for(pair):
    return AuthSession.objects.get(pk=RefreshToken(pair["refresh"])["sid"])


def corrupt_signature(raw_token):
    parts = raw_token.split(".")
    parts[2] = ("A" if parts[2][0] != "A" else "B") + parts[2][1:]
    return ".".join(parts)


def test_login_creates_an_owned_session_and_a_pair_with_matching_claims(customer_user):
    before = timezone.now()
    pair = credentials(customer_user)
    access, refresh = AccessToken(pair["access"]), RefreshToken(pair["refresh"])
    session = session_for(pair)

    assert session.user_id == customer_user.pk
    assert session.revoked_at is None
    assert str(session.pk) == access["sid"] == refresh["sid"]
    assert str(access["user_id"]) == str(refresh["user_id"]) == str(customer_user.pk)
    assert session.current_refresh_jti == refresh["jti"]
    assert before + timedelta(days=7) - timedelta(seconds=1) <= session.expires_at
    assert session.expires_at <= timezone.now() + timedelta(days=7)
    assert access["exp"] <= int(session.expires_at.timestamp())
    assert refresh["exp"] <= int(session.expires_at.timestamp())
    assert bearer(pair["access"]).get(ME).status_code == 200


@pytest.mark.parametrize("invalid", ["wrong_password", "inactive_user", "unknown_user"])
def test_login_does_not_create_sessions_for_invalid_credentials(customer_user, invalid):
    email, password = customer_user.email, PASSWORD
    if invalid == "wrong_password":
        password = "ContraseñaEquivocada123"
    elif invalid == "inactive_user":
        customer_user.is_active = False
        customer_user.save(update_fields=["is_active"])
    else:
        email = "does-not-exist@example.invalid"
    response = APIClient().post(LOGIN, {"email": email, "password": password}, format="json")

    assert response.status_code == 401
    assert not AuthSession.objects.exists()
    assert "access" not in response.data
    assert "refresh" not in response.data


def test_refresh_rotates_once_without_extending_the_absolute_session_expiry(customer_user):
    original = credentials(customer_user)
    session = session_for(original)
    absolute_expiry = session.expires_at

    response = post_refresh(original["refresh"])

    assert response.status_code == 200
    rotated = response.data
    assert rotated["refresh"] != original["refresh"]
    assert RefreshToken(rotated["refresh"])["sid"] == str(session.pk)
    assert AccessToken(rotated["access"])["sid"] == str(session.pk)
    session.refresh_from_db()
    assert session.expires_at == absolute_expiry
    assert session.current_refresh_jti == RefreshToken(rotated["refresh"])["jti"]
    assert post_refresh(original["refresh"]).status_code == 401
    assert bearer(original["access"]).get(ME).status_code == 200
    assert bearer(rotated["access"]).get(ME).status_code == 200
    assert AuthSession.objects.count() == 1


def test_rotation_caps_both_token_lifetimes_at_the_existing_session_deadline(customer_user):
    pair = credentials(customer_user)
    session = session_for(pair)
    deadline = timezone.now() + timedelta(seconds=90)
    AuthSession.objects.filter(pk=session.pk).update(expires_at=deadline)

    response = post_refresh(pair["refresh"])

    assert response.status_code == 200
    for token_type, key in [(AccessToken, "access"), (RefreshToken, "refresh")]:
        assert token_type(response.data[key])["exp"] <= int(deadline.timestamp())
    session.refresh_from_db()
    assert session.expires_at == deadline


def test_logout_with_an_older_rotated_refresh_revokes_the_entire_session_only(customer_user):
    original = credentials(customer_user)
    other_device = credentials(customer_user)
    rotated_response = post_refresh(original["refresh"])
    assert rotated_response.status_code == 200
    rotated = rotated_response.data

    # A competing refresh must not prevent logout using the original credential.
    response = post_logout(original["refresh"])

    assert response.status_code == 204
    assert post_logout(original["refresh"]).status_code == 204
    assert post_logout(rotated["refresh"]).status_code == 204
    for pair in [original, rotated]:
        assert bearer(pair["access"]).get(ME).status_code == 401
        assert post_refresh(pair["refresh"]).status_code == 401
    assert session_for(original).revoked_at is not None
    assert session_for(other_device).revoked_at is None
    assert bearer(other_device["access"]).get(ME).status_code == 200
    assert post_refresh(other_device["refresh"]).status_code == 200


def test_logout_does_not_require_an_access_token_or_accept_the_wrong_bearer_as_authority(customer_user):
    pair = credentials(customer_user)
    client = bearer("expired-or-invalid-access-token")

    response = client.post(LOGOUT, {"refresh": pair["refresh"]}, format="json")

    assert response.status_code == 204
    assert session_for(pair).revoked_at is not None


@pytest.mark.parametrize("blocked_by", ["revoked", "expired", "inactive_user", "deleted_session"])
def test_session_state_is_checked_for_access_and_refresh(customer_user, blocked_by):
    pair = credentials(customer_user)
    session = session_for(pair)
    if blocked_by == "revoked":
        AuthSession.objects.filter(pk=session.pk).update(revoked_at=timezone.now())
    elif blocked_by == "expired":
        AuthSession.objects.filter(pk=session.pk).update(expires_at=timezone.now() - timedelta(seconds=1))
    elif blocked_by == "inactive_user":
        customer_user.is_active = False
        customer_user.save(update_fields=["is_active"])
    else:
        session.delete()

    assert bearer(pair["access"]).get(ME).status_code == 401
    assert post_refresh(pair["refresh"]).status_code == 401


@pytest.mark.parametrize("path", [ME, "/api/v1/cart/", "/api/v1/orders/", "/api/v1/notifications/"])
def test_legacy_access_tokens_without_a_session_are_rejected_on_protected_apis(customer_user, path):
    legacy = RefreshToken.for_user(customer_user)

    assert bearer(str(legacy.access_token)).get(path).status_code == 401


def test_password_change_revokes_access_and_refresh_under_the_default_policy(customer_user):
    pair = credentials(customer_user)
    customer_user.set_password("ChangedPasswordForThisSession1234")
    customer_user.save(update_fields=["password"])

    assert bearer(pair["access"]).get(ME).status_code == 401
    assert post_refresh(pair["refresh"]).status_code == 401
    # A password change must still permit explicit revocation of this device.
    assert post_logout(pair["refresh"]).status_code == 204


def test_legacy_refresh_cannot_rotate_or_revoke_an_existing_session(customer_user):
    pair = credentials(customer_user)
    legacy = str(RefreshToken.for_user(customer_user))

    assert post_refresh(legacy).status_code == 401
    assert post_logout(legacy).status_code == 401
    assert session_for(pair).revoked_at is None
    assert bearer(pair["access"]).get(ME).status_code == 200


@pytest.mark.parametrize("kind", [
    "missing_sid", "malformed_sid", "structured_sid", "unknown_sid", "another_users_sid",
    "wrong_owner", "invalid_signature", "access_instead_of_refresh",
])
def test_invalid_refresh_credentials_cannot_rotate_or_revoke_other_sessions(
    customer_user, second_customer_user, kind,
):
    pair = credentials(customer_user)
    second = credentials(second_customer_user)
    refresh = RefreshToken(pair["refresh"])
    if kind == "missing_sid":
        del refresh["sid"]
    elif kind == "malformed_sid":
        refresh["sid"] = "not-a-uuid"
    elif kind == "structured_sid":
        refresh["sid"] = {"id": str(session_for(pair).pk)}
    elif kind == "unknown_sid":
        refresh["sid"] = str(uuid4())
    elif kind == "another_users_sid":
        refresh["sid"] = str(session_for(second).pk)
    elif kind == "wrong_owner":
        refresh["user_id"] = second_customer_user.pk
    raw = str(refresh)
    if kind == "invalid_signature":
        raw = corrupt_signature(raw)
    elif kind == "access_instead_of_refresh":
        raw = pair["access"]
    original_jti = session_for(pair).current_refresh_jti

    assert post_refresh(raw).status_code == 401
    assert post_logout(raw).status_code == 401
    assert not AuthSession.objects.filter(revoked_at__isnull=False).exists()
    assert session_for(pair).current_refresh_jti == original_jti
    assert bearer(pair["access"]).get(ME).status_code == 200
    assert bearer(second["access"]).get(ME).status_code == 200


@pytest.mark.parametrize("kind", ["malformed_sid", "structured_sid", "another_users_sid", "wrong_owner"])
def test_access_session_claims_are_validated_without_server_errors(customer_user, second_customer_user, kind):
    pair = credentials(customer_user)
    second = credentials(second_customer_user)
    access = AccessToken(pair["access"])
    if kind == "malformed_sid":
        access["sid"] = "not-a-uuid"
    elif kind == "structured_sid":
        access["sid"] = [str(session_for(pair).pk)]
    elif kind == "another_users_sid":
        access["sid"] = str(session_for(second).pk)
    else:
        access["user_id"] = second_customer_user.pk

    assert bearer(str(access)).get(ME).status_code == 401
    assert not AuthSession.objects.filter(revoked_at__isnull=False).exists()


@pytest.mark.parametrize("path", [REFRESH, LOGOUT])
@pytest.mark.parametrize("payload", [{}, {"refresh": ""}, {"refresh": None}])
def test_session_endpoints_validate_missing_refresh_without_server_errors(path, payload):
    response = APIClient().post(path, payload, format="json")
    assert response.status_code == 400


@pytest.mark.parametrize("path", [LOGIN, REFRESH, LOGOUT, "/api/v1/auth/register/"])
def test_auth_endpoints_reject_nonobject_json_with_a_validation_error(path):
    response = APIClient().post(path, ["not", "an", "object"], format="json")
    assert response.status_code == 400


def test_registration_hashes_password_and_cannot_assign_a_privileged_role():
    response = APIClient().post(
        "/api/v1/auth/register/",
        {"email": "new-session-user@example.invalid", "username": "new-session-user",
         "password": "NewSessionPassword1234", "password_confirm": "NewSessionPassword1234",
         "role": "SUPER_ADMIN", "is_staff": True, "is_superuser": True},
        format="json",
    )

    assert response.status_code == 201
    user = User.objects.get(pk=response.data["id"])
    assert user.check_password("NewSessionPassword1234")
    assert user.password != "NewSessionPassword1234"
    assert user.role == User.Role.CUSTOMER
    assert not user.is_staff and not user.is_superuser
    assert not AuthSession.objects.filter(user=user).exists()
    assert login(user, password="NewSessionPassword1234").status_code == 200


def set_rate(settings, scope, rate):
    rates = {key: "1000/min" for key in settings.AUTH_THROTTLE_RATES}
    rates[scope] = rate
    settings.AUTH_THROTTLE_RATES = rates


def assert_throttled(response):
    assert response.status_code == 429
    assert int(response["Retry-After"]) > 0


def test_login_account_budget_is_shared_across_client_addresses(settings, customer_user):
    set_rate(settings, "login_account", "2/min")
    for email, address in [(customer_user.email.upper(), "192.0.2.1"), (customer_user.email, "192.0.2.2")]:
        response = APIClient().post(
            LOGIN, {"email": email, "password": "wrong"}, format="json", REMOTE_ADDR=address,
        )
        assert response.status_code == 401
    response = APIClient().post(
        LOGIN, {"email": f" {customer_user.email} ", "password": PASSWORD},
        format="json", REMOTE_ADDR="192.0.2.3",
    )
    assert_throttled(response)
    assert not AuthSession.objects.exists()


def test_login_ip_budget_cannot_be_bypassed_by_changing_email_or_forwarded_for(settings):
    set_rate(settings, "login_ip", "2/min")
    client = APIClient()
    for index in range(2):
        response = client.post(
            LOGIN, {"email": f"unknown{index}@example.invalid", "password": "wrong"},
            format="json", REMOTE_ADDR="192.0.2.5", HTTP_X_FORWARDED_FOR=f"198.51.100.{index}",
        )
        assert response.status_code == 401
    response = client.post(
        LOGIN, {"email": "unknown3@example.invalid", "password": "wrong"},
        format="json", REMOTE_ADDR="192.0.2.5", HTTP_X_FORWARDED_FOR="198.51.100.99",
    )
    assert_throttled(response)


def test_refresh_budget_returns_retry_after_without_rotating_a_blocked_attempt(settings, customer_user):
    set_rate(settings, "refresh_ip", "2/min")
    pair = credentials(customer_user)
    for _ in range(2):
        response = post_refresh(pair["refresh"])
        assert response.status_code == 200
        pair = response.data
    expected_jti = session_for(pair).current_refresh_jti

    assert_throttled(post_refresh(pair["refresh"]))
    assert session_for(pair).current_refresh_jti == expected_jti


@pytest.mark.parametrize("scope,path", [("register_ip", "/api/v1/auth/register/"), ("logout_ip", LOGOUT)])
def test_register_and_logout_throttle_invalid_attempts_before_validation(settings, scope, path):
    set_rate(settings, scope, "2/min")
    client = APIClient()
    for _ in range(2):
        assert client.post(path, {}, format="json").status_code == 400
    assert_throttled(client.post(path, {}, format="json"))


def concurrent_posts(calls):
    barrier = Barrier(len(calls))

    def submit(call):
        close_old_connections()
        try:
            path, raw_refresh = call
            barrier.wait(timeout=15)
            response = APIClient().post(path, {"refresh": raw_refresh}, format="json")
            return path, response.status_code, response.data
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=len(calls)) as executor:
        return list(executor.map(submit, calls))


@pytest.mark.django_db(transaction=True)
def test_concurrent_refreshes_issue_only_one_new_refresh(customer_user):
    if connection.vendor != "postgresql":
        pytest.skip("La rotación concurrente se verifica con PostgreSQL.")
    pair = credentials(customer_user)

    results = concurrent_posts([(REFRESH, pair["refresh"]), (REFRESH, pair["refresh"])])

    assert sorted(status for _, status, _ in results) == [200, 401]
    successful_pair = next(body for _, status, body in results if status == 200)
    assert session_for(pair).current_refresh_jti == RefreshToken(successful_pair["refresh"])["jti"]
    assert AuthSession.objects.count() == 1
    assert bearer(successful_pair["access"]).get(ME).status_code == 200


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("first", [REFRESH, LOGOUT])
def test_concurrent_logout_and_refresh_cannot_leave_a_usable_session(customer_user, first):
    if connection.vendor != "postgresql":
        pytest.skip("La revocación concurrente se verifica con PostgreSQL.")
    pair = credentials(customer_user)
    second = LOGOUT if first == REFRESH else REFRESH

    results = concurrent_posts([(first, pair["refresh"]), (second, pair["refresh"])])

    assert session_for(pair).revoked_at is not None
    for path, status, body in results:
        if path == LOGOUT:
            assert status == 204
        else:
            assert status in {200, 401}
            if status == 200:
                assert bearer(body["access"]).get(ME).status_code == 401
                assert post_refresh(body["refresh"]).status_code == 401
    assert bearer(pair["access"]).get(ME).status_code == 401
    assert post_refresh(pair["refresh"]).status_code == 401
