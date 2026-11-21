import type { DeliveryAddressSnapshot, DeliveryAddressSnapshotSource } from "../../types/order";

export function DeliveryAddress({ snapshot, source, title = "Dirección de entrega registrada" }: {
  snapshot?: DeliveryAddressSnapshot | null;
  source?: DeliveryAddressSnapshotSource;
  title?: string;
}) {
  return <section className="rounded-2xl bg-white p-6 shadow-sm">
    <h3 className="text-xl font-bold">{title}</h3>
    {source === "CHECKOUT" && snapshot ? <div className="mt-4 text-gray-700">
      <p className="font-medium">{snapshot.street} {snapshot.number}</p>
      <p>{snapshot.city}, {snapshot.province}</p>
      <p>CP {snapshot.postal_code}</p>
      {snapshot.region_name && <p className="text-sm">{snapshot.region_name}</p>}
      {snapshot.reference && <p className="mt-2 text-sm text-gray-500">{snapshot.reference}</p>}
    </div> : <p className="mt-4 text-sm text-amber-900">
      Este pedido anterior no conserva una copia verificable de la dirección de entrega original.
    </p>}
  </section>;
}
