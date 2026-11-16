import { formatCurrency } from "../../utils/currency";

export function OrderAmounts({ original, refunded = "0.00", net, reviewRequired = false }: {
  original: string; refunded?: string; net?: string; reviewRequired?: boolean;
}) {
  return <dl className="mt-4 space-y-2 rounded-lg bg-gray-50 p-4 text-sm">
    <Row label="Importe original" value={original} />
    <Row label="Reembolso registrado" value={refunded} />
    <Row label="Importe neto" value={net ?? String(Number(original) - Number(refunded))} />
    {reviewRequired && <div role="status" className="rounded bg-amber-50 p-3 text-amber-900">
      <dt className="font-semibold">Revisión de reembolsos históricos pendiente</dt>
      <dd>Los importes mostrados corresponden al registro nuevo. Administración debe conciliar el historial antes de autorizar otros reembolsos.</dd>
    </div>}
  </dl>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3"><dt>{label}</dt><dd className="font-semibold">{formatCurrency(value)}</dd></div>;
}
