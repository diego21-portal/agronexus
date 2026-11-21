import { createContext, useContext } from "react";
import type { Cart } from "../../types/cart";

export interface CartContextValue {
  cart: Cart | null;
  loading: boolean;
  operationLoading: boolean;
  error: string;
  itemCount: number;
  subtotal: number;
  refreshCart: () => Promise<void>;
  addItem: (productId: number, quantity: number) => Promise<void>;
  changeQuantity: (itemId: number, quantity: number) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  clearAll: () => Promise<void>;
  resetCartState: () => void;
  acknowledgeCheckout?: (cartId: number) => void;
}

export const CartContext = createContext<CartContextValue | undefined>(undefined);

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart debe utilizarse dentro de CartProvider.");
  return context;
}
