from rest_framework import status
from rest_framework.generics import CreateAPIView, RetrieveAPIView, UpdateAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import serializers
from drf_spectacular.utils import extend_schema, extend_schema_view, inline_serializer

from .models import Cart, CartItem
from .services import clear_cart, delete_cart_item, get_active_cart
from .serializers import (
    CartItemCreateSerializer,
    CartItemSerializer,
    CartItemUpdateSerializer,
    CartSerializer,
)


class CartDetailView(RetrieveAPIView):
    serializer_class = CartSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return get_active_cart(self.request.user)


@extend_schema_view(post=extend_schema(responses={201: CartItemSerializer}))
class CartItemCreateView(CreateAPIView):
    serializer_class = CartItemCreateSerializer
    permission_classes = [IsAuthenticated]


@extend_schema_view(
    put=extend_schema(responses=CartItemSerializer),
    patch=extend_schema(responses=CartItemSerializer),
)
class CartItemUpdateView(UpdateAPIView):
    serializer_class = CartItemUpdateSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return CartItem.objects.filter(
            cart__user=self.request.user,
            cart__status=Cart.Status.ACTIVE,
        ).select_related("product__seller__user")


class CartItemDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={204: None, 404: inline_serializer(
        "CartItemNotFound", fields={"detail": serializers.CharField()},
    )})
    def delete(self, request, pk):
        delete_cart_item(user=request.user, item_id=pk)
        return Response(status=status.HTTP_204_NO_CONTENT)


class CartClearView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=inline_serializer(
        "CartClearResponse", fields={"detail": serializers.CharField()},
    ))
    def delete(self, request):
        clear_cart(request.user)
        return Response(
            {"detail": "Carrito vaciado correctamente."},
            status=status.HTTP_200_OK,
        )
