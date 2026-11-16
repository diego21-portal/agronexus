from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenViewBase

from .auth_serializers import SessionLoginSerializer, SessionLogoutSerializer, SessionRefreshSerializer
from .throttles import LoginAccountThrottle, LoginIPThrottle, LogoutIPThrottle, RefreshIPThrottle


class SessionLoginView(TokenViewBase):
    authentication_classes = ()
    permission_classes = (AllowAny,)
    serializer_class = SessionLoginSerializer
    throttle_classes = (LoginIPThrottle, LoginAccountThrottle)


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

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(status=status.HTTP_204_NO_CONTENT)
