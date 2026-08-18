import type { CartItem } from "../types/cart";

export function getCartItemProductId(item: CartItem): number {
  if (typeof item.product === "object") {
    return item.product.id;
  }

  if (typeof item.product === "number") {
    return item.product;
  }

  return item.product_id || 0;
}

export function getCartItemProductName(
  item: CartItem
): string {
  if (typeof item.product === "object") {
    return item.product.name;
  }

  return item.product_name || "Producto";
}

export function getCartItemProductSlug(
  item: CartItem
): string | null {
  if (typeof item.product === "object") {
    return item.product.slug;
  }

  return item.product_slug || null;
}

export function getCartItemProductSku(
  item: CartItem
): string {
  if (typeof item.product === "object") {
    return item.product.sku;
  }

  return item.product_sku || "";
}

export function getCartItemAvailableStock(
  item: CartItem
): number | null {
  if (typeof item.product === "object") {
    return item.product.stock;
  }

  return item.available_stock ?? null;
}

export function getCartItemSubtotal(
  item: CartItem
): number {
  const backendSubtotal =
    item.subtotal ||
    item.total_price ||
    item.line_total;

  if (backendSubtotal !== undefined) {
    return Number(backendSubtotal);
  }

  return Number(item.unit_price) * item.quantity;
}