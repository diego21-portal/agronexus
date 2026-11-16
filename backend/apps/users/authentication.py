from django.utils import timezone
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.settings import api_settings

from .auth_sessions import SESSION_ERROR, session_id_from_token
from .models import AuthSession


class SessionJWTAuthentication(JWTAuthentication):
    """Check device revocation on every newly authenticated API request."""

    def get_user(self, validated_token):
        session_id = session_id_from_token(validated_token)
        session = (
            AuthSession.objects.select_related("user")
            .filter(pk=session_id, revoked_at__isnull=True, expires_at__gt=timezone.now())
            .first()
        )
        token_user_id = validated_token.get(api_settings.USER_ID_CLAIM)
        if (
            session is None
            or not isinstance(token_user_id, (str, int))
            or isinstance(token_user_id, bool)
            or str(token_user_id) != str(getattr(session.user, api_settings.USER_ID_FIELD))
        ):
            raise InvalidToken(SESSION_ERROR)
        # Keep SimpleJWT's active-user and optional password-change checks.
        return super().get_user(validated_token)
