import { api } from "../lib/api";
import {
  extractResults,
  type ListResponse,
} from "../types/api";
import type { Favorite } from "../types/favorite";
import type { FavoriteStatus } from "../types/productSocial";

export async function getFavorites(): Promise<Favorite[]> {
  const response =
    await api.get<ListResponse<Favorite>>("/favorites/");

  return extractResults(response.data);
}

export async function getFavoriteStatus(
  slug: string
): Promise<FavoriteStatus> {
  const response = await api.get<FavoriteStatus>(
    `/products/${slug}/favorite/status/`
  );

  return response.data;
}

export async function addFavorite(
  slug: string
): Promise<void> {
  await api.post(`/products/${slug}/favorite/`);
}

export async function removeFavorite(
  slug: string
): Promise<void> {
  await api.delete(`/products/${slug}/favorite/`);
}

export async function deleteFavoriteById(
  favoriteId: number
): Promise<void> {
  await api.delete(`/favorites/${favoriteId}/`);
}