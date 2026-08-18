import {
  useEffect,
  useState,
} from "react";

import {
  adjustSellerStock,
  getSellerProducts,
} from "../../services/sellerService";

import type { SellerProduct } from "../../types/seller";

import { getApiErrorMessage } from "../../utils/apiError";

export function SellerStockPage() {
  const [products, setProducts] =
    useState<SellerProduct[]>([]);

  const [selectedProduct, setSelectedProduct] =
    useState<SellerProduct | null>(null);

  const [quantity, setQuantity] =
    useState(1);

  const [movementType, setMovementType] =
    useState("ENTRY");

  const [reason, setReason] =
    useState("");

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  async function loadProducts() {
    setProducts(
      await getSellerProducts()
    );
  }

  useEffect(() => {
    void loadProducts();
  }, []);

  async function handleAdjustment() {
    if (!selectedProduct) {
      return;
    }

    try {
      setError("");
      setMessage("");

      await adjustSellerStock(
        selectedProduct.id,
        {
          movement_type:
            movementType,
          quantity,
          reason,
        }
      );

      setMessage(
        "Stock actualizado correctamente."
      );

      setSelectedProduct(null);
      setReason("");
      setQuantity(1);

      await loadProducts();
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "No se pudo actualizar el stock."
        )
      );
    }
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-bold">
        Gestión de stock
      </h2>

      <p className="mt-1 text-gray-600">
        Controlá inventario y movimientos de productos.
      </p>

      {error && (
        <div className="mt-5 rounded-lg bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="mt-5 rounded-lg bg-green-50 p-4 text-green-700">
          {message}
        </div>
      )}

      <div className="mt-6 space-y-3">
        {products.map(
          (product) => {
            const lowStock =
              product.stock <=
              product.minimum_stock;

            return (
              <article
                key={product.id}
                className={
                  lowStock
                    ? "rounded-xl border border-red-200 bg-red-50 p-5"
                    : "rounded-xl border border-gray-200 p-5"
                }
              >
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                  <div>
                    <h3 className="font-bold">
                      {product.name}
                    </h3>

                    <p className="mt-1 text-sm text-gray-500">
                      SKU{" "}
                      {product.sku}
                    </p>
                  </div>

                  <div className="flex items-center gap-6">
                    <div>
                      <p className="text-xs text-gray-500">
                        Stock
                      </p>

                      <p className="text-2xl font-bold">
                        {product.stock}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">
                        Mínimo
                      </p>

                      <p className="font-bold">
                        {
                          product.minimum_stock
                        }
                      </p>
                    </div>

                    <button
                      onClick={() =>
                        setSelectedProduct(
                          product
                        )
                      }
                      className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
                    >
                      Ajustar
                    </button>
                  </div>
                </div>
              </article>
            );
          }
        )}
      </div>

      {selectedProduct && (
        <div className="mt-7 rounded-2xl border border-green-200 bg-green-50 p-6">
          <h3 className="font-bold">
            Ajustar stock de{" "}
            {
              selectedProduct.name
            }
          </h3>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <select
              value={movementType}
              onChange={(event) =>
                setMovementType(
                  event.target.value
                )
              }
              className="rounded-lg border px-3 py-2"
            >
              <option value="ENTRY">
                Entrada
              </option>

              <option value="EXIT">
                Salida
              </option>

              <option value="MANUAL_ADJUSTMENT">
                Ajuste manual
              </option>
            </select>

            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(event) =>
                setQuantity(
                  Number(
                    event.target.value
                  )
                )
              }
              className="rounded-lg border px-3 py-2"
            />

            <input
              placeholder="Motivo..."
              value={reason}
              onChange={(event) =>
                setReason(
                  event.target.value
                )
              }
              className="rounded-lg border px-3 py-2"
            />
          </div>

          <div className="mt-5 flex gap-3">
            <button
              onClick={
                handleAdjustment
              }
              className="rounded-lg bg-green-700 px-5 py-2 font-medium text-white"
            >
              Confirmar
            </button>

            <button
              onClick={() =>
                setSelectedProduct(
                  null
                )
              }
              className="rounded-lg border px-5 py-2"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}