import {
  useEffect,
  useState,
} from "react";

import { Link } from "react-router";

import { AdminStatCard } from "../features/admin/AdminStatCard";
import { StatusBadge } from "../features/seller/StatusBadge";

import { getAdminDashboard } from "../services/adminService";

import type {
  AdminDashboard,
  AdminDashboardSummary,
} from "../types/admin";

import { formatCurrency } from "../utils/currency";
import { getApiErrorMessage } from "../utils/apiError";

function extractSummary(
  dashboard: AdminDashboard
): AdminDashboardSummary {
  return {
    total_users:
      dashboard.summary?.total_users ??
      dashboard.total_users ??
      0,

    total_sellers:
      dashboard.summary?.total_sellers ??
      dashboard.total_sellers ??
      0,

    total_products:
      dashboard.summary?.total_products ??
      dashboard.total_products ??
      0,

    total_orders:
      dashboard.summary?.total_orders ??
      dashboard.total_orders ??
      0,

    total_revenue:
      dashboard.summary?.total_revenue ??
      dashboard.summary?.total_sales ??
      dashboard.total_revenue ??
      dashboard.total_sales ??
      0,

    low_stock_products:
      dashboard.summary?.low_stock_products ??
      dashboard.low_stock_products ??
      0,

    out_of_stock_products:
      dashboard.summary?.out_of_stock_products ??
      dashboard.out_of_stock_products ??
      0,

    open_complaints:
      dashboard.summary?.open_complaints ??
      dashboard.open_complaints ??
      0,

    pending_returns:
      dashboard.summary?.pending_returns ??
      dashboard.pending_returns ??
      0,
  };
}

export function AdminDashboardPage() {
  const [dashboard, setDashboard] =
    useState<AdminDashboard | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function load() {
      try {
        setDashboard(
          await getAdminDashboard()
        );
      } catch (requestError) {
        setError(
          getApiErrorMessage(
            requestError,
            "No se pudo cargar el dashboard administrativo."
          )
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-8 shadow-sm">
        Cargando administración...
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="rounded-2xl bg-red-50 p-6 text-red-700">
        {error}
      </div>
    );
  }

  const summary =
    extractSummary(dashboard);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          title="Usuarios"
          value={summary.total_users || 0}
        />

        <AdminStatCard
          title="Vendedores"
          value={summary.total_sellers || 0}
        />

        <AdminStatCard
          title="Productos"
          value={summary.total_products || 0}
        />

        <AdminStatCard
          title="Órdenes"
          value={summary.total_orders || 0}
        />
      </section>

      <section className="rounded-2xl bg-gray-900 p-6 text-white shadow-sm">
        <p className="text-sm text-gray-400">
          Volumen comercial
        </p>

        <p className="mt-2 text-4xl font-bold">
          {formatCurrency(
            summary.total_revenue || 0
          )}
        </p>

        <p className="mt-2 text-sm text-gray-400">
          Ingresos procesados por AgroNexus
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AlertCard
          title="Stock bajo"
          value={
            summary.low_stock_products || 0
          }
          link="/admin/products"
        />

        <AlertCard
          title="Sin stock"
          value={
            summary.out_of_stock_products || 0
          }
          link="/admin/products"
        />

        <AlertCard
          title="Reclamos abiertos"
          value={
            summary.open_complaints || 0
          }
          link="/admin/complaints"
        />

        <AlertCard
          title="Devoluciones"
          value={
            summary.pending_returns || 0
          }
          link="/admin/returns"
        />
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">
              Órdenes recientes
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Últimas operaciones realizadas.
            </p>
          </div>

          <Link
            to="/admin/orders"
            className="text-sm font-semibold text-green-700"
          >
            Ver todas
          </Link>
        </div>

        {!dashboard.recent_orders?.length ? (
          <p className="mt-6 text-gray-500">
            No hay órdenes recientes.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="pb-3">
                    Orden
                  </th>

                  <th className="pb-3">
                    Estado
                  </th>

                  <th className="pb-3">
                    Fecha
                  </th>

                  <th className="pb-3 text-right">
                    Total
                  </th>
                </tr>
              </thead>

              <tbody>
                {dashboard.recent_orders.map(
                  (order) => (
                    <tr
                      key={order.id}
                      className="border-b last:border-0"
                    >
                      <td className="py-4">
                        <Link
                          to={`/admin/orders/${order.id}`}
                          className="font-semibold hover:text-green-700"
                        >
                          {
                            order.order_number
                          }
                        </Link>
                      </td>

                      <td className="py-4">
                        <StatusBadge
                          status={
                            order.status
                          }
                        />
                      </td>

                      <td className="py-4">
                        {new Date(
                          order.created_at
                        ).toLocaleDateString(
                          "es-AR"
                        )}
                      </td>

                      <td className="py-4 text-right font-bold">
                        {formatCurrency(
                          order.total
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">
            Productos más vendidos
          </h2>

          <div className="mt-5 space-y-3">
            {dashboard.top_products?.map(
              (product, index) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between rounded-xl border p-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-green-700">
                      #{index + 1}
                    </span>

                    <div>
                      <p className="font-semibold">
                        {product.name}
                      </p>

                      <p className="text-xs text-gray-500">
                        {product.quantity_sold ??
                          product.units_sold ??
                          0}{" "}
                        vendidos
                      </p>
                    </div>
                  </div>

                  <p className="font-bold">
                    {formatCurrency(
                      product.revenue || 0
                    )}
                  </p>
                </div>
              )
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">
            Mejores vendedores
          </h2>

          <div className="mt-5 space-y-3">
            {dashboard.top_sellers?.map(
              (seller, index) => (
                <div
                  key={seller.id}
                  className="flex items-center justify-between rounded-xl border p-4"
                >
                  <div>
                    <p className="font-semibold">
                      #{index + 1}{" "}
                      {seller.business_name}
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      ⭐{" "}
                      {seller.rating_average ||
                        0}
                    </p>
                  </div>

                  <p className="font-bold text-green-700">
                    {formatCurrency(
                      seller.revenue || 0
                    )}
                  </p>
                </div>
              )
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function AlertCard({
  title,
  value,
  link,
}: {
  title: string;
  value: number;
  link: string;
}) {
  return (
    <Link
      to={link}
      className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5"
    >
      <p className="text-sm font-medium text-yellow-800">
        {title}
      </p>

      <p className="mt-2 text-3xl font-bold text-yellow-900">
        {value}
      </p>

      <p className="mt-2 text-sm text-yellow-700">
        Revisar →
      </p>
    </Link>
  );
}