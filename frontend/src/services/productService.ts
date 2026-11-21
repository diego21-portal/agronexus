import { api } from "../lib/api";
import { extractResults } from "../types/api";
import type { ListResponse, PaginatedResponse } from "../types/api";
import type {
  Brand,
  CatalogProduct,
  CatalogProductDetail,
  Category,
  ProductFilters,
  Region,
} from "../types/product";

export async function getProducts(
  filters: ProductFilters = {}
): Promise<CatalogProduct[]> {
  return extractResults(await getProductPage(filters));
}

export async function getProductPage(
  filters: ProductFilters = {}
): Promise<PaginatedResponse<CatalogProduct>> {
  const response = await api.get<PaginatedResponse<CatalogProduct>>(
    "/products/",
    { params: filters }
  );

  return response.data;
}

export async function getFeaturedProducts(): Promise<CatalogProduct[]> {
  const response = await api.get<ListResponse<CatalogProduct>>(
    "/products/featured/"
  );

  return extractResults(response.data);
}

export async function getProductBySlug(
  slug: string
): Promise<CatalogProductDetail> {
  const response = await api.get<CatalogProductDetail>(
    `/products/${slug}/`
  );

  return response.data;
}

export async function getCategories(): Promise<Category[]> {
  const response = await api.get<ListResponse<Category>>(
    "/categories/"
  );

  return extractResults(response.data);
}

export async function getBrands(): Promise<Brand[]> {
  const response = await api.get<ListResponse<Brand>>(
    "/brands/"
  );

  return extractResults(response.data);
}

export async function getRegions(): Promise<Region[]> {
  const response = await api.get<ListResponse<Region>>(
    "/regions/"
  );

  return extractResults(response.data);
}
