import { Link } from "react-router";

import type {
  Product,
} from "../../types/product";

import {
  getMediaUrl,
} from "../../utils/mediaUrl";

import {
  ProductPrice,
} from "./ProductPrice";

interface ProductCardProps {
  product: Product;
}

function getMainImage(
  product: Product
) {
  const main =
    product.images?.find(
      (image) =>
        image.is_main
    );

  return (
    main?.image ||
    product.images?.[0]
      ?.image ||
    null
  );
}

export function ProductCard({
  product,
}: ProductCardProps) {
  const image =
    getMediaUrl(
      getMainImage(product)
    );

  const category =
    product.category?.name ||
    product.category_name ||
    "AgroNexus";

  return (
    <Link
      to={`/products/${product.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:border-green-300 hover:shadow-lg"
    >
      <div className="relative flex h-52 items-center justify-center overflow-hidden bg-gray-100">
        {image ? (
          <img
            src={image}
            alt={
              product.name
            }
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="text-center text-gray-400">
            <div className="text-5xl">
              🌱
            </div>

            <p className="mt-2 text-sm">
              Sin imagen
            </p>
          </div>
        )}

        {product.is_featured && (
          <span className="absolute left-3 top-3 rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-800 shadow-sm">
            Destacado
          </span>
        )}

        {product.stock <= 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-gray-900">
              Sin stock
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
          {category}
        </p>

        <h2 className="mt-2 line-clamp-2 font-bold leading-6 text-gray-900 group-hover:text-green-700">
          {product.name}
        </h2>

        <p className="mt-2 line-clamp-2 text-sm leading-5 text-gray-500">
          {product.short_description}
        </p>

        <div className="mt-5">
          <ProductPrice
            price={
              product.price
            }
            discountPrice={
              product.discount_price
            }
            currentPrice={
              product.current_price
            }
          />
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-4 text-xs">
          <span
            className={
              product.stock > 0
                ? "font-semibold text-green-700"
                : "font-semibold text-red-600"
            }
          >
            {product.stock >
            0
              ? `${product.stock} disponibles`
              : "Agotado"}
          </span>

          <span className="text-gray-500">
            ⭐{" "}
            {product.average_rating ||
              "0.0"}{" "}
            (
            {product.total_reviews ||
              0}
            )
          </span>
        </div>
      </div>
    </Link>
  );
}