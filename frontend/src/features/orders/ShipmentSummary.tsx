import type { Shipment } from "../../types/order";
import { useState } from "react";
import type { CancellationRequest } from "../../types/cancellation";
import { StatusBadge } from "../seller/StatusBadge";
import { ShipmentCancellationForm } from "./ShipmentCancellationForm";

interface ShipmentSummaryProps {
  shipments?: Shipment[];
  shipment?: Shipment | null;
  showHistory?: boolean;
  allowCancellation?: boolean;
  onCancellationChange?: () => void;
}

export function ShipmentSummary({ shipments, shipment, showHistory = false, allowCancellation = false, onCancellationChange }: ShipmentSummaryProps) {
  const entries = shipments ?? (shipment ? [shipment] : []);

  if (entries.length === 0) {
    return <p className="mt-4 text-gray-600">Todavía no hay envíos registrados.</p>;
  }

  return (
    <div className="mt-4 space-y-5">
      {entries.map((entry) => <ShipmentCard key={entry.id} entry={entry} showHistory={showHistory}
        allowCancellation={allowCancellation} onCancellationChange={onCancellationChange} />)}
    </div>
  );
}

function ShipmentCard({ entry, showHistory, allowCancellation, onCancellationChange }: {
  entry: Shipment; showHistory: boolean; allowCancellation: boolean; onCancellationChange?: () => void;
}) {
  const [requested, setRequested] = useState<CancellationRequest | null>(null);
  const cancellation = requested && (!entry.cancellation || requested.id > entry.cancellation.id)
    ? requested : entry.cancellation;
  const blockingCancellation = cancellation && !["WITHDRAWN", "REJECTED"].includes(cancellation.status);
  const current: Shipment = { ...entry, cancellation,
    status: requested?.is_pre_dispatch ? "CANCELLED" : entry.status,
    can_request_cancellation: !blockingCancellation && entry.can_request_cancellation };
  return <article
          aria-label={`Envío de ${entry.seller_name || `vendedor ${entry.seller ?? "no informado"}`}`}
          className="rounded-xl border border-gray-200 p-4"
        >
          <h4 className="font-bold">{entry.seller_name || "Vendedor no informado"}</h4>
          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase text-gray-500">Estado</dt>
              <dd className="mt-1"><StatusBadge status={current.status} /></dd>
            </div>
            <Info label="Transportista" value={entry.carrier || "Sin asignar"} />
            <Info label="Tracking" value={entry.tracking_code || "Sin asignar"} />
          </dl>
          {allowCancellation && <ShipmentCancellationForm shipment={current} onRequested={(request) => {
            setRequested(request);
            onCancellationChange?.();
          }} />}

          {showHistory && (
            <div className="mt-5 border-t pt-4">
              <h4 className="font-semibold">Historial del envío</h4>
              {entry.events?.length ? (
                <ol className="mt-4 space-y-4">
                  {entry.events.map((event) => (
                    <li key={event.id} className="border-l-2 border-green-200 pl-4">
                      <StatusBadge status={event.status} />
                      <p className="mt-1 text-gray-700">{event.description}</p>
                      {event.location && <p className="mt-1 text-sm text-gray-500">{event.location}</p>}
                      <p className="mt-2 text-xs text-gray-500">
                        {new Date(event.created_at).toLocaleString("es-AR")}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-4 text-gray-600">Todavía no hay eventos registrados.</p>
              )}
            </div>
          )}
        </article>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase text-gray-500">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}
