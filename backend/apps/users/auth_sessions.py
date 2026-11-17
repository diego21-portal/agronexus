"""JWT session issuance, single-use refresh rotation and device logout."""

from uuid import UUID

from django.db import transaction
from django.utils import timezone
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.utils import get_md5_hash_password

from .models import AuthSession


SESSION_ERROR = "La sesión no es válida. Inicia sesión de nuevo."


def session_id_from_token(token):
    """Legacy tokens intentionally require a new login after this upgrade."""
    value = token.get("sid")
    if not isinstance(value, str):
        raise InvalidToken(SESSION_ERROR)
    try:
        return UUID(value)
    except (ValueError, AttributeError, TypeError) as exc:
        raise InvalidToken(SESSION_ERROR) from exc


def _verified_refresh(raw_refresh):
    try:
        return RefreshToken(raw_refresh)
    except TokenError as exc:
        raise InvalidToken(SESSION_ERROR) from exc


def _refresh_for_session(user, session):
    refresh = RefreshToken.for_user(user)
    refresh["sid"] = str(session.pk)
    # Rotation never extends this device's original seven-day login window.
    refresh["exp"] = int(session.expires_at.timestamp())
    return refresh


def _token_pair(refresh):
    access = refresh.access_token
    access["exp"] = min(access["exp"], refresh["exp"])
    return {"access": str(access), "refresh": str(refresh)}


def _locked_session(refresh):
    session_id = session_id_from_token(refresh)
    try:
        session = (
            AuthSession.objects.select_for_update(of=("self",))
            .select_related("user")
            .get(pk=session_id)
        )
    except AuthSession.DoesNotExist as exc:
        raise InvalidToken(SESSION_ERROR) from exc
    token_user_id = refresh.get(api_settings.USER_ID_CLAIM)
    session_user_id = getattr(session.user, api_settings.USER_ID_FIELD)
    if (
        not isinstance(token_user_id, (str, int))
        or isinstance(token_user_id, bool)
        or str(token_user_id) != str(session_user_id)
        or session.expires_at <= timezone.now()
    ):
        raise InvalidToken(SESSION_ERROR)
    return session


@transaction.atomic
def create_session_tokens(user):
    if not user.is_active:
        raise InvalidToken(SESSION_ERROR)
    session = AuthSession(
        user=user,
        expires_at=(timezone.now() + api_settings.REFRESH_TOKEN_LIFETIME).replace(microsecond=0),
    )
    refresh = _refresh_for_session(user, session)
    session.current_refresh_jti = refresh[api_settings.JTI_CLAIM]
    session.save(force_insert=True)
    return _token_pair(refresh)


def rotate_session_tokens(raw_refresh):
    refresh = _verified_refresh(raw_refresh)
    with transaction.atomic():
        # Every refresh and logout locks the same session row before mutation.
        session = _locked_session(refresh)
        if (
            session.revoked_at is not None
            or not session.user.is_active
            or refresh[api_settings.JTI_CLAIM] != session.current_refresh_jti
            or (
                api_settings.CHECK_REVOKE_TOKEN
                and refresh.get(api_settings.REVOKE_TOKEN_CLAIM)
                != get_md5_hash_password(session.user.password)
            )
        ):
            raise InvalidToken(SESSION_ERROR)
        replacement = _refresh_for_session(session.user, session)
        session.current_refresh_jti = replacement[api_settings.JTI_CLAIM]
        session.save(update_fields=["current_refresh_jti", "updated_at"])
        return _token_pair(replacement)


def revoke_session(raw_refresh):
    refresh = _verified_refresh(raw_refresh)
    with transaction.atomic():
        session = _locked_session(refresh)
        # A signed older refresh may log out its own session: it must also win
        # against a concurrent refresh which already replaced the current jti.
        if session.revoked_at is None:
            session.revoked_at = timezone.now()
            session.save(update_fields=["revoked_at", "updated_at"])
