import { api } from "../lib/api";
import { extractResults } from "../types/api";
import type { PaginatedResponse } from "../types/api";
import type {
  Brand,
  CatalogProduct,
  CatalogProductDetail,
  Category,
  ProductFilters,
  Region,
} from "../types/product";
import { requestList } from "./listRequest";

export async function getProducts(
  filters: ProductFilters = {}
): Promise<CatalogProduct[]> {
  return extractResults(await getProductPage(filters));
}

export async function getProductPage(
  filters: ProductFilters = {},
  signal?: AbortSignal,
): Promise<PaginatedResponse<CatalogProduct>> {
  const { data } = await api.get<PaginatedResponse<CatalogProduct>>(
    "/products/",
    { params: filters, signal, timeout: 15_000 }
  );
  if (!Array.isArray(data?.results) || !Number.isSafeInteger(data.count) || data.count < 0) {
    throw new Error("Respuesta de catálogo inválida.");
  }
  return data;
}

export function getFeaturedProducts(signal?: AbortSignal): Promise<CatalogProduct[]> {
  return requestList("/products/featured/", signal);
}

export async function getProductBySlug(
  slug: string
): Promise<CatalogProductDetail> {
  const response = await api.get<CatalogProductDetail>(
    `/products/${slug}/`
  );

  return response.data;
}

export function getCategories(signal?: AbortSignal): Promise<Category[]> {
  return requestList("/categories/", signal);
}

export function getBrands(signal?: AbortSignal): Promise<Brand[]> {
  return requestList("/brands/", signal);
}

export function getRegions(signal?: AbortSignal): Promise<Region[]> {
  return requestList("/regions/", signal);
}
