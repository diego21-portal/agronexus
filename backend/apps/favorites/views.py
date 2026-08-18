from rest_framework import status
from rest_framework.generics import CreateAPIView, DestroyAPIView, ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.products.models import Product

from .models import FavoriteProduct
from .serializers import FavoriteProductCreateSerializer, FavoriteProductSerializer


class FavoriteProductListView(ListAPIView):
    serializer_class = FavoriteProductSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            FavoriteProduct.objects.filter(user=self.request.user)
            .select_related("product")
            .prefetch_related("product__images")
            .order_by("-created_at")
        )


class FavoriteProductCreateView(CreateAPIView):
    serializer_class = FavoriteProductCreateSerializer
    permission_classes = [IsAuthenticated]


class FavoriteProductDeleteView(DestroyAPIView):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return FavoriteProduct.objects.filter(user=self.request.user)


class ProductFavoriteStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, slug):
        product = Product.objects.filter(
            slug=slug,
            is_active=True,
            status=Product.Status.PUBLISHED,
        ).first()

        if not product:
            return Response(
                {"detail": "Producto no encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        favorite = FavoriteProduct.objects.filter(
            user=request.user,
            product=product,
        ).first()

        return Response(
            {
                "product_id": product.id,
                "product_slug": product.slug,
                "is_favorite": favorite is not None,
                "favorite_id": favorite.id if favorite else None,
            },
            status=status.HTTP_200_OK,
        )


class ProductFavoriteToggleView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, slug):
        product = Product.objects.filter(
            slug=slug,
            is_active=True,
            status=Product.Status.PUBLISHED,
        ).first()

        if not product:
            return Response(
                {"detail": "Producto no encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        favorite, created = FavoriteProduct.objects.get_or_create(
            user=request.user,
            product=product,
        )

        serializer = FavoriteProductSerializer(
            favorite,
            context={"request": request},
        )

        return Response(
            {
                "detail": (
                    "Producto agregado a favoritos."
                    if created
                    else "El producto ya estaba en favoritos."
                ),
                "favorite": serializer.data,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def delete(self, request, slug):
        product = Product.objects.filter(
            slug=slug,
            is_active=True,
            status=Product.Status.PUBLISHED,
        ).first()

        if not product:
            return Response(
                {"detail": "Producto no encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        favorite = FavoriteProduct.objects.filter(
            user=request.user,
            product=product,
        ).first()

        if not favorite:
            return Response(
                {"detail": "El producto no estaba en favoritos."},
                status=status.HTTP_404_NOT_FOUND,
            )

        favorite.delete()

        return Response(
            {"detail": "Producto eliminado de favoritos."},
            status=status.HTTP_200_OK,
        )