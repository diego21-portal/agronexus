import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ShipmentSummary } from "../../features/orders/ShipmentSummary";
import { getOrderTracking } from "../../services/orderService";
import type { OrderTrackingResponse } from "../../types/order";
import { getApiErrorMessage } from "../../utils/apiError";

export function OrderTrackingPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [tracking, setTracking] = useState<OrderTrackingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setTracking(null);
    setError("");
    setLoading(true);

    async function loadTracking() {
      const id = Number(orderId);
      if (!Number.isInteger(id) || id < 1) {
        setError("Orden inválida.");
        setLoading(false);
        return;
      }

      try {
        const data = await getOrderTracking(id);
        if (active) setTracking(data);
      } catch (requestError) {
        if (active) {
          setError(getApiErrorMessage(requestError, "No se pudo cargar el seguimiento."));
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadTracking();
    return () => { active = false; };
  }, [orderId]);

  if (loading) {
    return <div className="rounded-2xl bg-white p-8">Cargando seguimiento...</div>;
  }

  if (error || !tracking) {
    return (
      <div role="alert" className="rounded-2xl bg-red-50 p-6 text-red-700">
        {error || "No se pudo cargar el seguimiento."}
      </div>
    );
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <Link to={`/account/orders/${orderId}`} className="text-sm font-medium text-green-700">
        ← Volver al pedido
      </Link>
      <h2 className="mt-4 text-2xl font-bold">Seguimiento de los envíos</h2>
      <p className="mt-2 text-gray-600">Cada vendedor gestiona el envío de sus productos.</p>
      <ShipmentSummary shipments={tracking.shipments} shipment={tracking.shipment} showHistory />
    </section>
  );
}
