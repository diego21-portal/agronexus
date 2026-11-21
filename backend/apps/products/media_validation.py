"""Validation and storage names for public product attachments.

PDF checks establish a plausible document, not an antivirus or content scan.
"""
from pathlib import Path
import re
import uuid
import warnings

from django.core.exceptions import ValidationError
from PIL import Image, UnidentifiedImageError


IMAGE_MAX_BYTES = 5 * 1024 * 1024
PDF_MAX_BYTES = 10 * 1024 * 1024
IMAGE_MAX_PIXELS = 20_000_000
IMAGE_MAX_DIMENSION = 8000
IMAGE_FORMAT_EXTENSIONS = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp"}


def validate_product_image(value):
    if getattr(value, "_committed", False):
        # Existing paths are historical data. Validate bytes when replaced,
        # not when editing metadata or reading an old/missing attachment.
        return
    if value.size > IMAGE_MAX_BYTES:
        raise ValidationError("La imagen no puede superar 5 MiB.")
    if Path(value.name).suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
        raise ValidationError("Sube una imagen JPEG, PNG o WebP.")
    position = value.tell()
    try:
        value.seek(0)
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(value) as picture:
                extension = IMAGE_FORMAT_EXTENSIONS.get(picture.format)
                if extension is None:
                    raise ValidationError("El contenido debe ser una imagen JPEG, PNG o WebP.")
                if (picture.width > IMAGE_MAX_DIMENSION or picture.height > IMAGE_MAX_DIMENSION
                        or picture.width * picture.height > IMAGE_MAX_PIXELS):
                    raise ValidationError("La imagen supera las dimensiones permitidas (8000 px y 20 megapíxeles).")
                if getattr(picture, "n_frames", 1) != 1:
                    raise ValidationError("Las imágenes animadas no están admitidas.")
                picture.verify()
            value.seek(0)
            with Image.open(value) as picture:
                picture.load()
        value._agronexus_image_extension = extension
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError,
            Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise ValidationError("El archivo no contiene una imagen válida y legible.") from exc
    finally:
        value.seek(position)


def validate_technical_sheet(value):
    if getattr(value, "_committed", False):
        return
    if value.size > PDF_MAX_BYTES:
        raise ValidationError("La ficha PDF no puede superar 10 MiB.")
    if Path(value.name).suffix.lower() != ".pdf":
        raise ValidationError("La ficha técnica debe ser un archivo PDF.")
    position = value.tell()
    try:
        value.seek(0)
        content = value.read(PDF_MAX_BYTES + 1)
        if len(content) > PDF_MAX_BYTES:
            raise ValidationError("La ficha PDF no puede superar 10 MiB.")
        if (not re.match(rb"%PDF-(?:1\.[0-7]|2\.0)(?:\r\n|\r|\n)", content)
                or b"obj" not in content or b"endobj" not in content
                or not re.search(rb"startxref\s+\d+\s+%%EOF\s*$", content[-2048:])):
            raise ValidationError("El archivo no contiene una estructura PDF reconocible.")
    finally:
        value.seek(position)


def product_image_path(instance, filename):
    upload = instance.image.file
    extension = getattr(upload, "_agronexus_image_extension", None)
    if extension is None:
        validate_product_image(upload)
        extension = upload._agronexus_image_extension
    return f"products/images/{uuid.uuid4().hex}{extension}"


def technical_sheet_path(instance, filename):
    return f"products/documents/{uuid.uuid4().hex}.pdf"
