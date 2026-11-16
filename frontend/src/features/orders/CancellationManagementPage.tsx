import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { actOnCancellation, getCancellations, withdrawCancellation } from "../../services/cancellationService";
import {
  cancellationLabels, type CancellationActionPayload, type CancellationRequest,
  type CancellationRole,
} from "../../types/cancellation";
import { getApiErrorMessage } from "../../utils/apiError";
import { formatCurrency } from "../../utils/currency";

export function CancellationManagementPage({ role }: { role: CancellationRole }) {
  const [cases, setCases] = useState<CancellationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setCases([]);
    void getCancellations(role).then((data) => {
      if (active) setCases(data);
    }).catch((requestError) => {
      if (active) setError(getApiErrorMessage(requestError, "No se pudieron cargar las cancelaciones."));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [role, retry]);

  return (
    <section className="space-y-5 rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-bold">{role === "customer" ? "Mis cancelaciones" : "Cancelaciones y retornos"}</h2>
      <p className="text-gray-600">
        {role === "customer"
          ? "Consultá el retorno de tus productos y el reembolso de cada vendedor. Una solicitud en tránsito requiere coordinar el regreso del paquete."
          : "Registrá la recepción y revisión de los productos. Solo las unidades aptas vuelven al stock disponible."}
      </p>
      {loading && <p>Cargando solicitudes...</p>}
      {error && <div role="alert" className="rounded-lg bg-red-50 p-4 text-red-700">
        <p>{error}</p>
        <button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-2 underline">Reintentar</button>
      </div>}
      {!loading && !error && cases.length === 0 && <p>No hay solicitudes de cancelación.</p>}
      {cases.map((item) => <CancellationCard key={`${role}-${item.id}`} item={item} role={role}
        onUpdate={(updated) => setCases((previous) => previous.map((entry) => entry.id === updated.id ? updated : entry))} />)}
    </section>
  );
}

function CancellationCard({ item, role, onUpdate }: {
  item: CancellationRequest; role: CancellationRole; onUpdate: (updated: CancellationRequest) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [resolution, setResolution] = useState("");
  const [shippingAmount, setShippingAmount] = useState("");
  const [received, setReceived] = useState<Record<number, number>>({});
  const [restocked, setRestocked] = useState<Record<number, number>>({});
  const [defective, setDefective] = useState<Record<number, number>>({});
  const busy = useRef(false);
  const active = useRef(true);
  const shippingOperation = useRef<{ amount: string; resolution: string; key: string } | null>(null);

  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  async function perform(payload?: CancellationActionPayload) {
    if (busy.current) return;
    if (role !== "customer" && !payload) return;
    busy.current = true;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const updated = role === "customer"
        ? await withdrawCancellation(item.id)
        : await actOnCancellation(role, item.id, payload!);
      if (!active.current) return;
      onUpdate(updated);
      setMessage(role === "customer" ? "Solicitud retirada." : "La operación quedó registrada.");
      setResolution("");
      setReceived({});
      setRestocked({});
      setDefective({});
      if (payload?.action === "refund_shipping") {
        shippingOperation.current = null;
        setShippingAmount("");
      }
    } catch (requestError) {
      if (active.current) setError(getApiErrorMessage(requestError, "No se pudo guardar la operación."));
    } finally {
      if (active.current) { busy.current = false; setSaving(false); }
    }
  }

  function refundShipping(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d+(\.\d{1,2})?$/.test(shippingAmount)
      || Number(shippingAmount) <= 0 || Number(shippingAmount) > Number(item.shipping_refundable_amount || 0)) {
      setError("Indicá un importe positivo dentro del saldo de envío disponible.");
      return;
    }
    const previous = shippingOperation.current;
    if (!previous || previous.amount !== shippingAmount || previous.resolution !== resolution.trim()) {
      shippingOperation.current = { amount: shippingAmount, resolution: resolution.trim(), key: crypto.randomUUID() };
    }
    void perform({ action: "refund_shipping", amount: shippingAmount,
      operation_key: shippingOperation.current!.key, resolution: resolution.trim() });
  }

  function receive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void perform({ action: "receive", items: item.inspections.map((inspection) => ({
      order_item: inspection.order_item,
      received_quantity: received[inspection.order_item] ?? inspection.received_quantity,
    })) });
  }

  function inspect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (resolution.trim().length < 10) {
      setError("Describí el resultado de la revisión con al menos 10 caracteres.");
      return;
    }
    const quantities = item.inspections.map((inspection) => ({
      order_item: inspection.order_item,
      restocked_quantity: restocked[inspection.order_item] ?? inspection.restocked_quantity,
      defective_quantity: defective[inspection.order_item] ?? inspection.defective_quantity,
    }));
    if (quantities.some((quantity) => {
      const inspection = item.inspections.find((entry) => entry.order_item === quantity.order_item)!;
      return quantity.restocked_quantity + quantity.defective_quantity > inspection.received_quantity;
    })) {
      setError("Las unidades aptas y defectuosas no pueden superar las recibidas.");
      return;
    }
    void perform({ action: "inspect", items: quantities, resolution: resolution.trim() });
  }

  return (
    <article aria-label={`Cancelación ${item.order_number} de ${item.seller_name}`} className="rounded-xl border p-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div><h3 className="font-bold">{item.order_number}</h3><p>{item.seller_name}</p></div>
        <p className="font-semibold text-green-800">{cancellationLabels[item.status]}</p>
      </div>
      <p className="mt-3">{item.reason}</p>
      {item.resolution && <p className="mt-2 text-gray-600">{item.resolution}</p>}
      <p className="mt-3 font-medium">Reembolso registrado: {formatCurrency(item.refunded_amount)}</p>
      {role === "customer" && <Link to={`/account/orders/${item.order_id}/tracking`} className="mt-3 inline-block text-green-700 underline">Ver seguimiento del pedido</Link>}
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
      {message && <p role="status" className="mt-4 rounded-lg bg-green-50 p-3 text-green-700">{message}</p>}
      {!!item.events?.length && <details className="mt-4 rounded-lg border p-3">
        <summary className="cursor-pointer font-medium">Historial de la solicitud</summary>
        <ol className="mt-3 space-y-3">
          {item.events.map((event) => <li key={event.id} className="border-l-2 border-green-200 pl-3">
            <p>{event.description}</p>
            <p className="mt-1 text-xs text-gray-500">{new Date(event.created_at).toLocaleString("es-AR")}</p>
          </li>)}
        </ol>
      </details>}

      {item.inspections.length > 0 && <div className="mt-4 space-y-3">
        {item.inspections.map((inspection) => <div key={inspection.id} className="rounded-lg bg-gray-50 p-3">
          <p className="font-semibold">{inspection.product_name}</p>
          <p className="mt-1 text-sm">Esperadas: {inspection.expected_quantity} · Recibidas: {inspection.received_quantity}</p>
          <p className="mt-1 text-sm">Pendientes de revisión: {inspection.quarantined_quantity} · Aptas: {inspection.restocked_quantity} · Defectuosas: {inspection.defective_quantity}</p>
        </div>)}
      </div>}

      {role === "customer" && item.status === "REQUESTED" && <button type="button" disabled={saving}
        onClick={() => void perform()} className="mt-4 rounded-lg border px-4 py-2 disabled:opacity-50">
        {saving ? "Retirando..." : "Retirar solicitud"}
      </button>}
      {role !== "customer" && <fieldset disabled={saving} className="mt-4 space-y-4 disabled:opacity-60">
        {item.status === "REQUESTED" && <button type="button" onClick={() => void perform({ action: "start_return" })}
          className="rounded-lg bg-green-700 px-4 py-2 text-white">Confirmar retorno en camino</button>}
        {item.status === "RETURNING" && <form onSubmit={receive} aria-label={`Recibir productos de ${item.seller_name}`} className="space-y-3">
          <p>Registrá las cantidades acumuladas que llegaron. La recepción no aumenta el stock disponible.</p>
          {item.inspections.map((inspection) => <label key={inspection.id} className="block">
            Recibidas de {inspection.product_name}
            <input type="number" min={inspection.received_quantity} max={inspection.expected_quantity} step={1} required
              value={received[inspection.order_item] ?? inspection.received_quantity}
              onChange={(event) => setReceived((previous) => ({ ...previous, [inspection.order_item]: Number(event.target.value) }))}
              className="ml-3 w-24 rounded border p-2" />
          </label>)}
          <button className="rounded-lg bg-green-700 px-4 py-2 text-white">Registrar recepción</button>
        </form>}
        {(item.status === "RECEIVED" || (item.status === "RETURNING" && item.inspections.some((inspection) => inspection.received_quantity > 0))) && <form onSubmit={inspect} aria-label={`Inspeccionar productos de ${item.seller_name}`} className="space-y-3">
          <p>Solo las unidades que declares aptas se incorporarán al stock disponible.</p>
          {item.inspections.map((inspection) => <div key={inspection.id} className="rounded-lg border p-3">
            <p className="font-semibold">{inspection.product_name}</p>
            <label className="mt-2 block">Aptas de {inspection.product_name}
              <input type="number" min={inspection.restocked_quantity} max={inspection.received_quantity} step={1} required
                value={restocked[inspection.order_item] ?? inspection.restocked_quantity}
                onChange={(event) => setRestocked((previous) => ({ ...previous, [inspection.order_item]: Number(event.target.value) }))}
                className="ml-3 w-24 rounded border p-2" />
            </label>
            <label className="mt-2 block">Defectuosas de {inspection.product_name}
              <input type="number" min={inspection.defective_quantity} max={inspection.received_quantity} step={1} required
                value={defective[inspection.order_item] ?? inspection.defective_quantity}
                onChange={(event) => setDefective((previous) => ({ ...previous, [inspection.order_item]: Number(event.target.value) }))}
                className="ml-3 w-24 rounded border p-2" />
            </label>
          </div>)}
          <label className="block">Resultado de la revisión
            <textarea required minLength={10} maxLength={1000} value={resolution}
              onChange={(event) => setResolution(event.target.value)} className="mt-2 block w-full rounded border p-2" />
          </label>
          <button className="rounded-lg bg-green-700 px-4 py-2 text-white">Guardar inspección</button>
        </form>}
        {item.status === "INSPECTED" && role === "admin" && <div className="space-y-3">
          <p>La revisión está completa. El reembolso se calculará con los importes de la compra.</p>
          <button type="button" onClick={() => void perform({ action: "complete", resolution })}
            className="rounded-lg bg-green-700 px-4 py-2 text-white">Completar cancelación y registrar reembolso</button>
        </div>}
        {item.status === "INSPECTED" && role === "seller" && <p>Inspección completada. Administración debe registrar el reembolso.</p>}
        {item.status === "REQUESTED" && role === "admin" && <div>
          <label className="block">Resolución para el cliente
            <textarea value={resolution} onChange={(event) => setResolution(event.target.value)} minLength={10} maxLength={1000}
              className="mt-2 block w-full rounded border p-2" />
          </label>
          <button type="button" disabled={resolution.trim().length < 10} onClick={() => void perform({ action: "reject", resolution })}
            className="mt-3 rounded-lg border border-red-300 px-4 py-2 text-red-700 disabled:opacity-50">Rechazar solicitud con resolución</button>
        </div>}
        {item.status === "COMPLETED" && role === "admin" && Number(item.shipping_refundable_amount || 0) > 0 && (
          <form onSubmit={refundShipping} aria-label={`Reembolsar envío de ${item.order_number}`} className="space-y-3 rounded-lg border p-4">
            <h4 className="font-semibold">Reembolso de gastos de envío</h4>
            <p>Saldo de envío disponible en la compra: {formatCurrency(item.shipping_refundable_amount!)}. Esta decisión se registra por separado del reembolso de productos.</p>
            <label className="block">Importe de envío a reembolsar
              <input type="number" required min="0.01" step="0.01" max={item.shipping_refundable_amount}
                value={shippingAmount} onChange={(event) => setShippingAmount(event.target.value)} className="ml-3 rounded border p-2" />
            </label>
            <label className="block">Motivo del reembolso de envío
              <textarea required minLength={10} maxLength={255} value={resolution}
                onChange={(event) => setResolution(event.target.value)} className="mt-2 block w-full rounded border p-2" />
            </label>
            <button className="rounded-lg bg-green-700 px-4 py-2 text-white">Registrar reembolso de envío</button>
          </form>
        )}
      </fieldset>}
    </article>
  );
}
