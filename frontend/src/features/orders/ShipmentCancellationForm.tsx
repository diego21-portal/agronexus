import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { requestShipmentCancellation } from "../../services/cancellationService";
import { cancellationLabels, type CancellationRequest } from "../../types/cancellation";
import type { Shipment } from "../../types/order";
import { getApiErrorMessage } from "../../utils/apiError";
import { formatCurrency } from "../../utils/currency";

export function ShipmentCancellationForm({ shipment, onRequested }: {
  shipment: Shipment; onRequested: (request: CancellationRequest) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    if (reason.trim().length < 10) {
      setError("Explicá el motivo con al menos 10 caracteres.");
      return;
    }
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      const request = await requestShipmentCancellation(shipment.id, reason.trim());
      if (!active.current) return;
      setOpen(false);
      setReason("");
      onRequested(request);
    } catch (requestError) {
      if (active.current) setError(getApiErrorMessage(requestError, "No se pudo solicitar la cancelación."));
    } finally {
      if (active.current) { busy.current = false; setSaving(false); }
    }
  }

  const previousRequestAllowsRetry = shipment.can_request_cancellation
    && shipment.cancellation
    && ["WITHDRAWN", "REJECTED"].includes(shipment.cancellation.status);
  if (shipment.cancellation && !previousRequestAllowsRetry) {
    return <div className="mt-4 rounded-lg bg-green-50 p-3">
      <p role="status" className="font-medium">{cancellationLabels[shipment.cancellation.status]}</p>
      <p className="mt-1 text-sm">{shipment.cancellation.is_pre_dispatch
        ? "La cancelación previa al despacho quedó registrada."
        : "Consultá el retorno, la revisión de los productos y el reembolso en tus solicitudes."}</p>
      <Link to="/account/cancellations" className="mt-2 inline-block text-sm text-green-700 underline">Ver mis cancelaciones</Link>
    </div>;
  }
  if (!shipment.can_request_cancellation) return null;

  const beforeDispatch = shipment.status === "CREATED" || shipment.status === "PREPARING";
  return <div className="mt-4 border-t pt-4">
    {previousRequestAllowsRetry && shipment.cancellation && <p className="mb-3 text-sm text-gray-600">
      Solicitud anterior: {cancellationLabels[shipment.cancellation.status]}.
    </p>}
    {!open && <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700">
      {beforeDispatch ? "Cancelar productos de este vendedor" : "Solicitar cancelación de este envío"}
    </button>}
    {error && <p role="alert" className="mt-3 text-red-700">{error}</p>}
    {open && <form onSubmit={submit} aria-label={`Cancelar envío de ${shipment.seller_name}`} className="space-y-3">
      <p className="font-semibold">Se incluyen todos los productos de {shipment.seller_name} en este envío.</p>
      {shipment.seller_subtotal && <p>Importe de productos: {formatCurrency(shipment.seller_subtotal)}.</p>}
      <p className="text-sm text-gray-600">{beforeDispatch
        ? "Al confirmar se cancelarán estos productos y se registrará su reembolso."
        : "El paquete ya fue despachado. La solicitud inicia la gestión de retorno; la revisión y el reembolso se confirmarán durante ese proceso."}</p>
      <p className="text-sm text-gray-600">La devolución de gastos de envío se evalúa por separado.</p>
      <fieldset disabled={saving} className="space-y-3 disabled:opacity-60">
        <label className="block">Motivo de cancelación
          <textarea required minLength={10} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)}
            className="mt-2 block w-full rounded border p-2" />
        </label>
        <button className="rounded-lg bg-red-700 px-4 py-2 text-white">{saving ? "Enviando..." : "Confirmar solicitud"}</button>
        <button type="button" onClick={() => { setOpen(false); setError(""); }} className="ml-3 rounded-lg border px-4 py-2">Volver</button>
      </fieldset>
    </form>}
  </div>;
}
