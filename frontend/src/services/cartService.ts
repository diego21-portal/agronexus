import { api } from "../lib/api";
import type {
  AddCartItemRequest,
  Cart,
  CartItem,
  UpdateCartItemRequest,
} from "../types/cart";

export async function getCart(): Promise<Cart> {
  const response = await api.get<Cart>("/cart/");
  return response.data;
}

export async function addCartItem(
  data: AddCartItemRequest
): Promise<CartItem> {
  const response = await api.post<CartItem>(
    "/cart/items/",
    data
  );

  return response.data;
}

export async function updateCartItem(
  itemId: number,
  data: UpdateCartItemRequest
): Promise<CartItem> {
  const response = await api.patch<CartItem>(
    `/cart/items/${itemId}/`,
    data
  );

  return response.data;
}

export async function deleteCartItem(
  itemId: number
): Promise<void> {
  await api.delete(`/cart/items/${itemId}/delete/`);
}

export async function clearCart(): Promise<void> {
  await api.delete("/cart/clear/");
}