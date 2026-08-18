from rest_framework import status
from rest_framework.generics import CreateAPIView, RetrieveAPIView, UpdateAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Cart, CartItem
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
        cart, _ = Cart.objects.prefetch_related(
            "items__product",
        ).get_or_create(
            user=self.request.user,
            status=Cart.Status.ACTIVE,
        )

        return cart


class CartItemCreateView(CreateAPIView):
    serializer_class = CartItemCreateSerializer
    permission_classes = [IsAuthenticated]


class CartItemUpdateView(UpdateAPIView):
    serializer_class = CartItemUpdateSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        cart, _ = Cart.objects.get_or_create(
            user=self.request.user,
            status=Cart.Status.ACTIVE,
        )

        return CartItem.objects.filter(
            cart=cart,
        ).select_related("product")


class CartItemDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        cart, _ = Cart.objects.get_or_create(
            user=request.user,
            status=Cart.Status.ACTIVE,
        )

        item = CartItem.objects.filter(
            pk=pk,
            cart=cart,
        ).first()

        if not item:
            return Response(
                {"detail": "El ítem no existe en tu carrito."},
                status=status.HTTP_404_NOT_FOUND,
            )

        item.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)


class CartClearView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        cart, _ = Cart.objects.get_or_create(
            user=request.user,
            status=Cart.Status.ACTIVE,
        )

        cart.items.all().delete()

        return Response(
            {"detail": "Carrito vaciado correctamente."},
            status=status.HTTP_200_OK,
        )