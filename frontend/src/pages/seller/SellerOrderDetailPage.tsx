import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Link,
  useParams,
} from "react-router";

import {
  getSellerOrder,
  updateShipmentStatus,
} from "../../services/sellerService";

import type { ShipmentStatus } from "../../types/order";
import type { SellerOrder } from "../../types/seller";

import { StatusBadge } from "../../features/seller/StatusBadge";

import { formatCurrency } from "../../utils/currency";
import { getApiErrorMessage } from "../../utils/apiError";

export function SellerOrderDetailPage() {
  const { orderId } =
    useParams<{
      orderId: string;
    }>();

  const [order, setOrder] =
    useState<SellerOrder | null>(null);

  const [shipmentStatus, setShipmentStatus] =
    useState<ShipmentStatus>("PREPARING");

  const [description, setDescription] =
    useState("");

  const [location, setLocation] =
    useState("");

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const requestVersion = useRef(0);
  const activeOrder = useRef<string | undefined>(undefined);
  const savingRequest = useRef(false);
  const routeGeneration = useRef(0);

  const loadOrder = useCallback(async () => {
    if (activeOrder.current !== orderId) return;
    const version = ++requestVersion.current;
    setLoading(true);
    setError("");
    try {
      const id = Number(orderId);
      if (!Number.isInteger(id) || id < 1) throw new Error("Pedido inválido.");
      const data = await getSellerOrder(id);
      if (version !== requestVersion.current) return;
      setOrder(data);
      setShipmentStatus(
        data.shipment?.status === "CREATED"
          ? "PREPARING"
          : data.shipment?.status || "PREPARING"
      );
    } catch (requestError) {
      if (version === requestVersion.current) {
        setError(getApiErrorMessage(requestError, "No se pudo cargar el pedido."));
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    routeGeneration.current += 1;
    activeOrder.current = orderId;
    setOrder(null);
    setMessage("");
    setDescription("");
    setLocation("");
    setSaving(false);
    savingRequest.current = false;
    void loadOrder();
    return () => {
      routeGeneration.current += 1;
      activeOrder.current = undefined;
      requestVersion.current += 1;
    };
  }, [orderId, loadOrder]);

  async function handleShipmentUpdate() {
    if (savingRequest.current) return;
    if (!order?.shipment) {
      setError(
        "Esta orden todavía no tiene envío."
      );
      return;
    }
    if (["DELIVERED", "CANCELLED"].includes(order.shipment.status)
      || ["DELIVERED", "CANCELLED"].includes(order.order_status)
      || (order.shipment.cancellation && ["RETURNING", "RECEIVED", "INSPECTED", "COMPLETED"].includes(order.shipment.cancellation.status))) return;
    const generation = routeGeneration.current;

    try {
      savingRequest.current = true;
      setSaving(true);
      setError("");
      setMessage("");

      await updateShipmentStatus(
        order.shipment.id,
        {
          status:
            shipmentStatus,
          description,
          location,
        }
      );

      if (activeOrder.current !== orderId || routeGeneration.current !== generation) return;
      setMessage(
        "Estado del envío actualizado."
      );

      setDescription("");
      setLocation("");

      await loadOrder();
    } catch (requestError) {
      if (activeOrder.current !== orderId || routeGeneration.current !== generation) return;
      setError(
        getApiErrorMessage(
          requestError,
          "No se pudo actualizar el envío."
        )
      );
    } finally {
      if (activeOrder.current === orderId && routeGeneration.current === generation) {
        savingRequest.current = false;
        setSaving(false);
      }
    }
  }

  if (loading && !order) {
    return (
      <div className="rounded-2xl bg-white p-8">
        Cargando pedido...
      </div>
    );
  }

  if (!order) {
    return (
      <div role="alert" className="rounded-2xl bg-red-50 p-8 text-red-700">
        <p>{error || "No se pudo cargar el pedido."}</p>
        <button type="button" onClick={() => void loadOrder()} className="mt-4 underline">
          Reintentar
        </button>
        <Link to="/seller/orders" className="ml-4 underline">Volver a pedidos</Link>
      </div>
    );
  }

  const shipmentFinished = order.shipment?.status === "DELIVERED"
    || order.shipment?.status === "CANCELLED";
  const orderFinished = order.order_status === "DELIVERED" || order.order_status === "CANCELLED";
  const returnInProgress = Boolean(order.shipment?.cancellation
    && ["RETURNING", "RECEIVED", "INSPECTED", "COMPLETED"].includes(order.shipment.cancellation.status));
  const shipmentReadOnly = shipmentFinished || orderFinished || returnInProgress;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <Link
          to="/seller/orders"
          className="text-sm font-medium text-green-700"
        >
          ← Pedidos
        </Link>

        <div className="mt-4 flex flex-col justify-between gap-4 md:flex-row">
          <div>
            <h2 className="text-2xl font-bold">
              {
                order.order_number
              }
            </h2>

            <p className="mt-1 text-gray-500">
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

            <p className="mt-3 text-sm text-gray-500">Subtotal de tus productos</p>
            <p className="mt-1 text-2xl font-bold text-green-700">
              {formatCurrency(
                order.seller_subtotal
              )}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold">
          Productos vendidos
        </h3>

        <div className="mt-5 space-y-4">
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

      {order.shipment && (
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h3 className="text-xl font-bold">
            Gestionar envío
          </h3>

          <p className="mt-2 text-sm text-gray-600">
            Seguimiento de tus productos: {order.shipment.tracking_code || "Sin asignar"}
          </p>

          {shipmentFinished && (
            <p className="mt-3 text-sm text-gray-600">
              Este envío está {order.shipment.status === "DELIVERED" ? "entregado" : "cancelado"} y no admite cambios.
            </p>
          )}

          {!shipmentFinished && orderFinished && (
            <p className="mt-3 text-sm text-gray-600">
              El pedido está cerrado y no admite cambios de envío.
            </p>
          )}
          {order.shipment.cancellation && <p className="mt-3 text-sm text-gray-600">
            {returnInProgress ? "Este envío tiene un retorno en gestión." : "El cliente solicitó cancelar este envío."}{" "}
            <Link to="/seller/cancellations" className="text-green-700 underline">Gestionar solicitud de cancelación</Link>
          </p>}

          {error && (
            <div className="mt-5 rounded-lg bg-red-50 p-4 text-red-700">
              {error}
            </div>
          )}

          {message && (
            <div className="mt-5 rounded-lg bg-green-50 p-4 text-green-700">
              {message}
            </div>
          )}

          <fieldset disabled={saving || shipmentReadOnly} className="mt-5 grid gap-4 md:grid-cols-3 disabled:opacity-60">
            <select
              aria-label="Estado del envío"
              value={
                shipmentStatus
              }
              onChange={(event) =>
                setShipmentStatus(
                  event.target.value as ShipmentStatus
                )
              }
              className="rounded-lg border px-3 py-2"
            >
              <option value="PREPARING">
                Preparando
              </option>

              <option value="DISPATCHED">
                Despachado
              </option>

              <option value="IN_TRANSIT">
                En tránsito
              </option>

              <option value="IN_DISTRIBUTION_CENTER">
                En centro de distribución
              </option>

              <option value="OUT_FOR_DELIVERY">
                En reparto
              </option>

              <option value="DELIVERED">
                Entregado
              </option>

              <option value="DELIVERY_PROBLEM">
                Problema de entrega
              </option>

              {order.shipment.status === "CANCELLED" && (
                <option value="CANCELLED">Cancelado</option>
              )}
            </select>

            <input
              placeholder="Ubicación"
              value={location}
              onChange={(event) =>
                setLocation(
                  event.target.value
                )
              }
              className="rounded-lg border px-3 py-2"
            />

            <input
              placeholder="Descripción del evento"
              value={
                description
              }
              onChange={(event) =>
                setDescription(
                  event.target.value
                )
              }
              className="rounded-lg border px-3 py-2"
            />
          </fieldset>

          <button
            onClick={
              handleShipmentUpdate
            }
            disabled={saving || shipmentReadOnly}
            className="mt-5 rounded-lg bg-green-700 px-5 py-3 font-medium text-white disabled:opacity-50"
          >
            {saving ? "Actualizando..." : "Actualizar seguimiento"}
          </button>
        </section>
      )}
    </div>
  );
}
