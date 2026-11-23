import { api } from "../lib/api";
import type { ListResponse } from "../types/api";

export async function requestList<T>(url: string, signal?: AbortSignal): Promise<T[]> {
  const { data } = await api.get<ListResponse<T>>(url, { signal, timeout: 15_000 });
  const items = Array.isArray(data) ? data : data?.results;
  if (!Array.isArray(items)) throw new Error("La API no devolvió una lista.");
  return items;
}
