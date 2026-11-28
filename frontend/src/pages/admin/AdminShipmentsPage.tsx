import { AdminResourceState } from "../../features/admin/AdminResourceState";
import { AdminPagination } from "../../features/admin/AdminPagination";
import { useAdminList } from "../../features/admin/useAdminList";

import { getAdminShipments } from "../../services/adminService";

import { StatusBadge } from "../../features/seller/StatusBadge";

export function AdminShipmentsPage() {
  const { data, loading, error, reload, changePage } = useAdminList(getAdminShipments, "No se pudieron cargar los envíos.");
  const shipments = data?.results ?? [];

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 id="admin-shipments-heading" tabIndex={-1} className="text-2xl font-bold">
        Envíos
      </h2>

      <p className="mt-1 text-gray-600">
        Estado logístico global.
      </p>

      <AdminResourceState loading={loading} error={error} empty={shipments.length === 0}
        loadingText="Cargando envíos..." emptyText="No hay envíos registrados." onRetry={reload} />

      {shipments.length > 0 && (
      <div className="mt-6 space-y-3">
        {shipments.map(
          (shipment) => (
            <article
              key={shipment.id}
              className="flex flex-col justify-between gap-4 rounded-xl border p-5 md:flex-row md:items-center"
            >
              <div>
                <p className="font-bold">
                  Orden{" "}
                  {shipment.order_number ||
                    shipment.order}
                </p>

                <p className="mt-1 font-mono text-xs text-gray-500">
                  {shipment.tracking_code ||
                    "Sin tracking"}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">
                  {
                    shipment.carrier ||
                    "Sin transportista"
                  }
                </p>
              </div>

              <StatusBadge
                status={
                  shipment.status
                }
              />
            </article>
          )
        )}
      </div>
      )}
      {data && data.count > 0 && <AdminPagination data={data} headingId="admin-shipments-heading" onPage={changePage} />}
    </section>
  );
}
