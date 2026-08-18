import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { useAuth } from "../features/auth/AuthContext";
import { ProductGallery } from "../features/products/ProductGallery";
import { ProductPrice } from "../features/products/ProductPrice";
import { ProductQuestionsSection } from "../features/products/ProductQuestionsSection";
import { ProductReviewsSection } from "../features/products/ProductReviewsSection";
import { useCart } from "../features/cart/CartContext";
import {
  addFavorite,
  getFavoriteStatus,
  removeFavorite,
} from "../services/favoriteService";
import { getProductBySlug } from "../services/productService";
import type { Product } from "../types/product";

export function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { authenticated } = useAuth();
  const { addItem } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [favorite, setFavorite] = useState(false);

  const [loading, setLoading] = useState(true);
  const [cartLoading, setCartLoading] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadProduct() {
    if (!slug) return;

    try {
      setLoading(true);
      setError("");

      const productData = await getProductBySlug(slug);
      setProduct(productData);

      if (authenticated) {
        try {
          const favoriteData = await getFavoriteStatus(slug);
          setFavorite(favoriteData.is_favorite);
        } catch {
          setFavorite(false);
        }
      }
    } catch {
      setError("No se pudo cargar el producto.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddToCart() {
    if (!product) return;

    if (!authenticated) {
      setError("Debés iniciar sesión para agregar productos al carrito.");
      return;
    }

    if (quantity < 1 || quantity > product.stock) {
      setError("La cantidad seleccionada no es válida.");
      return;
    }

    try {
      setCartLoading(true);
      setError("");
      setMessage("");

      await addItem(product.id, quantity);

      setMessage("Producto agregado al carrito correctamente.");
    } catch {
      setError(
        "No se pudo agregar el producto. Revisá el stock disponible."
      );
    } finally {
      setCartLoading(false);
    }
  }

  async function handleFavorite() {
    if (!slug) return;

    if (!authenticated) {
      setError("Debés iniciar sesión para guardar favoritos.");
      return;
    }

    try {
      setFavoriteLoading(true);
      setError("");

      if (favorite) {
        await removeFavorite(slug);
        setFavorite(false);
        setMessage("Producto eliminado de favoritos.");
      } else {
        await addFavorite(slug);
        setFavorite(true);
        setMessage("Producto agregado a favoritos.");
      }
    } catch {
      setError("No se pudo actualizar el favorito.");
    } finally {
      setFavoriteLoading(false);
    }
  }

  useEffect(() => {
    loadProduct();
  }, [slug, authenticated]);

  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-10 shadow-sm">
        Cargando producto...
      </div>
    );
  }

  if (error && !product) {
    return (
      <div className="rounded-2xl bg-red-50 p-10 text-red-700">
        <p>{error}</p>
        <Link
          to="/products"
          className="mt-4 inline-block font-medium underline"
        >
          Volver al catálogo
        </Link>
      </div>
    );
  }

  if (!product || !slug) {
    return null;
  }

  const category =
    product.category?.name ||
    product.category_name ||
    "Sin categoría";

  const brand =
    product.brand?.name ||
    product.brand_name ||
    "Sin marca";

  const region =
    product.region?.name ||
    product.region_name ||
    "Sin región";

  const seller =
    product.seller?.business_name ||
    product.seller_name ||
    "Vendedor AgroNexus";

  return (
    <div>
      <div className="mb-6 text-sm text-gray-500">
        <Link to="/products" className="hover:text-green-700">
          Productos
        </Link>
        <span className="mx-2">/</span>
        <span>{product.name}</span>
      </div>

      <section className="grid gap-8 lg:grid-cols-2">
        <ProductGallery
          productName={product.name}
          images={product.images}
        />

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
              {category}
            </span>

            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs">
              {brand}
            </span>

            {product.is_featured && (
              <span className="rounded-full bg-yellow-50 px-3 py-1 text-xs text-yellow-700">
                Destacado
              </span>
            )}
          </div>

          <h1 className="text-3xl font-bold">{product.name}</h1>

          <p className="mt-2 text-sm text-gray-500">
            SKU: {product.sku}
          </p>

          <div className="mt-5">
            <ProductPrice
              price={product.price}
              discountPrice={product.discount_price}
              currentPrice={product.current_price}
              large
            />
          </div>

          <div className="mt-4 flex items-center gap-4 text-sm">
            <span>⭐ {product.average_rating || "0.00"}</span>
            <span>{product.total_reviews || 0} reseña(s)</span>
          </div>

          <p className="mt-5 text-gray-700">
            {product.short_description}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
            <Info label="Condición" value={product.condition} />
            <Info label="Unidad" value={product.unit} />
            <Info label="Región" value={region} />
            <Info
              label="Envío"
              value={
                product.shipping_available
                  ? "Disponible"
                  : "No disponible"
              }
            />
          </div>

          <div className="mt-6 rounded-xl bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Vendido por</p>
            <p className="font-bold">{seller}</p>
          </div>

          <div className="mt-6">
            <p
              className={
                product.stock > 0
                  ? "font-semibold text-green-700"
                  : "font-semibold text-red-600"
              }
            >
              {product.stock > 0
                ? `${product.stock} unidad(es) disponibles`
                : "Producto sin stock"}
            </p>
          </div>

          {product.stock > 0 && (
            <div className="mt-5 flex items-end gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Cantidad
                </label>

                <input
                  type="number"
                  min={1}
                  max={product.stock}
                  value={quantity}
                  onChange={(event) =>
                    setQuantity(Number(event.target.value))
                  }
                  className="w-24 rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-green-700"
                />
              </div>

              <button
                onClick={handleAddToCart}
                disabled={cartLoading}
                className="flex-1 rounded-lg bg-green-700 px-5 py-2 font-medium text-white hover:bg-green-800 disabled:opacity-60"
              >
                {cartLoading
                  ? "Agregando..."
                  : "Agregar al carrito"}
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleFavorite}
            disabled={favoriteLoading}
            className={
              favorite
                ? "mt-3 w-full rounded-lg border border-red-300 bg-red-50 px-5 py-2 font-medium text-red-700"
                : "mt-3 w-full rounded-lg border border-gray-300 px-5 py-2 font-medium hover:bg-gray-50"
            }
          >
            {favoriteLoading
              ? "Actualizando..."
              : favorite
                ? "♥ Quitar de favoritos"
                : "♡ Agregar a favoritos"}
          </button>

          {message && (
            <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
              {message}
            </p>
          )}

          {error && product && (
            <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>
      </section>

      <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold">Descripción</h2>
        <p className="mt-4 whitespace-pre-line text-gray-700">
          {product.description}
        </p>

        {product.technical_description && (
          <>
            <h3 className="mt-7 text-xl font-bold">
              Información técnica
            </h3>
            <p className="mt-3 whitespace-pre-line text-gray-700">
              {product.technical_description}
            </p>
          </>
        )}

        {product.warranty && (
          <>
            <h3 className="mt-7 text-xl font-bold">Garantía</h3>
            <p className="mt-3 text-gray-700">{product.warranty}</p>
          </>
        )}
      </section>

      <div className="mt-8 grid gap-8">
        <ProductQuestionsSection slug={slug} />
        <ProductReviewsSection slug={slug} />
      </div>
    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <p className="text-xs uppercase text-gray-500">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}