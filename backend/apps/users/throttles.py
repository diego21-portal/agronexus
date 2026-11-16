import hashlib
from collections.abc import Mapping

from django.conf import settings
from rest_framework.throttling import SimpleRateThrottle


class AuthRateThrottle(SimpleRateThrottle):
    """Read overrides dynamically and never trust caller-supplied proxy headers."""

    def get_rate(self):
        return settings.AUTH_THROTTLE_RATES.get(self.scope)

    def get_ident(self, request):
        return request.META.get("REMOTE_ADDR") or "unknown"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


class LoginIPThrottle(AuthRateThrottle):
    scope = "login_ip"


class LoginAccountThrottle(AuthRateThrottle):
    scope = "login_account"

    def get_cache_key(self, request, view):
        if not isinstance(request.data, Mapping):
            return None
        email = request.data.get("email")
        if not isinstance(email, str) or not email.strip():
            return None
        identity = hashlib.sha256(email.strip().casefold().encode("utf-8")).hexdigest()
        return self.cache_format % {"scope": self.scope, "ident": identity}


class RefreshIPThrottle(AuthRateThrottle):
    scope = "refresh_ip"


class RegisterIPThrottle(AuthRateThrottle):
    scope = "register_ip"


class LogoutIPThrottle(AuthRateThrottle):
    scope = "logout_ip"
