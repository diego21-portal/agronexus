import { api } from "../lib/api";
import type { ListResponse } from "../types/api";
import { extractResults } from "../types/api";
import type {
  Brand,
  Category,
  Product,
  ProductFilters,
  Region,
} from "../types/product";

export async function getProducts(
  filters: ProductFilters = {}
): Promise<Product[]> {
  const response = await api.get<ListResponse<Product>>("/products/", {
    params: filters,
  });

  return extractResults(response.data);
}

export async function getFeaturedProducts(): Promise<Product[]> {
  const response = await api.get<ListResponse<Product>>("/products/featured/");
  return extractResults(response.data);
}

export async function getProductBySlug(slug: string): Promise<Product> {
  const response = await api.get<Product>(`/products/${slug}/`);
  return response.data;
}

export async function getCategories(): Promise<Category[]> {
  const response = await api.get<ListResponse<Category>>("/categories/");
  return extractResults(response.data);
}

export async function getBrands(): Promise<Brand[]> {
  const response = await api.get<ListResponse<Brand>>("/brands/");
  return extractResults(response.data);
}

export async function getRegions(): Promise<Region[]> {
  const response = await api.get<ListResponse<Region>>("/regions/");
  return extractResults(response.data);
}