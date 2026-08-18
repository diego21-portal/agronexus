import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "../auth/AuthContext";
import {
  addCartItem,
  clearCart,
  deleteCartItem,
  getCart,
  updateCartItem,
} from "../../services/cartService";
import type { Cart } from "../../types/cart";

interface CartContextValue {
  cart: Cart | null;
  loading: boolean;
  operationLoading: boolean;
  itemCount: number;
  subtotal: number;
  refreshCart: () => Promise<void>;
  addItem: (
    productId: number,
    quantity: number
  ) => Promise<void>;
  changeQuantity: (
    itemId: number,
    quantity: number
  ) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  clearAll: () => Promise<void>;
  resetCartState: () => void;
}

const CartContext =
  createContext<CartContextValue | undefined>(undefined);

export function CartProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { authenticated, loading: authLoading } = useAuth();

  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);
  const [operationLoading, setOperationLoading] =
    useState(false);

  async function refreshCart(): Promise<void> {
    if (!authenticated) {
      setCart(null);
      return;
    }

    try {
      setLoading(true);
      const cartData = await getCart();
      setCart(cartData);
    } finally {
      setLoading(false);
    }
  }

  async function addItem(
    productId: number,
    quantity: number
  ): Promise<void> {
    try {
      setOperationLoading(true);

      await addCartItem({
        product_id: productId,
        quantity,
      });

      await refreshCart();
    } finally {
      setOperationLoading(false);
    }
  }

  async function changeQuantity(
    itemId: number,
    quantity: number
  ): Promise<void> {
    if (quantity < 1) {
      throw new Error("La cantidad debe ser mayor que cero.");
    }

    try {
      setOperationLoading(true);

      await updateCartItem(itemId, {
        quantity,
      });

      await refreshCart();
    } finally {
      setOperationLoading(false);
    }
  }

  async function removeItem(itemId: number): Promise<void> {
    try {
      setOperationLoading(true);
      await deleteCartItem(itemId);
      await refreshCart();
    } finally {
      setOperationLoading(false);
    }
  }

  async function clearAll(): Promise<void> {
    try {
      setOperationLoading(true);
      await clearCart();
      await refreshCart();
    } finally {
      setOperationLoading(false);
    }
  }

  function resetCartState(): void {
    setCart(null);
  }

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (authenticated) {
      void refreshCart();
    } else {
      setCart(null);
    }
  }, [authenticated, authLoading]);

  const itemCount = useMemo(() => {
    if (!cart) {
      return 0;
    }

    return cart.items.reduce(
      (total, item) => total + item.quantity,
      0
    );
  }, [cart]);

  const subtotal = useMemo(() => {
    if (!cart) {
      return 0;
    }

    return Number(cart.subtotal || cart.total || 0);
  }, [cart]);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      loading,
      operationLoading,
      itemCount,
      subtotal,
      refreshCart,
      addItem,
      changeQuantity,
      removeItem,
      clearAll,
      resetCartState,
    }),
    [cart, loading, operationLoading, itemCount, subtotal]
  );

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error(
      "useCart debe utilizarse dentro de CartProvider."
    );
  }

  return context;
}