import { useEffect, useRef, useState } from "react";
import {
  Link,
  useParams,
} from "react-router";
import { getOrderById } from "../services/orderService";
import { ShipmentSummary } from "../features/orders/ShipmentSummary";
import { OrderAmounts } from "../features/orders/OrderAmounts";
import { DeliveryAddress } from "../features/orders/DeliveryAddress";
import { paymentMethodLabels, type PaymentMethod } from "../types/checkout";
import type { Order } from "../types/order";
import { getApiErrorMessage } from "../utils/apiError";
import { formatCurrency } from "../utils/currency";
import { useAuth } from "../features/auth/AuthContext";
import { getAuthSession } from "../lib/tokenStorage";

const statusLabels: Record<string, string> = {
  PENDING: "Pendiente",
  PAID: "Pago confirmado",
  PREPARING: "En preparación",
  SHIPPED: "Despachado",
  IN_TRANSIT: "En camino",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
  APPROVED: "Aprobado",
  CREATED: "Creado",
};

export function OrderConfirmationPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { user } = useAuth();
  const ownerId = user?.id;
  const sessionGeneration = getAuthSession().generation;
  const scope = JSON.stringify([ownerId, sessionGeneration, orderId]);
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const generation = useRef(0);
  const [result, setResult] = useState<{ scope: string; order: Order | null; loading: boolean; error: string }>({
    scope, order: null, loading: true, error: "",
  });
  // Router history can belong to a previous buyer. Only a server response for
  // the current buyer, authentication generation and URL may supply order PII.
  const visibleResult = result.scope === scope ? result : null;
  const order = visibleResult?.order ?? null;
  const loading = visibleResult?.loading ?? true;
  const error = visibleResult?.error ?? "";

  useEffect(() => {
    const version = ++generation.current;
    const parsedOrderId = Number(orderId);
    setResult({ scope, order: null, loading: true, error: "" });
    const isCurrent = () => version === generation.current && currentScope.current === scope
      && getAuthSession().generation === sessionGeneration;

    async function loadOrder(): Promise<void> {
      if (!ownerId || !Number.isInteger(parsedOrderId) || parsedOrderId < 1) {
        setResult({ scope, order: null, loading: false, error: "El pedido no es válido para la sesión actual." });
        return;
      }
      try {
        const orderData =
          await getOrderById(parsedOrderId);
        if (isCurrent()) setResult({ scope, order: orderData, loading: false, error: "" });
      } catch (requestError) {
        if (isCurrent()) setResult({ scope, order: null, loading: false, error: getApiErrorMessage(
          requestError, "No se pudo recuperar el pedido. Puedes consultarlo desde Mis pedidos.",
        ) });
      }
    }

    void loadOrder();
    return () => { generation.current += 1; };
  }, [orderId, ownerId, scope, sessionGeneration]);

  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-10 shadow-sm">
        Cargando orden...
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="rounded-2xl bg-red-50 p-10 text-red-700">
        <p>{error || "No se encontró la orden."}</p>

        <Link
          to="/account/orders"
          className="mt-4 inline-block font-medium underline"
        >
          Ver mis pedidos
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <section className="rounded-2xl bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-4xl">
          ✓
        </div>

        <p className="mt-5 text-sm font-semibold uppercase tracking-wide text-green-700">
          Compra confirmada
        </p>

        <h1 className="mt-2 text-3xl font-bold">
          ¡Gracias por tu compra!
        </h1>

        <p className="mt-3 text-gray-600">
          Tu pedido fue registrado correctamente.
        </p>

        <div className="mx-auto mt-6 max-w-md rounded-xl bg-gray-50 p-5">
          <p className="text-sm text-gray-500">
            Número de orden
          </p>

          <p className="mt-1 text-xl font-bold">
            {order.order_number}
          </p>

          <p className="mt-3 text-sm text-gray-500">
            Estado
          </p>

          <p className="font-semibold text-green-700">
            {statusLabels[order.status] || order.status}
          </p>
        </div>
      </section>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">
            Productos
          </h2>

          <div className="mt-5 space-y-4">
            {(order.items ?? []).map((item) => (
              <article
                key={item.id}
                className="border-b pb-4 last:border-b-0"
              >
                <div className="flex justify-between gap-4">
                  <div>
                    <p className="font-medium">
                      {item.product_name}
                    </p>

                    <p className="text-sm text-gray-500">
                      {item.quantity} ×{" "}
                      {formatCurrency(item.unit_price)}
                    </p>
                  </div>

                  <p className="font-bold">
                    {formatCurrency(item.total_price)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">
            Totales
          </h2>

          <div className="mt-5 space-y-3">
            <SummaryRow
              label="Subtotal"
              value={formatCurrency(order.subtotal)}
            />

            <SummaryRow
              label="Descuentos"
              value={`- ${formatCurrency(
                order.discount_total
              )}`}
            />

            <SummaryRow
              label="Envío"
              value={formatCurrency(
                order.shipping_cost
              )}
            />

            <div className="flex justify-between border-t pt-4 text-xl font-bold">
              <span>Total</span>
              <span className="text-green-700">
                {formatCurrency(order.total)}
              </span>
            </div>
          </div>
        </section>

        <DeliveryAddress snapshot={order.shipping_address_snapshot} source={order.shipping_address_snapshot_source} />

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">
            Pago y envío
          </h2>

          <div className="mt-4 space-y-4">
            <OrderAmounts original={order.total} refunded={order.refunded_amount ?? order.payment?.refunded_amount} net={order.net_total} reviewRequired={order.payment?.refund_review_required} />
            <div>
              <p className="text-sm text-gray-500">
                Pago
              </p>

              <p className="font-medium">
                {order.payment
                  ? statusLabels[order.payment.status] ||
                    order.payment.status
                  : "Procesando"}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Método
              </p>

              <p className="font-medium">
                {paymentMethodLabels[order.payment?.payment_method as PaymentMethod] || "Método registrado"}
              </p>
            </div>

            <div>
              <h3 className="font-semibold">Envíos por vendedor</h3>
              <ShipmentSummary shipments={order.shipments} shipment={order.shipment} />
            </div>
          </div>
        </section>
      </div>

      <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
        <Link
          to="/products"
          className="rounded-lg bg-green-700 px-5 py-3 text-center font-medium text-white hover:bg-green-800"
        >
          Seguir comprando
        </Link>

        <Link
          to="/account/orders"
          className="rounded-lg border border-gray-300 px-5 py-3 text-center font-medium hover:bg-gray-50"
        >
          Ver mis pedidos
        </Link>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-600">{label}</span>
      <span>{value}</span>
    </div>
  );
}
