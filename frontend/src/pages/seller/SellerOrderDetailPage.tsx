import {
  useEffect,
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

import type { Order } from "../../types/order";

import { StatusBadge } from "../../features/seller/StatusBadge";

import { formatCurrency } from "../../utils/currency";
import { getApiErrorMessage } from "../../utils/apiError";

export function SellerOrderDetailPage() {
  const { orderId } =
    useParams<{
      orderId: string;
    }>();

  const [order, setOrder] =
    useState<Order | null>(null);

  const [shipmentStatus, setShipmentStatus] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [location, setLocation] =
    useState("");

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  async function loadOrder() {
    const data =
      await getSellerOrder(
        Number(orderId)
      );

    setOrder(data);

    setShipmentStatus(
      data.shipment?.status ||
        "PREPARING"
    );
  }

  useEffect(() => {
    void loadOrder();
  }, [orderId]);

  async function handleShipmentUpdate() {
    if (!order?.shipment) {
      setError(
        "Esta orden todavía no tiene envío."
      );
      return;
    }

    try {
      setError("");

      await updateShipmentStatus(
        order.shipment.id,
        {
          status:
            shipmentStatus,
          description,
          location,
        }
      );

      setMessage(
        "Estado del envío actualizado."
      );

      setDescription("");
      setLocation("");

      await loadOrder();
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "No se pudo actualizar el envío."
        )
      );
    }
  }

  if (!order) {
    return (
      <div className="rounded-2xl bg-white p-8">
        Cargando pedido...
      </div>
    );
  }

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

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <select
              value={
                shipmentStatus
              }
              onChange={(event) =>
                setShipmentStatus(
                  event.target.value
                )
              }
              className="rounded-lg border px-3 py-2"
            >
              <option value="PREPARING">
                Preparando
              </option>

              <option value="SHIPPED">
                Despachado
              </option>

              <option value="IN_TRANSIT">
                En tránsito
              </option>

              <option value="DELIVERED">
                Entregado
              </option>

              <option value="DELIVERY_PROBLEM">
                Problema de entrega
              </option>
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
          </div>

          <button
            onClick={
              handleShipmentUpdate
            }
            className="mt-5 rounded-lg bg-green-700 px-5 py-3 font-medium text-white"
          >
            Actualizar seguimiento
          </button>
        </section>
      )}
    </div>
  );
}