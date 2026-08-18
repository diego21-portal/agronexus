import {
  useEffect,
  useState,
} from "react";

import {
  Link,
  useParams,
} from "react-router";

import { getAdminOrder } from "../../services/adminService";

import type {
  AdminOrder,
} from "../../types/admin";

import { StatusBadge } from "../../features/seller/StatusBadge";

import { formatCurrency } from "../../utils/currency";
import { getApiErrorMessage } from "../../utils/apiError";

export function AdminOrderDetailPage() {
  const { orderId } =
    useParams<{
      orderId: string;
    }>();

  const [order, setOrder] =
    useState<AdminOrder | null>(null);

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function load() {
      try {
        setOrder(
          await getAdminOrder(
            Number(orderId)
          )
        );
      } catch (requestError) {
        setError(
          getApiErrorMessage(
            requestError,
            "No se pudo cargar la orden."
          )
        );
      }
    }

    void load();
  }, [orderId]);

  if (error) {
    return (
      <div className="rounded-2xl bg-red-50 p-6 text-red-700">
        {error}
      </div>
    );
  }

  if (!order) {
    return (
      <div className="rounded-2xl bg-white p-8">
        Cargando orden...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <Link
          to="/admin/orders"
          className="text-sm font-medium text-green-700"
        >
          ← Volver
        </Link>

        <div className="mt-4 flex flex-col justify-between gap-4 md:flex-row">
          <div>
            <h2 className="text-2xl font-bold">
              {
                order.order_number
              }
            </h2>

            <p className="mt-2 text-gray-500">
              {new Date(
                order.created_at
              ).toLocaleString(
                "es-AR"
              )}
            </p>
          </div>

          <div className="md:text-right">
            <StatusBadge
              status={
                order.status
              }
            />

            <p className="mt-3 text-2xl font-bold text-green-700">
              {formatCurrency(
                order.total
              )}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold">
          Productos
        </h3>

        <div className="mt-5 space-y-3">
          {(order.items || []).map(
            (item) => (
              <div
                key={item.id}
                className="flex justify-between rounded-xl border p-4"
              >
                <div>
                  <p className="font-semibold">
                    {
                      item.product_name
                    }
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    {item.quantity} ×{" "}
                    {formatCurrency(
                      item.unit_price
                    )}
                  </p>
                </div>

                <p className="font-bold">
                  {formatCurrency(
                    item.total_price
                  )}
                </p>
              </div>
            )
          )}
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <article className="rounded-2xl bg-white p-6 shadow-sm">
          <h3 className="font-bold">
            Pago
          </h3>

          <p className="mt-4">
            Estado:{" "}
            <strong>
              {order.payment
                ?.status || "—"}
            </strong>
          </p>

          <p className="mt-2">
            Método:{" "}
            {
              order.payment
                ?.payment_method
            }
          </p>
        </article>

        <article className="rounded-2xl bg-white p-6 shadow-sm">
          <h3 className="font-bold">
            Envío
          </h3>

          <p className="mt-4">
            Estado:{" "}
            <strong>
              {order.shipment
                ?.status || "—"}
            </strong>
          </p>

          <p className="mt-2">
            Tracking:{" "}
            {order.shipment
              ?.tracking_code ||
              "—"}
          </p>
        </article>
      </section>
    </div>
  );
}