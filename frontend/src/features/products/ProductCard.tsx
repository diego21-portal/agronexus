import { useState } from "react";
import { Link } from "react-router";
import type { CatalogProduct } from "../../types/product";
import { getMediaUrl } from "../../utils/mediaUrl";
import { ProductPrice } from "./ProductPrice";

interface ProductCardProps {
  product: CatalogProduct;
  headingLevel?: 2 | 3;
}

export function ProductCard({ product, headingLevel = 2 }: ProductCardProps) {
  const [failedImage, setFailedImage] = useState<string>();
  const image = getMediaUrl(product.main_image);
  const Heading = headingLevel === 3 ? "h3" : "h2";

  return (
    <article className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-agro-line bg-white hover:border-agro-forest hover:shadow-sm focus-within:ring-2 focus-within:ring-agro-forest focus-within:ring-offset-2">
      <div className="relative grid aspect-[4/3] place-items-center overflow-hidden bg-agro-cream">
        {image && image !== failedImage ? (
          <img
            src={image}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setFailedImage(image)}
            className="absolute inset-0 h-full w-full object-contain"
          />
        ) : (
          <p className="text-sm font-medium text-agro-muted">Sin imagen</p>
        )}
        {product.stock <= 0 && (
          <span className="absolute left-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-semibold text-red-900">
            Agotado
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-agro-muted">{product.category}</p>
        <Heading className="mt-1.5 break-words text-lg font-bold leading-tight text-agro-forest group-hover:underline group-hover:underline-offset-4">
          <Link to={`/products/${product.slug}`} className="after:absolute after:inset-0">
            {product.name}
          </Link>
        </Heading>
        <p className="mt-1.5 break-words text-xs text-agro-muted">SKU {product.sku}</p>
        <p className="mt-1 break-words text-sm text-agro-muted">{product.seller} · {product.region}</p>

        <div className="mt-auto pt-4">
          <ProductPrice price={product.price} discountPrice={product.discount_price} currentPrice={product.current_price} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-agro-line pt-3 text-sm">
            <span className={product.stock > 0 ? "font-semibold text-agro-forest" : "font-semibold text-red-800"}>
              {product.stock === 1 ? "1 disponible" : product.stock > 1 ? `${product.stock} disponibles` : "Sin stock"}
            </span>
            {product.total_reviews > 0 && (
              <span className="text-agro-muted">
                <span aria-hidden="true">★ </span>
                <span className="sr-only">Valoración </span>
                {product.average_rating} ({product.total_reviews})
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
