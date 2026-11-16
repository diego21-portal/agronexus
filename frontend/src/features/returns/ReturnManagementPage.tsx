import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { getAdminReturns, updateReturnStatus } from "../../services/adminService";
import { getSellerReturns } from "../../services/sellerService";
import { inspectReturn, receiveReturn } from "../../services/returnService";
import { returnReasonLabels, returnStatusLabels, type ReturnRequest, type ReturnStatus } from "../../types/return";
import { formatCurrency } from "../../utils/currency";
import { getApiErrorMessage } from "../../utils/apiError";
import { ReturnInspectionSummary } from "./ReturnInspectionSummary";

const inputStyle = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2";
const buttonStyle = "rounded-lg bg-green-700 px-4 py-2 font-medium text-white disabled:opacity-50";

export function ReturnManagementPage({ role }: { role: "admin" | "seller" }) {
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [selected, setSelected] = useState<ReturnRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [received, setReceived] = useState(0);
  const [restocked, setRestocked] = useState(0);
  const [defective, setDefective] = useState(0);
  const [note, setNote] = useState("");
  const [resolution, setResolution] = useState("");
  const [refund, setRefund] = useState("");
  const generation = useRef(0);
  const busy = useRef(false);

  const loadReturns = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const data = role === "admin" ? await getAdminReturns() : await getSellerReturns();
      if (current === generation.current) setReturns(data);
    } catch (requestError) {
      if (current === generation.current) setError(getApiErrorMessage(requestError, "No se pudieron cargar las devoluciones."));
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    setSelected(null);
    setMessage("");
    setSaving(false);
    busy.current = false;
    void loadReturns();
    return () => { generation.current += 1; };
  }, [loadReturns]);

  function selectReturn(item: ReturnRequest) {
    if (busy.current) return;
    setSelected(item);
    setReceived(item.inspection?.received_quantity || 0);
    setRestocked(item.inspection?.restocked_quantity || 0);
    setDefective(item.inspection?.defective_quantity || 0);
    setNote("");
    setResolution(item.resolution || "");
    setRefund(!["REQUESTED", "IN_REVIEW"].includes(item.status) && item.approved_refund_amount != null
      ? item.approved_refund_amount : item.requested_refund_amount || "0.00");
    setError("");
    setMessage("");
  }

  async function perform(operation: () => Promise<ReturnRequest>, success: string) {
    if (!selected || busy.current) return;
    const current = generation.current;
    busy.current = true;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const updated = await operation();
      if (current !== generation.current) return;
      setReturns((items) => items.map((item) => item.id === updated.id ? updated : item));
      setSelected(updated);
      setReceived(updated.inspection?.received_quantity || 0);
      setRestocked(updated.inspection?.restocked_quantity || 0);
      setDefective(updated.inspection?.defective_quantity || 0);
      setNote("");
      setMessage(success);
    } catch (requestError) {
      if (current === generation.current) setError(getApiErrorMessage(requestError, "No se pudo actualizar la devolución."));
    } finally {
      if (current === generation.current) {
        busy.current = false;
        setSaving(false);
      }
    }
  }

  function changeStatus(status: ReturnStatus) {
    if (!selected || busy.current) return;
    const amount = Number(refund);
    if (["APPROVED", "REFUNDED"].includes(status)
      && (!Number.isFinite(amount) || amount < 0 || amount > Number(selected.requested_refund_amount))) {
      setError("El reembolso debe estar entre cero y el importe solicitado.");
      return;
    }
    if (status === "REJECTED" && resolution.trim().length < 10) {
      setError("Explicá el rechazo con al menos 10 caracteres.");
      return;
    }
    void perform(() => updateReturnStatus(selected.id, {
      status, resolution: resolution.trim(),
      ...(["APPROVED", "REFUNDED"].includes(status) ? { approved_refund_amount: refund } : {}),
    }), status === "REFUNDED" ? "Reembolso simulado registrado." : "Decisión registrada.");
  }

  function submitReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    if (!Number.isSafeInteger(received) || received < 1 || received < (selected.inspection?.received_quantity || 0)
      || received > (selected.inspection?.expected_quantity || selected.quantity)) {
      setError("La cantidad recibida debe ser entera y respetar el total esperado y lo ya registrado.");
      return;
    }
    void perform(() => receiveReturn(role, selected.id, { received_quantity: received, note: note.trim() }), "Recepción registrada; las unidades quedan pendientes de inspección.");
  }

  function submitInspection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected?.inspection) return;
    if (![restocked, defective].every(Number.isSafeInteger)
      || restocked < selected.inspection.restocked_quantity || defective < selected.inspection.defective_quantity
      || restocked + defective > selected.inspection.received_quantity) {
      setError("Las cantidades revisadas deben ser enteras, respetar lo registrado y no superar las recibidas.");
      return;
    }
    if (!note.trim()) {
      setError("Registrá una observación del resultado de la inspección.");
      return;
    }
    void perform(() => inspectReturn(role, selected.id, {
      restocked_quantity: restocked, defective_quantity: defective, note: note.trim(),
    }), "Inspección registrada. Solo las unidades aptas se reponen al stock disponible.");
  }

  const allowedStatuses = selected?.allowed_statuses;
  const allows = (status: ReturnStatus) => allowedStatuses === undefined || allowedStatuses.includes(status);
  const canDecide = selected && ["REQUESTED", "IN_REVIEW"].includes(selected.status);
  const canReceive = selected && (selected.can_receive ?? ["APPROVED", "PRODUCT_RECEIVED"].includes(selected.status))
    && (!selected.inspection || selected.inspection.received_quantity < selected.inspection.expected_quantity);
  const canInspect = selected && (selected.can_inspect ?? selected.status === "PRODUCT_RECEIVED") && selected.inspection;

  return (
    <section className="space-y-6 rounded-2xl bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-2xl font-bold">Devoluciones</h2>
        <p className="mt-2 text-gray-600">Registrá la recepción y la revisión de los productos. El reembolso se gestiona por separado.</p>
      </div>
      {error && <div role="alert" className="rounded-lg bg-red-50 p-4 text-red-700">{error}</div>}
      {message && <p role="status" className="rounded-lg bg-green-50 p-4 text-green-700">{message}</p>}
      {loading ? <p>Cargando devoluciones...</p> : returns.length === 0 ? <p>No hay solicitudes de devolución.</p> : (
        <div className="space-y-4">
          {returns.map((item) => (
            <article key={item.id} className="rounded-xl border p-5">
              <div className="flex flex-wrap justify-between gap-3">
                <h3 className="font-bold">{item.product_name || "Producto de la compra"}</h3>
                <span>{returnStatusLabels[item.status]}</span>
              </div>
              <p className="mt-2 text-sm text-gray-500">Orden {item.order_number || "registrada"} · Cantidad: {item.quantity}</p>
              <p className="mt-3 font-medium">{returnReasonLabels[item.reason]}</p>
              <p className="mt-2">{item.description}</p>
              <p className="mt-3">Importe solicitado: {formatCurrency(item.requested_refund_amount || "0.00")}</p>
              <ReturnInspectionSummary inspection={item.inspection} />
              <button type="button" disabled={saving} onClick={() => selectReturn(item)} className="mt-4 rounded-lg border px-4 py-2 disabled:opacity-50">Gestionar devolución de {item.product_name || "este producto"}</button>
            </article>
          ))}
        </div>
      )}
      {selected && (
        <section aria-label="Gestionar devolución" className="rounded-2xl border border-green-200 bg-green-50 p-5">
          <div className="flex items-start justify-between gap-3">
            <div><h3 className="text-xl font-bold">{selected.product_name || "Producto de la compra"}</h3><p className="mt-1">{returnStatusLabels[selected.status]}</p></div>
            <button type="button" disabled={saving} onClick={() => setSelected(null)} className="underline disabled:opacity-50">Cerrar gestión</button>
          </div>
          <fieldset disabled={saving} className="mt-5 space-y-5">
            {role === "admin" && (canDecide || selected.status === "INSPECTED") && (
              <div className="space-y-3">
                <label className="block">Reembolso aprobado
                  <input type="number" aria-label="Reembolso aprobado" min="0" max={selected.requested_refund_amount} step="0.01" value={refund} onChange={(event) => setRefund(event.target.value)} className={inputStyle} />
                </label>
                <label className="block">Resolución para el cliente
                  <textarea aria-label="Resolución para el cliente" value={resolution} onChange={(event) => setResolution(event.target.value)} className={inputStyle} />
                </label>
              </div>
            )}
            {role === "admin" && canDecide && (
              <div className="flex flex-wrap gap-3">
                {selected.status === "REQUESTED" && allows("IN_REVIEW") && <button type="button" onClick={() => changeStatus("IN_REVIEW")} className={buttonStyle}>Pasar a revisión</button>}
                {allows("APPROVED") && <button type="button" onClick={() => changeStatus("APPROVED")} className={buttonStyle}>Aprobar devolución</button>}
                {allows("REJECTED") && <button type="button" onClick={() => changeStatus("REJECTED")} className="rounded-lg border border-red-400 px-4 py-2 text-red-700">Rechazar solicitud</button>}
              </div>
            )}
            {canReceive && (
              <form aria-label="Registrar recepción" onSubmit={submitReceipt} className="space-y-3">
                <p>Registrar recepción mantiene las unidades fuera de venta hasta completar su inspección.</p>
                <label className="block">Total de unidades recibidas
                  <input aria-label="Total de unidades recibidas" type="number" min={selected.inspection?.received_quantity || 0} max={selected.inspection?.expected_quantity || selected.quantity} step="1" value={received} onChange={(event) => setReceived(Number(event.target.value))} className={inputStyle} />
                </label>
                <label className="block">Nota de recepción
                  <textarea aria-label="Nota de recepción" value={note} onChange={(event) => setNote(event.target.value)} className={inputStyle} />
                </label>
                <button className={buttonStyle}>{saving ? "Guardando..." : "Registrar recepción"}</button>
              </form>
            )}
            {canInspect && selected.inspection && (
              <form aria-label="Registrar inspección" onSubmit={submitInspection} className="space-y-3">
                <p>Indicá el total revisado. Las unidades defectuosas no volverán al stock disponible.</p>
                <label className="block">Total de unidades aptas para venta
                  <input aria-label="Total de unidades aptas para venta" type="number" min={selected.inspection.restocked_quantity} max={selected.inspection.received_quantity} step="1" value={restocked} onChange={(event) => setRestocked(Number(event.target.value))} className={inputStyle} />
                </label>
                <label className="block">Total de unidades defectuosas
                  <input aria-label="Total de unidades defectuosas" type="number" min={selected.inspection.defective_quantity} max={selected.inspection.received_quantity} step="1" value={defective} onChange={(event) => setDefective(Number(event.target.value))} className={inputStyle} />
                </label>
                <label className="block">Nota de inspección
                  <textarea aria-label="Nota de inspección" required value={note} onChange={(event) => setNote(event.target.value)} className={inputStyle} />
                </label>
                <button className={buttonStyle}>{saving ? "Guardando..." : "Registrar inspección"}</button>
              </form>
            )}
            {role === "admin" && selected.status === "INSPECTED" && allows("REFUNDED") && <button type="button" onClick={() => changeStatus("REFUNDED")} className={buttonStyle}>{saving ? "Guardando..." : "Registrar reembolso simulado"}</button>}
            {role === "admin" && ["REFUNDED", "REJECTED"].includes(selected.status) && allows("CLOSED") && <button type="button" onClick={() => changeStatus("CLOSED")} className={buttonStyle}>Cerrar solicitud</button>}
            {role === "seller" && ["REQUESTED", "IN_REVIEW", "INSPECTED"].includes(selected.status) && <p>La decisión y el reembolso corresponden a administración.</p>}
            {["CLOSED", "REFUNDED", "REJECTED"].includes(selected.status) && <p>La recepción y la inspección de esta solicitud ya no se pueden modificar.</p>}
          </fieldset>
        </section>
      )}
    </section>
  );
}
