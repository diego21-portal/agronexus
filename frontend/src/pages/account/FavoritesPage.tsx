import { useEffect, useState } from "react";
import { ProductCard } from "../../features/products/ProductCard";
import {
  deleteFavoriteById,
  getFavorites,
} from "../../services/favoriteService";
import type { Favorite } from "../../types/favorite";
import { getApiErrorMessage } from "../../utils/apiError";

export function FavoritesPage() {
  const [favorites, setFavorites] =
    useState<Favorite[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  async function loadFavorites() {
    try {
      setLoading(true);

      const data =
        await getFavorites();

      setFavorites(data);
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

  async function handleRemove(
    favoriteId: number
  ) {
    try {
      await deleteFavoriteById(favoriteId);

      setFavorites((current) =>
        current.filter(
          (favorite) =>
            favorite.id !== favoriteId
        )
      );
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "No se pudo quitar el favorito."
        )
      );
    }
  }

  useEffect(() => {
    void loadFavorites();
  }, []);

  return (
    <section>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">
          Productos favoritos
        </h2>

        <p className="mt-1 text-gray-600">
          Productos que guardaste para consultar más tarde.
        </p>
      </div>

      {error && (
        <div className="mb-5 rounded-lg bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p>Cargando favoritos...</p>
      ) : favorites.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          No guardaste productos todavía.
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {favorites.map((favorite) => (
            <div
              key={favorite.id}
              className="relative"
            >
              <ProductCard
                product={favorite.product}
              />

              <button
                type="button"
                onClick={() =>
                  handleRemove(favorite.id)
                }
                className="absolute right-3 top-3 rounded-full bg-white px-3 py-2 text-sm font-bold text-red-700 shadow"
              >
                ♥
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}