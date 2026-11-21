"""OpenAPI descriptions for the session-aware JWT endpoints."""

from drf_spectacular.contrib.rest_framework_simplejwt import SimpleJWTScheme
from rest_framework import serializers


class SessionJWTScheme(SimpleJWTScheme):
    target_class = "apps.users.authentication.SessionJWTAuthentication"


class SessionTokenPairSerializer(serializers.Serializer):
    access = serializers.CharField(read_only=True)
    refresh = serializers.CharField(read_only=True)
