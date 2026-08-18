import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { getOrderTracking } from "../../services/orderService";
import type { OrderTrackingResponse } from "../../types/order";
import { getApiErrorMessage } from "../../utils/apiError";

export function OrderTrackingPage() {
  const { orderId } =
    useParams<{ orderId: string }>();

  const [tracking, setTracking] =
    useState<OrderTrackingResponse | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function loadTracking() {
      const id = Number(orderId);

      if (!Number.isInteger(id)) {
        setError("Orden inválida.");
        setLoading(false);
        return;
      }

      try {
        const data =
          await getOrderTracking(id);

        setTracking(data);
      } catch (requestError) {
        setError(
          getApiErrorMessage(
            requestError,
            "No se pudo cargar el seguimiento."
          )
        );
      } finally {
        setLoading(false);
      }
    }

    void loadTracking();
  }, [orderId]);

  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-8">
        Cargando seguimiento...
      </div>
    );
  }

  if (error || !tracking) {
    return (
      <div className="rounded-2xl bg-red-50 p-6 text-red-700">
        {error}
      </div>
    );
  }

  const shipment = tracking.shipment;
  const events = shipment.events || [];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <Link
          to={`/account/orders/${orderId}`}
          className="text-sm font-medium text-green-700"
        >
          ← Volver al pedido
        </Link>

        <h2 className="mt-4 text-2xl font-bold">
          Seguimiento del envío
        </h2>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Info
            label="Estado"
            value={shipment.status}
          />

          <Info
            label="Transportista"
            value={shipment.carrier || "Sin asignar"}
          />

          <Info
            label="Tracking"
            value={
              shipment.tracking_code ||
              "Sin asignar"
            }
          />
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold">
          Historial del envío
        </h3>

        {events.length === 0 ? (
          <p className="mt-5 text-gray-600">
            Todavía no hay eventos registrados.
          </p>
        ) : (
          <div className="mt-6">
            {events.map((event, index) => (
              <div
                key={event.id}
                className="relative flex gap-4 pb-8 last:pb-0"
              >
                {index < events.length - 1 && (
                  <div className="absolute left-[11px] top-6 h-full w-0.5 bg-green-200" />
                )}

                <div className="relative z-10 mt-1 h-6 w-6 shrink-0 rounded-full border-4 border-green-100 bg-green-700" />

                <div>
                  <p className="font-bold">
                    {event.status}
                  </p>

                  <p className="mt-1 text-gray-700">
                    {event.description}
                  </p>

                  {event.location && (
                    <p className="mt-1 text-sm text-gray-500">
                      {event.location}
                    </p>
                  )}

                  <p className="mt-2 text-xs text-gray-400">
                    {new Date(
                      event.created_at
                    ).toLocaleString("es-AR")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-gray-50 p-4">
      <p className="text-xs uppercase text-gray-500">
        {label}
      </p>

      <p className="mt-1 font-bold">
        {value}
      </p>
    </div>
  );
}