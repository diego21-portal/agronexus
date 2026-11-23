import {
  useEffect,
  useState,
  type ChangeEvent,
} from "react";
import { Link } from "react-router";
import { useCart } from "../features/cart/CartContext";
import type { CartItem } from "../types/cart";
import { getApiErrorMessage } from "../utils/apiError";
import {
  getCartItemAvailableStock,
  getCartItemProductName,
  getCartItemProductSku,
  getCartItemProductSlug,
  getCartItemSubtotal,
} from "../utils/cart";
import { formatCurrency } from "../utils/currency";

export function CartPage() {
  const {
    cart,
    loading,
    operationLoading,
    error: loadError,
    refreshCart,
    subtotal,
    changeQuantity,
    removeItem,
    clearAll,
  } = useCart();

  const [quantities, setQuantities] = useState<
    Record<number, number>
  >({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!cart) {
      return;
    }

    const nextQuantities = cart.items.reduce<
      Record<number, number>
    >((result, item) => {
      result[item.id] = item.quantity;
      return result;
    }, {});

    setQuantities(nextQuantities);
  }, [cart]);

  function handleQuantityChange(
    event: ChangeEvent<HTMLInputElement>,
    item: CartItem
  ): void {
    const quantity = Number(event.target.value);

    setQuantities((current) => ({
      ...current,
      [item.id]: quantity,
    }));
  }

  async function handleUpdate(item: CartItem): Promise<void> {
    const quantity = quantities[item.id];
    const availableStock = getCartItemAvailableStock(item);

    if (!Number.isInteger(quantity) || quantity < 1) {
      setError("La cantidad debe ser mayor que cero.");
      return;
    }

    if (
      availableStock !== null &&
      quantity > availableStock
    ) {
      setError(
        `Solo hay ${availableStock} unidad(es) disponibles.`
      );
      return;
    }

    try {
      setError("");
      setMessage("");

      await changeQuantity(item.id, quantity);
      setMessage("Cantidad actualizada correctamente.");
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "No se pudo actualizar la cantidad."
        )
      );
    }
  }

  async function handleRemove(itemId: number): Promise<void> {
    const confirmed = window.confirm(
      "¿Querés quitar este producto del carrito?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setMessage("");

      await removeItem(itemId);
      setMessage("Producto eliminado del carrito.");
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "No se pudo eliminar el producto."
        )
      );
    }
  }

  async function handleClear(): Promise<void> {
    const confirmed = window.confirm(
      "¿Querés vaciar completamente el carrito?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setMessage("");

      await clearAll();
      setMessage("Carrito vaciado correctamente.");
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "No se pudo vaciar el carrito."
        )
      );
    }
  }

  if (loading && !cart) {
    return (
      <div className="rounded-2xl bg-white p-10 shadow-sm">
        Cargando carrito...
      </div>
    );
  }

  const items = cart?.items || [];

  if (loadError) {
    return (
      <div role="alert" className="rounded-2xl bg-red-50 p-10 text-red-700">
        <p>{loadError}</p>
        <button
          type="button"
          disabled={loading}
          onClick={() => void refreshCart().catch(() => undefined)}
          className="mt-4 rounded-lg border border-red-300 px-4 py-2 disabled:opacity-50"
        >
          {loading ? "Cargando..." : "Reintentar"}
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
        <p className="text-6xl">🛒</p>

        <h1 className="mt-5 text-3xl font-bold">
          Tu carrito está vacío
        </h1>

        <p className="mt-2 text-gray-600">
          Explorá el catálogo y agregá productos agrícolas.
        </p>

        <Link
          to="/products"
          className="mt-6 inline-block rounded-lg bg-green-700 px-5 py-3 font-medium text-white hover:bg-green-800"
        >
          Ver productos
        </Link>
      </div>
    );
  }

  const hasInvalidStock = items.some((item) => {
    const stock = getCartItemAvailableStock(item);

    return stock !== null && item.quantity > stock;
  });

  return (
    <div>
      <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="font-display text-4xl text-agro-forest sm:text-5xl">
            Carrito de compras
          </h1>

          <p className="mt-1 text-gray-600">
            Revisá cantidades y disponibilidad antes de continuar.
          </p>
        </div>

        <button
          type="button"
          onClick={handleClear}
          disabled={operationLoading}
          className="min-h-11 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-50 disabled:opacity-50"
        >
          Vaciar carrito
        </button>
      </div>

      {error && (
        <div role="alert" className="mb-5 rounded-lg bg-red-50 p-4 text-red-800">
          {error}
        </div>
      )}

      {message && (
        <div role="status" className="mb-5 rounded-lg bg-green-50 p-4 text-green-800">
          {message}
        </div>
      )}

      {hasInvalidStock && (
        <div className="mb-5 rounded-lg bg-yellow-50 p-4 text-yellow-800">
          Uno o más productos superan el stock disponible.
          Corregí las cantidades antes de continuar.
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:gap-7">
        <section aria-label="Productos del carrito" className="min-w-0 space-y-4">
          {items.map((item) => {
            const slug = getCartItemProductSlug(item);
            const stock = getCartItemAvailableStock(item);
            const quantity =
              quantities[item.id] ?? item.quantity;

            return (
              <article
                key={item.id}
                className="min-w-0 rounded-2xl border border-agro-line bg-white p-4 sm:p-5"
              >
                <div className="flex flex-col justify-between gap-5 md:flex-row">
                  <div className="min-w-0 flex-1 break-words">
                    {slug ? (
                      <Link
                        to={`/products/${slug}`}
                        className="text-lg font-bold hover:text-green-700"
                      >
                        {getCartItemProductName(item)}
                      </Link>
                    ) : (
                      <h2 className="text-lg font-bold">
                        {getCartItemProductName(item)}
                      </h2>
                    )}

                    <p className="mt-1 text-sm text-gray-500">
                      SKU: {getCartItemProductSku(item) || "—"}
                    </p>

                    <p className="mt-3 text-sm text-gray-600">
                      Precio unitario:{" "}
                      <strong>
                        {formatCurrency(item.unit_price)}
                      </strong>
                    </p>

                    {stock !== null && (
                      <p
                        className={
                          quantity <= stock
                            ? "mt-1 text-sm text-green-700"
                            : "mt-1 text-sm font-medium text-red-700"
                        }
                      >
                        Stock disponible: {stock}
                      </p>
                    )}
                  </div>

                  <div className="min-w-0 md:w-48 md:shrink-0">
                    <label htmlFor={`cart-quantity-${item.id}`} className="mb-1 block text-sm font-medium">
                      Cantidad
                    </label>

                    <div className="flex gap-2">
                      <input
                        id={`cart-quantity-${item.id}`}
                        type="number"
                        min={1}
                        max={stock ?? undefined}
                        value={quantity}
                        onChange={(event) =>
                          handleQuantityChange(event, item)
                        }
                        className="min-h-11 w-0 min-w-0 flex-1 rounded-lg border border-agro-control px-2.5 text-base"
                      />

                      <button
                        type="button"
                        onClick={() => handleUpdate(item)}
                        disabled={
                          operationLoading ||
                          quantity === item.quantity
                        }
                        className="min-h-11 shrink-0 rounded-lg bg-agro-forest px-3 text-sm font-semibold text-white disabled:bg-agro-mist disabled:text-agro-muted"
                      >
                        Actualizar
                      </button>
                    </div>

                    <p className="mt-4 text-right text-lg font-bold text-green-700">
                      {formatCurrency(
                        getCartItemSubtotal(item)
                      )}
                    </p>

                    <button
                      type="button"
                      onClick={() => handleRemove(item.id)}
                      disabled={operationLoading}
                      className="mt-2 min-h-11 w-full rounded-lg text-sm font-medium text-red-800 hover:bg-red-50 disabled:opacity-40"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <aside className="h-fit min-w-0 rounded-2xl border border-agro-line bg-white p-4 sm:p-6 lg:sticky lg:top-32">
          <h2 className="text-xl font-bold">
            Resumen de compra
          </h2>

          <div className="mt-5 space-y-3 border-b pb-5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">
                Productos
              </span>
              <span>{items.length}</span>
            </div>

            <div className="flex justify-between gap-3">
              <span className="text-gray-600">
                Envío
              </span>
              <span className="text-right">Se calcula al revisar</span>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap justify-between gap-x-3 text-lg font-bold">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>

          {hasInvalidStock ? (
            <button
              disabled
              className="mt-6 w-full rounded-lg bg-gray-300 px-5 py-3 font-medium text-gray-600"
            >
              Corregir cantidades
            </button>
          ) : (
            <Link
              to="/checkout"
              className="mt-6 block w-full rounded-lg bg-agro-forest px-4 py-3 text-center font-semibold text-white hover:bg-agro-deep"
            >
              Continuar compra
            </Link>
          )}

          <Link
            to="/products"
            className="mt-3 block text-center text-sm font-medium text-green-700"
          >
            Seguir comprando
          </Link>
        </aside>
      </div>
    </div>
  );
}
