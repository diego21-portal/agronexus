from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainSerializer

from .auth_sessions import create_session_tokens, revoke_session, rotate_session_tokens


class SessionLoginSerializer(TokenObtainSerializer):
    access = serializers.CharField(read_only=True)
    refresh = serializers.CharField(read_only=True)

    def validate(self, attrs):
        super().validate(attrs)
        return create_session_tokens(self.user)


class SessionRefreshSerializer(serializers.Serializer):
    refresh = serializers.CharField(max_length=8192)
    access = serializers.CharField(read_only=True)

    def validate(self, attrs):
        return rotate_session_tokens(attrs["refresh"])


class SessionLogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField(write_only=True, max_length=8192)

    def validate(self, attrs):
        revoke_session(attrs["refresh"])
        return {}
