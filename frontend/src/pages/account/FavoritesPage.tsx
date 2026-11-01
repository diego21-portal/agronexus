import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ProductPrice } from "../../features/products/ProductPrice";
import {
  deleteFavoriteById,
  getFavorites,
} from "../../services/favoriteService";
import type { Favorite } from "../../types/favorite";
import { getApiErrorMessage } from "../../utils/apiError";
import { getMediaUrl } from "../../utils/mediaUrl";

export function FavoritesPage() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState<number | null>(null);

  async function loadFavorites() {
    try {
      setLoading(true);
      setError("");
      setFavorites(await getFavorites());
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "No se pudieron cargar los favoritos."
        )
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(favoriteId: number) {
    if (removingId !== null) return;

    try {
      setRemovingId(favoriteId);
      setError("");

      await deleteFavoriteById(favoriteId);

      setFavorites((current) =>
        current.filter((item) => item.id !== favoriteId)
      );
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "No se pudo quitar el favorito."
        )
      );
    } finally {
      setRemovingId(null);
    }
  }

  useEffect(() => {
    void loadFavorites();
  }, []);

  return (
    <section>
      <h2 className="text-2xl font-bold">
        Productos favoritos
      </h2>

      <p className="mb-6 mt-2 text-gray-600">
        Productos que guardaste para consultar más tarde.
      </p>

      {error && (
        <p
          role="alert"
          className="mb-5 rounded-lg bg-red-50 p-4 text-red-700"
        >
          {error}
        </p>
      )}

      {loading ? (
        <p>Cargando favoritos...</p>
      ) : favorites.length === 0 ? (
        error ? (
          <button
            type="button"
            onClick={() => void loadFavorites()}
            className="rounded-lg border px-4 py-2"
          >
            Reintentar
          </button>
        ) : (
          <p className="rounded-2xl bg-white p-8 text-center shadow-sm">
            No guardaste productos todavía.
          </p>
        )
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {favorites.map((favorite) => {
            const image = getMediaUrl(favorite.main_image);

            const available =
              favorite.product_status === "PUBLISHED" &&
              favorite.product_stock > 0;

            return (
              <article
                key={favorite.id}
                className="flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm"
              >
                <div className="flex h-52 items-center justify-center bg-gray-100">
                  {image ? (
                    <img
                      src={image}
                      alt={favorite.product_name}
                      loading="lazy"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="text-gray-500">
                      Producto sin imagen
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-4 p-5">
                  <h3 className="font-bold">
                    {favorite.product_name}
                  </h3>

                  <ProductPrice
                    price={favorite.product_price}
                    discountPrice={favorite.product_discount_price}
                    currentPrice={favorite.product_current_price}
                  />

                  <p className="text-sm text-gray-600">
                    {available
                      ? `${favorite.product_stock} disponibles`
                      : "No disponible actualmente"}
                  </p>

                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
                    {available && (
                      <Link
                        to={`/products/${favorite.product_slug}`}
                        className="font-semibold text-green-700"
                      >
                        Ver producto
                      </Link>
                    )}

                    <button
                      type="button"
                      disabled={removingId !== null}
                      onClick={() => void handleRemove(favorite.id)}
                      aria-label={`Quitar de favoritos ${favorite.product_name}`}
                      className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
                    >
                      {removingId === favorite.id
                        ? "Quitando..."
                        : "Quitar de favoritos"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}