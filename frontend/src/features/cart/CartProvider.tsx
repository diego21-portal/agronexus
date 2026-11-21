import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import { addCartItem, clearCart, deleteCartItem, getCart, updateCartItem } from "../../services/cartService";
import type { Cart } from "../../types/cart";
import { CartContext, type CartContextValue } from "./CartContext";

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, authenticated, loading: authLoading } = useAuth();
  const userId = user?.id;
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);
  const [operationLoading, setOperationLoading] = useState(false);
  const [error, setError] = useState("");
  const account = useRef<number | undefined>(undefined);
  const requestVersion = useRef(0);
  const checkedOutCarts = useRef(new Set<number>());

  const resetCartState = useCallback(() => {
    requestVersion.current += 1;
    setCart(null);
    setLoading(false);
    setError("");
  }, []);

  const refreshCart = useCallback(async (): Promise<void> => {
    if (!authenticated || userId === undefined || account.current !== userId) return;
    const version = ++requestVersion.current;
    setLoading(true);
    setError("");
    try {
      const data = await getCart();
      if (version === requestVersion.current) setCart(checkedOutCarts.current.has(data.id) ? null : data);
    } catch (requestError) {
      if (version === requestVersion.current) setError("No se pudo cargar el carrito.");
      throw requestError;
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [authenticated, userId]);

  const runMutation = useCallback(async (operation: () => Promise<unknown>) => {
    if (!authenticated || userId === undefined || account.current !== userId) {
      throw new Error("Debés iniciar sesión para modificar el carrito.");
    }
    setOperationLoading(true);
    try {
      await operation();
      if (account.current === userId) await refreshCart();
    } finally {
      if (account.current === userId) setOperationLoading(false);
    }
  }, [authenticated, userId, refreshCart]);

  const addItem = useCallback(async (productId: number, quantity: number) => {
    await runMutation(() => addCartItem({ product_id: productId, quantity }));
  }, [runMutation]);

  const changeQuantity = useCallback(async (itemId: number, quantity: number) => {
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error("La cantidad debe ser un entero mayor que cero.");
    }
    await runMutation(() => updateCartItem(itemId, { quantity }));
  }, [runMutation]);

  const removeItem = useCallback(async (itemId: number) => {
    await runMutation(() => deleteCartItem(itemId));
  }, [runMutation]);

  const clearAll = useCallback(async () => {
    await runMutation(() => clearCart());
  }, [runMutation]);

  const acknowledgeCheckout = useCallback((cartId: number) => {
    if (!authenticated || userId === undefined || account.current !== userId) return;
    checkedOutCarts.current.add(cartId);
    // Only acknowledge the purchased source. A different active cart may
    // already contain a new purchase and must never be deleted on the server.
    setCart((current) => current?.id === cartId ? null : current);
  }, [authenticated, userId]);

  useEffect(() => {
    account.current = userId;
    checkedOutCarts.current.clear();
    resetCartState();
    setOperationLoading(false);
    if (!authLoading) {
      // refreshCart expone el error en el contexto; se captura la promesa inicial.
      void refreshCart().catch(() => undefined);
    }
    return () => {
      account.current = undefined;
      requestVersion.current += 1;
    };
  }, [authLoading, userId, refreshCart, resetCartState]);

  const itemCount = useMemo(() => cart?.items.reduce((total, item) => total + item.quantity, 0) ?? 0, [cart]);
  const subtotal = Number(cart?.subtotal || cart?.total || 0);

  const value = useMemo<CartContextValue>(() => ({
    cart, loading, operationLoading, error, itemCount, subtotal,
    refreshCart, addItem, changeQuantity, removeItem, clearAll, resetCartState, acknowledgeCheckout,
  }), [cart, loading, operationLoading, error, itemCount, subtotal,
    refreshCart, addItem, changeQuantity, removeItem, clearAll, resetCartState, acknowledgeCheckout]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
