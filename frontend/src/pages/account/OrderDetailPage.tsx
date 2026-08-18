import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { getOrderById } from "../../services/orderService";
import type { Order } from "../../types/order";
import { getApiErrorMessage } from "../../utils/apiError";
import { formatCurrency } from "../../utils/currency";

export function OrderDetailPage() {
  const { orderId } =
    useParams<{ orderId: string }>();

  const [order, setOrder] =
    useState<Order | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function loadOrder() {
      const id = Number(orderId);

      if (!Number.isInteger(id)) {
        setError("Orden inválida.");
        setLoading(false);
        return;
      }

      try {
        const data =
          await getOrderById(id);

        setOrder(data);
      } catch (requestError) {
        setError(
          getApiErrorMessage(
            requestError,
            "No se pudo cargar la orden."
          )
        );
      } finally {
        setLoading(false);
      }
    }

    void loadOrder();
  }, [orderId]);

  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-8 shadow-sm">
        Cargando pedido...
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="rounded-2xl bg-red-50 p-6 text-red-700">
        {error || "Orden no encontrada."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row">
          <div>
            <p className="text-sm text-gray-500">
              Orden
            </p>

            <h2 className="text-2xl font-bold">
              {order.order_number}
            </h2>

            <p className="mt-2 text-gray-600">
              {new Date(
                order.created_at
              ).toLocaleString("es-AR")}
            </p>
          </div>

          <div className="md:text-right">
            <span className="rounded-full bg-green-50 px-4 py-2 font-medium text-green-700">
              {order.status}
            </span>

            <p className="mt-4 text-2xl font-bold">
              {formatCurrency(order.total)}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3 border-t pt-5">
          <Link
            to={`/account/orders/${order.id}/tracking`}
            className="rounded-lg bg-green-700 px-4 py-2 font-medium text-white"
          >
            Seguimiento
          </Link>

          <Link
            to={`/account/orders/${order.id}/complaint`}
            className="rounded-lg border border-red-300 px-4 py-2 font-medium text-red-700"
          >
            Crear reclamo
          </Link>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold">
          Productos
        </h3>

        <div className="mt-5 space-y-4">
          {(order.items || []).map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-gray-200 p-4"
            >
              <div className="flex flex-col justify-between gap-4 md:flex-row">
                <div>
                  <p className="font-bold">
                    {item.product_name}
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    SKU {item.sku}
                  </p>

                  <p className="mt-2 text-sm">
                    {item.quantity} ×{" "}
                    {formatCurrency(item.unit_price)}
                  </p>
                </div>

                <div className="md:text-right">
                  <p className="font-bold">
                    {formatCurrency(
                      item.total_price
                    )}
                  </p>

                  {order.status === "DELIVERED" && (
                    <Link
                      to={`/account/orders/${order.id}/items/${item.id}/return`}
                      className="mt-3 inline-block text-sm font-medium text-red-700"
                    >
                      Solicitar devolución
                    </Link>
                  )}

                  {item.product_slug &&
                    order.status === "DELIVERED" && (
                      <Link
                        to={`/products/${item.product_slug}`}
                        className="ml-4 mt-3 inline-block text-sm font-medium text-green-700"
                      >
                        Calificar
                      </Link>
                    )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h3 className="font-bold">
            Pago
          </h3>

          <p className="mt-4 text-sm text-gray-500">
            Estado
          </p>

          <p className="font-medium">
            {order.payment?.status || "—"}
          </p>

          <p className="mt-3 text-sm text-gray-500">
            Método
          </p>

          <p className="font-medium">
            {order.payment?.payment_method || "—"}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h3 className="font-bold">
            Envío
          </h3>

          <p className="mt-4 text-sm text-gray-500">
            Estado
          </p>

          <p className="font-medium">
            {order.shipment?.status || "—"}
          </p>

          <p className="mt-3 text-sm text-gray-500">
            Tracking
          </p>

          <p className="font-mono font-medium">
            {order.shipment?.tracking_code ||
              "Todavía no asignado"}
          </p>
        </div>
      </section>
    </div>
  );
}