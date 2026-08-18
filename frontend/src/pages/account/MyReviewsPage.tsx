import { useEffect, useState } from "react";
import { getMyReviews } from "../../services/accountActivityService";
import type { ProductReview } from "../../types/productSocial";
import { getApiErrorMessage } from "../../utils/apiError";

export function MyReviewsPage() {
  const [reviews, setReviews] =
    useState<ProductReview[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function load() {
      try {
        setReviews(
          await getMyReviews()
        );
      } catch (requestError) {
        setError(
          getApiErrorMessage(
            requestError,
            "No se pudieron cargar tus reseñas."
          )
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-bold">
        Mis reseñas
      </h2>

      {error && (
        <div className="mt-5 rounded-lg bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="mt-6">Cargando...</p>
      ) : reviews.length === 0 ? (
        <p className="mt-6 text-gray-600">
          Todavía no publicaste reseñas.
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {reviews.map((review) => (
            <article
              key={review.id}
              className="rounded-xl border p-5"
            >
              <div className="flex justify-between">
                <p className="font-bold">
                  {review.product_name ||
                    "Producto"}
                </p>

                <p className="text-yellow-600">
                  {"★".repeat(
                    review.rating
                  )}
                  <span className="text-gray-300">
                    {"★".repeat(
                      5 - review.rating
                    )}
                  </span>
                </p>
              </div>

              <p className="mt-4">
                {review.comment}
              </p>

              <p className="mt-3 text-xs text-gray-500">
                {new Date(
                  review.created_at
                ).toLocaleDateString(
                  "es-AR"
                )}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}