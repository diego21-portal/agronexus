import { useEffect, useState } from "react";
import { Link } from "react-router";

import { SellerStatCard } from "../features/seller/SellerStatCard";
import { StatusBadge } from "../features/seller/StatusBadge";

import { getSellerDashboard } from "../services/sellerService";

import type {
  SellerDashboard,
  SellerSummary,
} from "../types/seller";

import { formatCurrency } from "../utils/currency";
import { getApiErrorMessage } from "../utils/apiError";

function getSummary(
  dashboard: SellerDashboard
): SellerSummary {
  return {
    total_products:
      dashboard.summary?.total_products ??
      dashboard.total_products ??
      0,

    published_products:
      dashboard.summary?.published_products ??
      dashboard.published_products ??
      0,

    low_stock_products:
      dashboard.summary?.low_stock_products ??
      dashboard.low_stock_products ??
      0,

    out_of_stock_products:
      dashboard.summary?.out_of_stock_products ??
      dashboard.out_of_stock_products ??
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

    pending_questions:
      dashboard.summary?.pending_questions ??
      dashboard.pending_questions ??
      0,
  };
}

export function SellerDashboardPage() {
  const [dashboard, setDashboard] =
    useState<SellerDashboard | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);

        const data =
          await getSellerDashboard();

        setDashboard(data);
      } catch (requestError) {
        setError(
          getApiErrorMessage(
            requestError,
            "No se pudo cargar el dashboard del vendedor."
          )
        );
      } finally {
        setLoading(false);
      }
    }

    void loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-8 shadow-sm">
        Cargando dashboard...
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="rounded-2xl bg-red-50 p-6 text-red-700">
        {error || "No se encontró información."}
      </div>
    );
  }

  const summary = getSummary(dashboard);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SellerStatCard
          title="Productos"
          value={summary.total_products || 0}
          subtitle={`${summary.published_products || 0} publicados`}
        />

        <SellerStatCard
          title="Pedidos"
          value={summary.total_orders || 0}
        />

        <SellerStatCard
          title="Ingresos"
          value={formatCurrency(
            summary.total_revenue || 0
          )}
        />

        <SellerStatCard
          title="Preguntas pendientes"
          value={summary.pending_questions || 0}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/seller/stock"
          className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5 transition hover:shadow-sm"
        >
          <p className="text-sm font-medium text-yellow-700">
            Stock bajo
          </p>

          <p className="mt-2 text-3xl font-bold text-yellow-900">
            {summary.low_stock_products || 0}
          </p>

          <p className="mt-2 text-sm text-yellow-700">
            Revisar inventario →
          </p>
        </Link>

        <Link
          to="/seller/stock"
          className="rounded-2xl border border-red-200 bg-red-50 p-5 transition hover:shadow-sm"
        >
          <p className="text-sm font-medium text-red-700">
            Productos agotados
          </p>

          <p className="mt-2 text-3xl font-bold text-red-900">
            {summary.out_of_stock_products || 0}
          </p>

          <p className="mt-2 text-sm text-red-700">
            Gestionar productos →
          </p>
        </Link>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">
              Pedidos recientes
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Última actividad comercial.
            </p>
          </div>

          <Link
            to="/seller/orders"
            className="text-sm font-semibold text-green-700"
          >
            Ver todos
          </Link>
        </div>

        {!dashboard.recent_orders?.length ? (
          <p className="mt-6 rounded-xl bg-gray-50 p-5 text-gray-500">
            No hay pedidos recientes.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="pb-3">Orden</th>
                  <th className="pb-3">Fecha</th>
                  <th className="pb-3">Estado</th>
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
                          to={`/seller/orders/${order.id}`}
                          className="font-semibold hover:text-green-700"
                        >
                          {order.order_number}
                        </Link>
                      </td>

                      <td className="py-4">
                        {new Date(
                          order.created_at
                        ).toLocaleDateString(
                          "es-AR"
                        )}
                      </td>

                      <td className="py-4">
                        <StatusBadge
                          status={order.status}
                        />
                      </td>

                      <td className="py-4 text-right font-semibold">
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

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold">
          Productos más vendidos
        </h2>

        {!dashboard.top_products?.length ? (
          <p className="mt-5 text-gray-500">
            Todavía no hay datos suficientes.
          </p>
        ) : (
          <div className="mt-5 space-y-3">
            {dashboard.top_products.map(
              (product, index) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between rounded-xl border border-gray-200 p-4"
                >
                  <div className="flex items-center gap-4">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-green-50 font-bold text-green-700">
                      {index + 1}
                    </span>

                    <div>
                      <p className="font-semibold">
                        {product.name}
                      </p>

                      <p className="text-sm text-gray-500">
                        {product.quantity_sold ??
                          product.units_sold ??
                          0}{" "}
                        unidades
                      </p>
                    </div>
                  </div>

                  <p className="font-bold text-green-700">
                    {formatCurrency(
                      product.revenue ??
                        product.total_sales ??
                        0
                    )}
                  </p>
                </div>
              )
            )}
          </div>
        )}
      </section>
    </div>
  );
}