import { api } from "../lib/api";
import type { ProductImage } from "../types/product";
import type { SellerProduct } from "../types/seller";

// Disable the JSON default. The browser supplies the multipart boundary.
const multipart = { headers: { "Content-Type": false as const } };
const productPath = (productId: number) => `/seller/products/${productId}/`;

export async function uploadProductImage(productId: number, image: File, altText: string): Promise<ProductImage> {
  const body = new FormData();
  body.append("image", image);
  body.append("alt_text", altText.trim());
  return (await api.post<ProductImage>(`${productPath(productId)}images/`, body, multipart)).data;
}

export async function updateProductImage(productId: number, imageId: number, values: {
  alt_text?: string; is_main?: boolean; order?: number;
}): Promise<ProductImage> {
  return (await api.patch<ProductImage>(`${productPath(productId)}images/${imageId}/`, values)).data;
}

export async function deleteProductImage(productId: number, imageId: number): Promise<void> {
  await api.delete(`${productPath(productId)}images/${imageId}/`);
}

export async function uploadTechnicalSheet(productId: number, file: File): Promise<SellerProduct> {
  const body = new FormData();
  body.append("file", file);
  return (await api.post<SellerProduct>(`${productPath(productId)}technical-sheet/`, body, multipart)).data;
}

export async function deleteTechnicalSheet(productId: number): Promise<void> {
  await api.delete(`${productPath(productId)}technical-sheet/`);
}
