import {
  useEffect,
  useState,
} from "react";

import { Link } from "react-router";

import { getSellerOrders } from "../../services/sellerService";

import type { Order } from "../../types/order";

import { StatusBadge } from "../../features/seller/StatusBadge";

import { formatCurrency } from "../../utils/currency";
import { getApiErrorMessage } from "../../utils/apiError";

export function SellerOrdersPage() {
  const [orders, setOrders] =
    useState<Order[]>([]);

  const [status, setStatus] =
    useState("");

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function load() {
      try {
        setOrders(
          await getSellerOrders()
        );
      } catch (requestError) {
        setError(
          getApiErrorMessage(
            requestError,
            "No se pudieron cargar los pedidos."
          )
        );
      }
    }

    void load();
  }, []);

  const filtered =
    status
      ? orders.filter(
          (order) =>
            order.status ===
            status
        )
      : orders;

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-4 md:flex-row">
        <div>
          <h2 className="text-2xl font-bold">
            Pedidos recibidos
          </h2>

          <p className="mt-1 text-gray-600">
            Gestioná las ventas de tus productos.
          </p>
        </div>

        <select
          value={status}
          onChange={(event) =>
            setStatus(
              event.target.value
            )
          }
          className="rounded-lg border px-4 py-2"
        >
          <option value="">
            Todos
          </option>

          <option value="PAID">
            Pagados
          </option>

          <option value="PREPARING">
            Preparando
          </option>

          <option value="SHIPPED">
            Despachados
          </option>

          <option value="DELIVERED">
            Entregados
          </option>
        </select>
      </div>

      {error && (
        <div className="mt-5 rounded-lg bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 space-y-4">
        {filtered.map(
          (order) => (
            <article
              key={order.id}
              className="rounded-xl border border-gray-200 p-5"
            >
              <div className="flex flex-col justify-between gap-4 md:flex-row">
                <div>
                  <Link
                    to={`/seller/orders/${order.id}`}
                    className="text-lg font-bold hover:text-green-700"
                  >
                    {
                      order.order_number
                    }
                  </Link>

                  <p className="mt-1 text-sm text-gray-500">
                    {new Date(
                      order.created_at
                    ).toLocaleString(
                      "es-AR"
                    )}
                  </p>
                </div>

                <div className="md:text-right">
                  <p className="text-xl font-bold text-green-700">
                    {formatCurrency(
                      order.total
                    )}
                  </p>

                  <div className="mt-2">
                    <StatusBadge
                      status={
                        order.status
                      }
                    />
                  </div>
                </div>
              </div>
            </article>
          )
        )}
      </div>
    </section>
  );
}