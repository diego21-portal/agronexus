from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenViewBase
from drf_spectacular.utils import extend_schema, extend_schema_view

from .auth_serializers import SessionLoginSerializer, SessionLogoutSerializer, SessionRefreshSerializer
from .throttles import LoginAccountThrottle, LoginIPThrottle, LogoutIPThrottle, RefreshIPThrottle
from .schema import SessionTokenPairSerializer


@extend_schema_view(post=extend_schema(responses=SessionTokenPairSerializer))
class SessionLoginView(TokenViewBase):
    authentication_classes = ()
    permission_classes = (AllowAny,)
    serializer_class = SessionLoginSerializer
    throttle_classes = (LoginIPThrottle, LoginAccountThrottle)


@extend_schema_view(post=extend_schema(responses=SessionTokenPairSerializer))
class SessionRefreshView(TokenViewBase):
    authentication_classes = ()
    permission_classes = (AllowAny,)
    serializer_class = SessionRefreshSerializer
    throttle_classes = (RefreshIPThrottle,)


class SessionLogoutView(TokenViewBase):
    authentication_classes = ()
    permission_classes = (AllowAny,)
    serializer_class = SessionLogoutSerializer
    throttle_classes = (LogoutIPThrottle,)

    @extend_schema(responses={204: None})
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(status=status.HTTP_204_NO_CONTENT)
