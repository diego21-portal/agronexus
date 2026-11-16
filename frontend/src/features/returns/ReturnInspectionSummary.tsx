import type { ReturnInspection } from "../../types/return";

export function ReturnInspectionSummary({ inspection }: { inspection?: ReturnInspection | null }) {
  if (!inspection) return null;
  return (
    <div className="mt-4 rounded-xl bg-gray-50 p-4">
      <h4 className="font-semibold">Recepción e inspección</h4>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Quantity label="Recibidas" value={`${inspection.received_quantity} de ${inspection.expected_quantity}`} />
        <Quantity label="Pendientes de inspección" value={inspection.quarantined_quantity} />
        <Quantity label="Aptas, repuestas al stock" value={inspection.restocked_quantity} />
        <Quantity label="Defectuosas, fuera de venta" value={inspection.defective_quantity} />
      </dl>
    </div>
  );
}

function Quantity({ label, value }: { label: string; value: string | number }) {
  return <div><dt className="text-gray-600">{label}</dt><dd className="mt-1 font-bold">{value}</dd></div>;
}
