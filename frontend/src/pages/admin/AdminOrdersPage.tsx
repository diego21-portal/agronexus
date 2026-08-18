import {
  useEffect,
  useState,
} from "react";

import { Link } from "react-router";

import { getAdminOrders } from "../../services/adminService";

import type {
  AdminOrder,
} from "../../types/admin";

import { StatusBadge } from "../../features/seller/StatusBadge";

import { formatCurrency } from "../../utils/currency";
import { getApiErrorMessage } from "../../utils/apiError";

export function AdminOrdersPage() {
  const [orders, setOrders] =
    useState<AdminOrder[]>([]);

  const [status, setStatus] =
    useState("");

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function load() {
      try {
        setOrders(
          await getAdminOrders()
        );
      } catch (requestError) {
        setError(
          getApiErrorMessage(
            requestError,
            "No se pudieron cargar las órdenes."
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
      <div className="flex justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">
            Órdenes
          </h2>

          <p className="mt-1 text-gray-600">
            Todas las operaciones del marketplace.
          </p>
        </div>

        <select
          value={status}
          onChange={(event) =>
            setStatus(
              event.target.value
            )
          }
          className="h-fit rounded-lg border px-3 py-2"
        >
          <option value="">
            Todos
          </option>

          <option value="PENDING">
            Pendiente
          </option>

          <option value="PAID">
            Pagado
          </option>

          <option value="PREPARING">
            Preparando
          </option>

          <option value="SHIPPED">
            Despachado
          </option>

          <option value="DELIVERED">
            Entregado
          </option>

          <option value="CANCELLED">
            Cancelado
          </option>
        </select>
      </div>

      {error && (
        <div className="mt-5 rounded-lg bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 space-y-3">
        {filtered.map(
          (order) => (
            <Link
              key={order.id}
              to={`/admin/orders/${order.id}`}
              className="flex flex-col justify-between gap-4 rounded-xl border p-5 hover:border-green-400 md:flex-row md:items-center"
            >
              <div>
                <p className="font-bold">
                  {
                    order.order_number
                  }
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  {new Date(
                    order.created_at
                  ).toLocaleString(
                    "es-AR"
                  )}
                </p>
              </div>

              <StatusBadge
                status={
                  order.status
                }
              />

              <p className="text-lg font-bold text-green-700">
                {formatCurrency(
                  order.total
                )}
              </p>
            </Link>
          )
        )}
      </div>
    </section>
  );
}