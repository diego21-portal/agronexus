import { useEffect, useState } from "react";
import { Link } from "react-router";
import { getOrders } from "../../services/orderService";
import type { Order } from "../../types/order";
import { getApiErrorMessage } from "../../utils/apiError";
import { formatCurrency } from "../../utils/currency";

const statusLabels: Record<string, string> = {
  PENDING: "Pendiente",
  PAID: "Pago confirmado",
  PREPARING: "En preparación",
  SHIPPED: "Despachado",
  IN_TRANSIT: "En camino",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

export function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadOrders() {
      try {
        setLoading(true);

        const data = await getOrders();
        setOrders(data);
      } catch (requestError) {
        setError(
          getApiErrorMessage(
            requestError,
            "No se pudieron cargar los pedidos."
          )
        );
      } finally {
        setLoading(false);
      }
    }

    void loadOrders();
  }, []);

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-bold">
        Mis pedidos
      </h2>

      <p className="mt-1 text-gray-600">
        Consultá compras, pagos y seguimiento.
      </p>

      {error && (
        <div className="mt-5 rounded-lg bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="mt-6">
          Cargando pedidos...
        </p>
      ) : orders.length === 0 ? (
        <div className="mt-6 rounded-xl bg-gray-50 p-8 text-center">
          <p>No realizaste pedidos todavía.</p>

          <Link
            to="/products"
            className="mt-4 inline-block font-medium text-green-700"
          >
            Ir al catálogo
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {orders.map((order) => (
            <article
              key={order.id}
              className="rounded-xl border border-gray-200 p-5"
            >
              <div className="flex flex-col justify-between gap-4 md:flex-row">
                <div>
                  <p className="text-sm text-gray-500">
                    Orden
                  </p>

                  <h3 className="font-bold">
                    {order.order_number}
                  </h3>

                  <p className="mt-2 text-sm text-gray-500">
                    {new Date(
                      order.created_at
                    ).toLocaleString("es-AR")}
                  </p>
                </div>

                <div className="md:text-right">
                  <p className="text-xl font-bold text-green-700">
                    {formatCurrency(order.total)}
                  </p>

                  <span className="mt-2 inline-block rounded-full bg-gray-100 px-3 py-1 text-sm">
                    {statusLabels[order.status] ||
                      order.status}
                  </span>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3 border-t pt-4">
                <Link
                  to={`/account/orders/${order.id}`}
                  className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
                >
                  Ver detalle
                </Link>

                {order.status !== "CANCELLED" && (
                  <Link
                    to={`/account/orders/${order.id}/tracking`}
                    className="rounded-lg border border-green-700 px-4 py-2 text-sm font-medium text-green-700"
                  >
                    Seguimiento
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}