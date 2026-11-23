import { useEffect, useId, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router";
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
import type { CatalogProductDetail } from "../types/product";
import { getMediaUrl } from "../utils/mediaUrl";

const conditionLabels: Record<string, string> = {
  NEW: "Nuevo",
  USED: "Usado",
  REFURBISHED: "Reacondicionado",
};

export function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { hash } = useLocation();
  const [searchParams] = useSearchParams();
  const selectedItem = searchParams.get("order_item");
  const parsedItem = selectedItem && /^\d+$/.test(selectedItem) ? Number(selectedItem) : NaN;
  const orderItemId = Number.isSafeInteger(parsedItem) && parsedItem > 0 ? parsedItem : null;
  const { authenticated } = useAuth();
  const { addItem } = useCart();
  const quantityId = useId();
  const [revision, setRevision] = useState(0);

  const [product, setProduct] = useState<CatalogProductDetail | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [favorite, setFavorite] = useState(false);

  const [loading, setLoading] = useState(true);
  const [cartLoading, setCartLoading] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");


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
    let active = true;
    setProduct(null);
    setFavorite(false);
    setQuantity(1);
    setMessage("");
    setError("");
    setLoading(true);

    async function loadProduct() {
      if (!slug) {
        if (active) {
          setError("No se pudo cargar el producto.");
          setLoading(false);
        }
        return;
      }
      try {
        const data = await getProductBySlug(slug);
        if (!active) return;
        setProduct(data);
        if (authenticated) {
          try {
            const status = await getFavoriteStatus(slug);
            if (active) setFavorite(status.is_favorite);
          } catch {
            if (active) setFavorite(false);
          }
        }
      } catch {
        if (active) setError("No se pudo cargar el producto.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadProduct();
    return () => { active = false; };
  }, [slug, authenticated, revision]);

  useEffect(() => {
    if (!loading && product && hash === "#reviews") {
      document.getElementById("reviews")?.scrollIntoView?.({ block: "start" });
    }
  }, [loading, product, hash, orderItemId]);

  if (loading) {
    return (
      <div role="status" className="rounded-2xl border border-agro-line bg-white p-6">
        Cargando producto...
      </div>
    );
  }

  if (error && !product) {
    return (
      <div className="rounded-2xl bg-red-50 p-6 text-red-900">
        <p role="alert">{error}</p>
        {slug && (
          <button type="button" onClick={() => setRevision((value) => value + 1)} className="mr-4 mt-4 min-h-11 rounded-lg border border-red-300 bg-white px-4 font-semibold">
            Reintentar
          </button>
        )}
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

  const category = product.category || "Sin categoría";
  const brand = product.brand || "Sin marca";
  const region = product.region || "Sin región";
  const seller = product.seller || "Vendedor AgroNexus";

  return (
    <div>
      <nav aria-label="Ruta del producto" className="mb-4 break-words text-sm text-agro-muted sm:mb-6">
        <Link to="/products" className="font-semibold text-agro-forest underline underline-offset-4">
          Productos
        </Link>
        <span aria-hidden="true" className="mx-2">/</span>
        <span aria-current="page">{product.name}</span>
      </nav>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-7">
        <ProductGallery
          productName={product.name}
          images={product.images}
        />

        <div className="min-w-0 rounded-2xl border border-agro-line bg-white p-4 sm:p-6">
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

          <h1 className="break-words font-display text-3xl leading-tight text-agro-forest sm:text-5xl">{product.name}</h1>

          <p className="mt-2 break-words text-sm text-agro-muted">
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

          {product.total_reviews > 0 && (
            <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-agro-muted">
              <span aria-hidden="true" className="text-agro-ochre">★</span>
              <span>{product.average_rating} · {product.total_reviews} {product.total_reviews === 1 ? "reseña" : "reseñas"}</span>
            </p>
          )}

          <p className="mt-5 text-gray-700">
            {product.short_description}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
            <Info label="Condición" value={conditionLabels[product.condition] || product.condition} />
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
                ? product.stock === 1 ? "1 unidad disponible" : `${product.stock} unidades disponibles`
                : "Producto sin stock"}
            </p>
          </div>

          {product.stock > 0 && (
            <div className="mt-5 grid grid-cols-[auto_minmax(0,1fr)] items-end gap-2 sm:gap-3">
              <div className="min-w-0">
                <label htmlFor={quantityId} className="mb-1 block text-sm font-medium">
                  Cantidad
                </label>

                <input
                  id={quantityId}
                  type="number"
                  min={1}
                  max={product.stock}
                  value={quantity}
                  onChange={(event) =>
                    setQuantity(Number(event.target.value))
                  }
                  className="min-h-11 w-[5rem] rounded-lg border border-agro-control px-2 text-base sm:w-24"
                />
              </div>

              <button
                type="button"
                onClick={handleAddToCart}
                disabled={cartLoading}
                className="min-h-11 rounded-lg bg-agro-forest px-2 py-2 font-semibold text-white hover:bg-agro-deep disabled:opacity-60 sm:px-5"
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
            <p role="status" className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">
              {message}
            </p>
          )}

          {error && product && (
            <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
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

        {product.technical_sheet && (getMediaUrl(product.technical_sheet)
          ? <a href={getMediaUrl(product.technical_sheet)} download className="mt-6 inline-block rounded-lg border border-green-700 px-4 py-2 font-semibold text-green-700">Descargar ficha técnica PDF</a>
          : <p role="alert" className="mt-6 text-red-700">La ficha PDF no está disponible.</p>)}

        {product.warranty && (
          <>
            <h3 className="mt-7 text-xl font-bold">Garantía</h3>
            <p className="mt-3 text-gray-700">{product.warranty}</p>
          </>
        )}
      </section>

      <div className="mt-8 grid gap-8">
        <ProductQuestionsSection slug={slug} />
        <ProductReviewsSection slug={slug} orderItemId={orderItemId} productName={product.name} />
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
