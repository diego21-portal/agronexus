import { useEffect, useState, type FormEvent } from "react";
import {
  adjustSellerStock,
  getSellerProducts,
} from "../../services/sellerService";
import type {
  SellerProduct,
  StockAdjustmentPayload,
} from "../../types/seller";
import { getApiErrorMessage } from "../../utils/apiError";

export function SellerStockPage() {
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<SellerProduct | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [movementType, setMovementType] =
    useState<StockAdjustmentPayload["movement_type"]>("RESTOCK");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadProducts() {
      try {
        const data = await getSellerProducts();
        if (active) setProducts(data);
      } catch (requestError) {
        if (active) {
          setError(getApiErrorMessage(requestError, "No se pudieron cargar los productos."));
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadProducts();
    return () => { active = false; };
  }, []);

  async function handleAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProduct || saving) return;

    setError("");
    setMessage("");

    const amount = Number(quantity);

    if (!Number.isSafeInteger(amount) || amount === 0) {
      setError("Ingresá una cantidad entera distinta de cero.");
      return;
    }

    if (movementType === "RESTOCK" && amount < 0) {
      setError("La reposición debe sumar unidades.");
      return;
    }

    setSaving(true);

    try {
      await adjustSellerStock(selectedProduct.id, {
        movement_type: movementType,
        quantity: amount,
        reason: reason.trim(),
      });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "No se pudo actualizar el stock."));
      setSaving(false);
      return;
    }

    setSelectedProduct(null);
    setQuantity("1");
    setMovementType("RESTOCK");
    setReason("");
    setMessage("Stock actualizado correctamente.");

    try {
      setProducts(await getSellerProducts());
    } catch {
      setError("El movimiento se guardó, pero no se pudo refrescar la lista. Recargá la página para consultar el stock.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-bold">Gestión de stock</h2>
      <p className="mt-1 text-gray-600">Controlá el inventario de tus productos.</p>

      {error && (
        <p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-red-700">
          {error}
        </p>
      )}

      {message && (
        <p role="status" className="mt-5 rounded-lg bg-green-50 p-4 text-green-700">
          {message}
        </p>
      )}

      {loading && <p className="mt-5">Cargando productos...</p>}

      {!loading && !error && products.length === 0 && (
        <p className="mt-5">Todavía no tenés productos.</p>
      )}

      <div className="mt-6 space-y-3">
        {products.map((product) => (
          <article
            key={product.id}
            className={product.stock <= product.minimum_stock
              ? "rounded-xl border border-red-200 bg-red-50 p-5"
              : "rounded-xl border border-gray-200 p-5"}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-bold">{product.name}</h3>
                <p className="text-sm text-gray-500">SKU {product.sku}</p>
              </div>
              <p>Stock: <strong>{product.stock}</strong></p>
              <p>Mínimo: {product.minimum_stock}</p>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setSelectedProduct(product);
                  setQuantity("1");
                  setMovementType("RESTOCK");
                  setReason("");
                  setError("");
                  setMessage("");
                }}
                className="rounded-lg bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
              >
                Ajustar
              </button>
            </div>
          </article>
        ))}
      </div>

      {selectedProduct && (
        <form
          onSubmit={handleAdjustment}
          className="mt-7 rounded-2xl border border-green-200 bg-green-50 p-6"
        >
          <h3 className="font-bold">Ajustar stock de {selectedProduct.name}</h3>

          <fieldset disabled={saving} className="mt-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <label>
                Tipo de movimiento
                <select
                  value={movementType}
                  onChange={(event) => setMovementType(
                    event.target.value === "RESTOCK" ? "RESTOCK" : "MANUAL_ADJUSTMENT"
                  )}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                >
                  <option value="RESTOCK">Reposición</option>
                  <option value="MANUAL_ADJUSTMENT">Ajuste manual</option>
                </select>
              </label>

              <label>
                Cantidad
                <input
                  type="number"
                  step="1"
                  min={movementType === "RESTOCK" ? 1 : undefined}
                  required
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                />
              </label>

              <label>
                Motivo
                <input
                  value={reason}
                  maxLength={255}
                  onChange={(event) => setReason(event.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                />
              </label>
            </div>

            <p className="text-sm text-gray-600">
              Reposición: sumá unidades, por ejemplo 5. Ajuste manual: usá 5 para
              sumar o -2 para descontar. No ingreses el stock total.
            </p>

            <div className="flex gap-3">
              <button
                type="submit"
                className="rounded-lg bg-green-700 px-5 py-2 font-medium text-white disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Confirmar"}
              </button>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="rounded-lg border px-5 py-2"
              >
                Cancelar
              </button>
            </div>
          </fieldset>
        </form>
      )}
    </section>
  );
}
