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
          <p className="text-sm font-semibold uppercase tracking-wide text-green-700">
            Tu compra
          </p>

          <h1 className="text-3xl font-bold">
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
          className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          Vaciar carrito
        </button>
      </div>

      {error && (
        <div className="mb-5 rounded-lg bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="mb-5 rounded-lg bg-green-50 p-4 text-green-700">
          {message}
        </div>
      )}

      {hasInvalidStock && (
        <div className="mb-5 rounded-lg bg-yellow-50 p-4 text-yellow-800">
          Uno o más productos superan el stock disponible.
          Corregí las cantidades antes de continuar.
        </div>
      )}

      <div className="grid gap-7 lg:grid-cols-[1fr_360px]">
        <section className="space-y-4">
          {items.map((item) => {
            const slug = getCartItemProductSlug(item);
            const stock = getCartItemAvailableStock(item);
            const quantity =
              quantities[item.id] ?? item.quantity;

            return (
              <article
                key={item.id}
                className="rounded-2xl bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col justify-between gap-5 md:flex-row">
                  <div className="flex-1">
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

                  <div className="w-full md:w-56">
                    <label className="mb-1 block text-sm font-medium">
                      Cantidad
                    </label>

                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={1}
                        max={stock ?? undefined}
                        value={quantity}
                        onChange={(event) =>
                          handleQuantityChange(event, item)
                        }
                        className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-green-700"
                      />

                      <button
                        type="button"
                        onClick={() => handleUpdate(item)}
                        disabled={
                          operationLoading ||
                          quantity === item.quantity
                        }
                        className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
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
                      className="mt-3 w-full text-sm font-medium text-red-700 hover:underline disabled:opacity-40"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <aside className="h-fit rounded-2xl bg-white p-6 shadow-sm lg:sticky lg:top-6">
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

            <div className="flex justify-between">
              <span className="text-gray-600">
                Subtotal
              </span>
              <span>{formatCurrency(subtotal)}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">
                Envío
              </span>
              <span>Se calcula al confirmar</span>
            </div>
          </div>

          <div className="mt-5 flex justify-between text-lg font-bold">
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
              className="mt-6 block w-full rounded-lg bg-green-700 px-5 py-3 text-center font-medium text-white hover:bg-green-800"
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