import {
  useState,
} from "react";

import {
  getAdminComplaints,
  updateComplaintStatus,
} from "../../services/adminService";

import type {
  Complaint,
} from "../../types/admin";

import { StatusBadge } from "../../features/seller/StatusBadge";

import { AdminResourceState } from "../../features/admin/AdminResourceState";
import { useAdminResource } from "../../features/admin/useAdminResource";

export function AdminComplaintsPage() {
  const { data, scope, loading, error, reload, saving, runAction } = useAdminResource(
    getAdminComplaints, "No se pudieron cargar los reclamos.",
  );
  const complaints = data ?? [];
  const [selectionScope, setSelectionScope] = useState("");

  const [selected, setSelected] =
    useState<Complaint | null>(null);

  const [resolution, setResolution] =
    useState("");

  const [status, setStatus] =
    useState("IN_REVIEW");

  async function handleResolve() {
    if (!selected || selectionScope !== scope) return;
    const updated = await runAction(() => updateComplaintStatus(selected.id, { status, resolution }),
      "No se pudo actualizar el reclamo.");
    if (updated) {
      setSelected(null);
      setResolution("");
    }
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-bold">
        Reclamos
      </h2>

      <p className="mt-1 text-gray-600">
        Moderación de incidencias de clientes.
      </p>

      <AdminResourceState loading={loading} error={error} empty={complaints.length === 0}
        loadingText="Cargando reclamos..." emptyText="No hay reclamos registrados." onRetry={reload} />

      <div className="mt-6 space-y-4">
        {complaints.map(
          (complaint) => (
            <article
              key={complaint.id}
              className="rounded-xl border p-5"
            >
              <div className="flex flex-col justify-between gap-4 md:flex-row">
                <div>
                  <h3 className="font-bold">
                    {
                      complaint.title
                    }
                  </h3>

                  <p className="mt-1 text-sm text-gray-500">
                    Orden{" "}
                    {complaint.order_number ||
                      complaint.order}
                  </p>
                </div>

                <StatusBadge
                  status={
                    complaint.status
                  }
                />
              </div>

              <p className="mt-4">
                {
                  complaint.description
                }
              </p>

              <button
                disabled={saving}
                onClick={() => {
                  setSelectionScope(scope);
                  setSelected(
                    complaint
                  );

                  setStatus(
                    complaint.status
                  );

                  setResolution(
                    complaint.resolution ||
                      ""
                  );
                }}
                className="mt-4 rounded-lg border px-4 py-2 font-medium"
              >
                Gestionar
              </button>
            </article>
          )
        )}
      </div>

      {selected && selectionScope === scope && data && (
        <div className="mt-7 rounded-xl border border-green-200 bg-green-50 p-5">
          <h3 className="font-bold">
            Resolver reclamo #
            {selected.id}
          </h3>

          <select
            disabled={saving}
            value={status}
            onChange={(event) =>
              setStatus(
                event.target.value
              )
            }
            className="mt-4 w-full rounded-lg border px-3 py-2"
          >
            <option value="OPEN">
              Abierto
            </option>

            <option value="IN_REVIEW">
              En revisión
            </option>

            <option value="RESOLVED">
              Resuelto
            </option>

            <option value="REJECTED">
              Rechazado
            </option>

            <option value="CLOSED">
              Cerrado
            </option>
          </select>

          <textarea
            disabled={saving}
            rows={4}
            placeholder="Resolución administrativa..."
            value={resolution}
            onChange={(event) =>
              setResolution(
                event.target.value
              )
            }
            className="mt-4 w-full rounded-lg border px-3 py-2"
          />

          <div className="mt-4 flex gap-3">
            <button
              disabled={saving}
              onClick={
                handleResolve
              }
              className="rounded-lg bg-green-700 px-5 py-2 font-medium text-white"
            >
              Guardar
            </button>

            <button
              disabled={saving}
              onClick={() =>
                setSelected(null)
              }
              className="rounded-lg border px-5 py-2"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}