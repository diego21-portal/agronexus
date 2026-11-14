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
  const selectedImage =
    orderedImages.find((image) => image.id === selectedImageId) || orderedImages[0];

  if (orderedImages.length === 0) {
    return (
      <div className="flex min-h-96 items-center justify-center rounded-2xl bg-gray-100 text-center text-gray-400">
        <div>
          <p className="text-6xl">🌱</p>
          <p className="mt-3">Producto sin imágenes</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex min-h-96 items-center justify-center overflow-hidden rounded-2xl bg-white">
        <img
          src={getMediaUrl(selectedImage.image)}
          alt={productName}
          className="max-h-[500px] w-full object-contain"
        />
      </div>

      {orderedImages.length > 1 && (
        <div className="mt-3 flex gap-3 overflow-x-auto">
          {orderedImages.map((image) => (
            <button
              key={image.id}
              type="button"
              aria-label={`Ver imagen ${image.id} de ${productName}`}
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