import { AdminResourceState } from "../../features/admin/AdminResourceState";
import { AdminPagination } from "../../features/admin/AdminPagination";
import { useAdminList } from "../../features/admin/useAdminList";
import {
  useState,
} from "react";

import { Link } from "react-router";

import { getAdminOrders } from "../../services/adminService";

import { StatusBadge } from "../../features/seller/StatusBadge";

import { formatCurrency } from "../../utils/currency";

export function AdminOrdersPage() {
  const [status, setStatus] = useState("");
  const { data, loading, error, reload, changePage } = useAdminList(
    getAdminOrders, "No se pudieron cargar las órdenes.", { status },
  );
  const orders = data?.results ?? [];

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex justify-between gap-4">
        <div>
          <h2 id="admin-orders-heading" tabIndex={-1} className="text-2xl font-bold">
            Órdenes
          </h2>

          <p className="mt-1 text-gray-600">
            Todas las operaciones del marketplace.
          </p>
        </div>

        <select
          aria-label="Filtrar órdenes por estado"
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

          <option value="CONFIRMED">
            Confirmado
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
          <option value="PROBLEM">
            Con problema
          </option>
        </select>
      </div>

      <AdminResourceState loading={loading} error={error} empty={orders.length === 0}
        loadingText="Cargando órdenes..." emptyText="No se encontraron órdenes." onRetry={reload} />

      {orders.length > 0 && (
      <div className="mt-6 space-y-3">
        {orders.map(
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
      )}
      {data && data.count > 0 && <AdminPagination data={data} headingId="admin-orders-heading" onPage={changePage} />}
    </section>
  );
}
