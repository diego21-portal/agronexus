import { useState } from "react";
import type { ProductImage } from "../../types/product";
import { getMediaUrl } from "../../utils/mediaUrl";

interface ProductGalleryProps {
  productName: string;
  images?: ProductImage[];
}

export function ProductGallery({
  productName,
  images = [],
}: ProductGalleryProps) {
  const orderedImages = [...images].sort(
    (first, second) =>
      Number(Boolean(second.is_main)) - Number(Boolean(first.is_main))
  );

  const [selectedImageId, setSelectedImageId] = useState<number | null>(null);
  const [failedImage, setFailedImage] = useState<string>();
  const selectedImage =
    orderedImages.find((image) => image.id === selectedImageId) || orderedImages[0];
  const src = getMediaUrl(selectedImage?.image);

  return (
    <div className="min-w-0">
      <div className="grid min-h-56 place-items-center overflow-hidden rounded-2xl border border-agro-line bg-agro-cream sm:min-h-72">
        {src && src !== failedImage ? (
          <img
            src={src}
            alt={selectedImage.alt_text || productName}
            onError={() => setFailedImage(src)}
            className="max-h-[500px] w-full object-contain"
          />
        ) : (
          <p className="p-5 text-center font-medium text-agro-muted">
            {orderedImages.length ? "Imagen no disponible" : "Producto sin imágenes"}
          </p>
        )}
      </div>

      {orderedImages.length > 1 && (
        <div className="mt-3 flex gap-3 overflow-x-auto">
          {orderedImages.map((image, index) => (
            <button
              key={image.id}
              type="button"
              aria-label={`Ver imagen ${index + 1} de ${productName}`}
              aria-pressed={selectedImage.id === image.id}
              onClick={() => setSelectedImageId(image.id)}
              className={
                selectedImage.id === image.id
                  ? "h-20 w-20 shrink-0 overflow-hidden rounded-lg border-2 border-green-700"
                  : "h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-gray-200"
              }
            >
              <img
                src={getMediaUrl(image.image)}
                alt={image.alt_text || productName}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
