import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../auth/AuthContext";
import {
  createProductReview,
  getProductReviews,
} from "../../services/productSocialService";
import type { ProductReview } from "../../types/productSocial";

interface ProductReviewsSectionProps {
  slug: string;
  orderItemId?: number | null;
  productName?: string;
}

export function ProductReviewsSection({
  slug,
  orderItemId = null,
  productName,
}: ProductReviewsSectionProps) {
  const { authenticated } = useAuth();

  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const requestVersion = useRef(0);
  const activeProduct = useRef<string | null>(null);
  const selectionVersion = useRef(0);

  const loadReviews = useCallback(async () => {
    if (activeProduct.current !== slug) return;
    const version = ++requestVersion.current;
    try {
      setLoading(true);
      setError("");
      const data = await getProductReviews(slug);
      if (version === requestVersion.current) setReviews(data);
    } catch {
      if (version === requestVersion.current) setError("No se pudieron cargar las reseñas.");
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [slug]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    if (!authenticated || orderItemId === null || !Number.isSafeInteger(orderItemId) || orderItemId <= 0) {
      setError("Elegí un producto entregado desde Mis pedidos para escribir tu reseña.");
      return;
    }
    const version = selectionVersion.current;

    try {
      setSending(true);
      setError("");
      setMessage("");

      await createProductReview(slug, {
        order_item_id: orderItemId,
        rating,
        comment,
      });

      if (activeProduct.current !== slug || version !== selectionVersion.current) return;
      setRating(5);
      setComment("");
      setShowForm(false);
      setMessage("Reseña publicada correctamente.");

      await loadReviews();
    } catch {
      if (activeProduct.current !== slug || version !== selectionVersion.current) return;
      setError(
        "No se pudo publicar. Verificá que compraste el producto, que fue entregado y que no lo reseñaste antes."
      );
    } finally {
      if (activeProduct.current === slug && version === selectionVersion.current) setSending(false);
    }
  }

  useEffect(() => {
    activeProduct.current = slug;
    selectionVersion.current += 1;
    setReviews([]);
    setRating(5);
    setComment("");
    setShowForm(authenticated && orderItemId !== null);
    setSending(false);
    setMessage("");
    void loadReviews();
    return () => {
      activeProduct.current = null;
      requestVersion.current += 1;
      selectionVersion.current += 1;
    };
  }, [slug, orderItemId, authenticated, loadReviews]);

  return (
    <section id="reviews" className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-bold">Reseñas</h2>
          <p className="mt-1 text-sm text-gray-600">
            Opiniones de compradores verificados.
          </p>
        </div>

        {authenticated && orderItemId !== null && (
          <button
            type="button"
            disabled={sending}
            onClick={() => setShowForm((current) => !current)}
            className="rounded-lg border border-green-700 px-4 py-2 font-medium text-green-700 hover:bg-green-50"
          >
            {showForm ? "Cancelar" : "Escribir reseña"}
          </button>
        )}
        {authenticated && orderItemId === null && (
          <Link
            to="/account/orders"
            className="rounded-lg border border-green-700 px-4 py-2 font-medium text-green-700 hover:bg-green-50"
          >
            Elegir compra para reseñar
          </Link>
        )}
      </div>

      {authenticated && orderItemId !== null && showForm && (
        <form
          aria-label="Reseñar compra"
          onSubmit={handleSubmit}
          className="mt-5 space-y-4 rounded-xl border border-gray-200 p-4"
        >
          <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
            Vas a calificar {productName || "este producto"} de la compra seleccionada desde Mis pedidos.
          </p>

          <div>
            <label htmlFor="review-rating" className="mb-1 block text-sm font-medium">
              Calificación
            </label>
            <select
              id="review-rating"
              value={rating}
              disabled={sending}
              onChange={(event) => setRating(Number(event.target.value))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-green-700"
            >
              <option value={5}>5 - Excelente</option>
              <option value={4}>4 - Muy bueno</option>
              <option value={3}>3 - Bueno</option>
              <option value={2}>2 - Regular</option>
              <option value={1}>1 - Malo</option>
            </select>
          </div>

          <div>
            <label htmlFor="review-comment" className="mb-1 block text-sm font-medium">
              Comentario
            </label>
            <textarea
              id="review-comment"
              value={comment}
              disabled={sending}
              onChange={(event) => setComment(event.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-green-700"
            />
          </div>

          <button
            disabled={sending}
            className="rounded-lg bg-green-700 px-4 py-2 font-medium text-white hover:bg-green-800 disabled:opacity-60"
          >
            {sending ? "Publicando..." : "Publicar reseña"}
          </button>
        </form>
      )}

      {message && (
        <p role="status" className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
          {message}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-7 space-y-4">
        {loading ? (
          <p className="text-gray-600">Cargando reseñas...</p>
        ) : reviews.length === 0 ? (
          <p className="text-gray-600">
            Este producto todavía no tiene reseñas.
          </p>
        ) : (
          reviews.map((review) => (
            <article
              key={review.id}
              className="rounded-xl border border-gray-200 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-bold">{review.user_name}</p>

                <p className="text-yellow-600">
                  {"★".repeat(review.rating)}
                  <span className="text-gray-300">
                    {"★".repeat(5 - review.rating)}
                  </span>
                </p>
              </div>

              <p className="mt-3 text-gray-700">
                {review.comment || "Sin comentario."}
              </p>

              <p className="mt-2 text-xs text-gray-500">
                {new Date(review.created_at).toLocaleDateString("es-AR")}
              </p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
