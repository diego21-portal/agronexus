import { useEffect, useState } from "react";
import { getMyReturns } from "../../services/returnService";
import type { ReturnRequest } from "../../types/return";
import { getApiErrorMessage } from "../../utils/apiError";
import { formatCurrency } from "../../utils/currency";

export function ReturnsPage() {
  const [returns, setReturns] =
    useState<ReturnRequest[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function load() {
      try {
        setReturns(
          await getMyReturns()
        );
      } catch (requestError) {
        setError(
          getApiErrorMessage(
            requestError,
            "No se pudieron cargar las devoluciones."
          )
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-bold">
        Mis devoluciones
      </h2>

      <p className="mt-1 text-gray-600">
        Estado de tus solicitudes de devolución.
      </p>

      {error && (
        <div className="mt-5 rounded-lg bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="mt-6">
          Cargando...
        </p>
      ) : returns.length === 0 ? (
        <p className="mt-6 rounded-xl bg-gray-50 p-6 text-center">
          No tenés solicitudes de devolución.
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {returns.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-gray-200 p-5"
            >
              <div className="flex justify-between gap-4">
                <div>
                  <h3 className="font-bold">
                    {item.product_name ||
                      `Ítem ${item.order_item}`}
                  </h3>

                  <p className="mt-1 text-sm text-gray-500">
                    {item.order_number}
                  </p>
                </div>

                <span className="h-fit rounded-full bg-gray-100 px-3 py-1 text-sm">
                  {item.status}
                </span>
              </div>

              <p className="mt-4">
                {item.description}
              </p>

              <p className="mt-3 text-sm text-gray-500">
                Cantidad: {item.quantity}
              </p>

              {item.approved_refund_amount && (
                <p className="mt-2 font-bold text-green-700">
                  Reembolso aprobado:{" "}
                  {formatCurrency(
                    item.approved_refund_amount
                  )}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}