import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  createProductReview,
  getProductReviews,
} from "../../services/productSocialService";
import type { ProductReview } from "../../types/productSocial";

interface ProductReviewsSectionProps {
  slug: string;
}

export function ProductReviewsSection({
  slug,
}: ProductReviewsSectionProps) {
  const { authenticated } = useAuth();

  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [orderItemId, setOrderItemId] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadReviews() {
    try {
      setLoading(true);
      setError("");

      const data = await getProductReviews(slug);
      setReviews(data);
    } catch {
      setError("No se pudieron cargar las reseñas.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedOrderItemId = Number(orderItemId);

    if (!Number.isInteger(parsedOrderItemId) || parsedOrderItemId <= 0) {
      setError("Ingresá un ID de producto comprado válido.");
      return;
    }

    try {
      setSending(true);
      setError("");
      setMessage("");

      await createProductReview(slug, {
        order_item_id: parsedOrderItemId,
        rating,
        comment,
      });

      setOrderItemId("");
      setRating(5);
      setComment("");
      setShowForm(false);
      setMessage("Reseña publicada correctamente.");

      await loadReviews();
    } catch {
      setError(
        "No se pudo publicar. Verificá que compraste el producto, que fue entregado y que no lo reseñaste antes."
      );
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    loadReviews();
  }, [slug]);

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-bold">Reseñas</h2>
          <p className="mt-1 text-sm text-gray-600">
            Opiniones de compradores verificados.
          </p>
        </div>

        {authenticated && (
          <button
            type="button"
            onClick={() => setShowForm((current) => !current)}
            className="rounded-lg border border-green-700 px-4 py-2 font-medium text-green-700 hover:bg-green-50"
          >
            {showForm ? "Cancelar" : "Escribir reseña"}
          </button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mt-5 space-y-4 rounded-xl border border-gray-200 p-4"
        >
          <div>
            <label className="mb-1 block text-sm font-medium">
              ID del ítem comprado
            </label>
            <input
              type="number"
              min="1"
              value={orderItemId}
              onChange={(event) => setOrderItemId(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-green-700"
            />

            <p className="mt-1 text-xs text-gray-500">
              Por ahora podés obtenerlo desde el detalle de una orden. Más
              adelante lo seleccionaremos automáticamente.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Calificación
            </label>
            <select
              value={rating}
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
            <label className="mb-1 block text-sm font-medium">
              Comentario
            </label>
            <textarea
              value={comment}
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
        <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
          {message}
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
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