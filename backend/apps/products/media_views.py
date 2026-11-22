"""Seller-owned uploads kept separate from general product JSON mutations."""
from collections.abc import Mapping

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.generics import GenericAPIView
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from apps.sellers.models import SellerProfile
from apps.users.models import User

from .media_validation import validate_product_image, validate_technical_sheet
from .models import Product, ProductImage
from .permissions import IsActiveSeller
from .serializers import ProductImageSerializer, SellerProductSerializer


MAX_PRODUCT_IMAGES = 12


class StrictMediaSerializer(serializers.Serializer):
    def to_internal_value(self, data):
        if not isinstance(data, Mapping):
            return super().to_internal_value(data)
        unknown = set(data) - set(self.fields)
        if unknown:
            raise serializers.ValidationError({field: "Este campo no está permitido en esta operación." for field in sorted(unknown)})
        return super().to_internal_value(data)


class ProductImageUploadSerializer(StrictMediaSerializer):
    image = serializers.ImageField(validators=[validate_product_image])
    alt_text = serializers.CharField(max_length=180, required=False, allow_blank=True, default="")
    is_main = serializers.BooleanField(required=False, default=False)
    order = serializers.IntegerField(min_value=0, max_value=2147483647, required=False, default=0)


class ProductImageMetadataSerializer(StrictMediaSerializer):
    alt_text = serializers.CharField(max_length=180, required=False, allow_blank=True)
    is_main = serializers.BooleanField(required=False)
    order = serializers.IntegerField(min_value=0, max_value=2147483647, required=False)

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError("Indica al menos un dato de la imagen para actualizar.")
        return attrs


class TechnicalSheetUploadSerializer(StrictMediaSerializer):
    file = serializers.FileField(validators=[validate_technical_sheet])


def owned_product(request, product_id, *, locked=False):
    if locked:
        # This order also matches administrative onboarding. Recheck access after
        # validating bytes and before persisting a file or changing ownership data.
        user = User.objects.select_for_update(no_key=True).filter(pk=request.user.pk).first()
        if user is None or not user.is_active or user.role != User.Role.SELLER:
            raise PermissionDenied("Tu cuenta ya no tiene permisos de vendedor.")
        seller = SellerProfile.objects.select_for_update().filter(user=user, is_active=True).first()
        if seller is None:
            raise PermissionDenied("Tu perfil comercial no está activo.")
        return get_object_or_404(Product.objects.select_for_update(), pk=product_id, seller=seller)
    return get_object_or_404(Product, pk=product_id, seller__user=request.user, seller__is_active=True)


@method_decorator(transaction.non_atomic_requests, name="dispatch")
class SellerProductImageListCreateView(GenericAPIView):
    permission_classes = [IsActiveSeller]
    parser_classes = [MultiPartParser, FormParser]
    serializer_class = ProductImageUploadSerializer

    @extend_schema(responses=ProductImageSerializer(many=True))
    def get(self, request, pk):
        product = owned_product(request, pk)
        return Response(ProductImageSerializer(product.images.all(), many=True, context={"request": request}).data)

    @extend_schema(request=ProductImageUploadSerializer, responses={201: ProductImageSerializer})
    def post(self, request, pk):
        # Validate the product before processing a file for an unrelated seller.
        owned_product(request, pk)
        payload = self.get_serializer(data=request.data)
        payload.is_valid(raise_exception=True)
        image = None
        try:
            with transaction.atomic():
                product = owned_product(request, pk, locked=True)
                if product.images.count() >= MAX_PRODUCT_IMAGES:
                    raise serializers.ValidationError({"image": "El producto admite como máximo 12 imágenes."})
                image = ProductImage(product=product, **payload.validated_data)
                image.save()
        except Exception:
            # Include errors at the outer transaction boundary, after FileField
            # wrote to storage but before the database committed the new row.
            if image is not None and image.image and image.image._committed:
                if not ProductImage.objects.filter(image=image.image.name).exists():
                    image.image.storage.delete(image.image.name)
            raise
        return Response(ProductImageSerializer(image, context={"request": request}).data, status=status.HTTP_201_CREATED)


@method_decorator(transaction.non_atomic_requests, name="dispatch")
class SellerProductImageDetailView(GenericAPIView):
    permission_classes = [IsActiveSeller]
    serializer_class = ProductImageMetadataSerializer

    @extend_schema(request=ProductImageMetadataSerializer, responses=ProductImageSerializer)
    def patch(self, request, pk, image_id):
        payload = self.get_serializer(data=request.data)
        payload.is_valid(raise_exception=True)
        with transaction.atomic():
            product = owned_product(request, pk, locked=True)
            image = get_object_or_404(ProductImage.objects.select_for_update(), pk=image_id, product=product)
            for field, value in payload.validated_data.items():
                setattr(image, field, value)
            image.save(update_fields=[*payload.validated_data, "updated_at"])
        return Response(ProductImageSerializer(image, context={"request": request}).data)

    @extend_schema(responses={204: None})
    def delete(self, request, pk, image_id):
        with transaction.atomic():
            product = owned_product(request, pk, locked=True)
            image = get_object_or_404(ProductImage.objects.select_for_update(), pk=image_id, product=product)
            image.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@method_decorator(transaction.non_atomic_requests, name="dispatch")
class SellerProductTechnicalSheetView(GenericAPIView):
    permission_classes = [IsActiveSeller]
    parser_classes = [MultiPartParser, FormParser]
    serializer_class = TechnicalSheetUploadSerializer

    @extend_schema(request=TechnicalSheetUploadSerializer, responses=SellerProductSerializer)
    def post(self, request, pk):
        owned_product(request, pk)
        payload = self.get_serializer(data=request.data)
        payload.is_valid(raise_exception=True)
        product = None
        try:
            with transaction.atomic():
                product = owned_product(request, pk, locked=True)
                product.technical_sheet = payload.validated_data["file"]
                product.save(update_fields=["technical_sheet", "updated_at"])
        except Exception:
            if product is not None and product.technical_sheet and product.technical_sheet._committed:
                if not Product.objects.filter(technical_sheet=product.technical_sheet.name).exists():
                    product.technical_sheet.storage.delete(product.technical_sheet.name)
            raise
        return Response(SellerProductSerializer(product, context={"request": request}).data)

    @extend_schema(responses={204: None})
    def delete(self, request, pk):
        with transaction.atomic():
            product = owned_product(request, pk, locked=True)
            product.technical_sheet = ""
            product.save(update_fields=["technical_sheet", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)
