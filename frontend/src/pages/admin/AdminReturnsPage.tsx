import { useEffect, useState } from "react";

import {
  getAdminReturns,
  updateReturnStatus,
} from "../../services/adminService";

import type { ReturnRequest } from "../../types/admin";

import { StatusBadge } from "../../features/seller/StatusBadge";
import { getApiErrorMessage } from "../../utils/apiError";

export function AdminReturnsPage() {
  const [returns, setReturns] = useState<ReturnRequest[]>([]);

  const [selected, setSelected] =
    useState<ReturnRequest | null>(null);

  const [status, setStatus] =
    useState("UNDER_REVIEW");

  const [resolution, setResolution] =
    useState("");

  const [refund, setRefund] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  async function loadReturns() {
    try {
      setLoading(true);
      setError("");

      const data = await getAdminReturns();
      setReturns(data);
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "No se pudieron cargar las devoluciones."
        )
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReturns();
  }, []);

  function openReturn(item: ReturnRequest) {
    setSelected(item);

    setStatus(
      item.status || "UNDER_REVIEW"
    );

    setResolution(
      item.resolution || ""
    );

    setRefund(
      item.approved_refund_amount || ""
    );

    setMessage("");
    setError("");
  }

  function closeEditor() {
    setSelected(null);
    setResolution("");
    setRefund("");
  }

  async function handleUpdate() {
    if (!selected) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      await updateReturnStatus(
        selected.id,
        {
          status,
          resolution,

          ...(refund
            ? {
                approved_refund_amount:
                  refund,
              }
            : {}),
        }
      );

      setMessage(
        "Devolución actualizada correctamente."
      );

      closeEditor();

      await loadReturns();
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "No se pudo actualizar la devolución."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-2xl font-bold">
          Devoluciones
        </h2>

        <p className="mt-1 text-gray-600">
          Revisá y resolvé solicitudes de devolución de clientes.
        </p>
      </div>

      {error && (
        <div className="mt-5 rounded-lg bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="mt-5 rounded-lg bg-green-50 p-4 text-green-700">
          {message}
        </div>
      )}

      {loading ? (
        <p className="mt-6 text-gray-600">
          Cargando devoluciones...
        </p>
      ) : returns.length === 0 ? (
        <div className="mt-6 rounded-xl bg-gray-50 p-8 text-center text-gray-600">
          No hay solicitudes de devolución.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {returns.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-gray-200 p-5"
            >
              <div className="flex flex-col justify-between gap-4 md:flex-row">
                <div>
                  <h3 className="font-bold">
                    {item.product_name ||
                      `Ítem ${item.order_item}`}
                  </h3>

                  <p className="mt-1 text-sm text-gray-500">
                    Orden:{" "}
                    {item.order_number || "Sin número"}
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    Cantidad: {item.quantity}
                  </p>
                </div>

                <StatusBadge
                  status={item.status}
                />
              </div>

              <div className="mt-4">
                <p className="text-xs font-semibold uppercase text-gray-500">
                  Motivo
                </p>

                <p className="mt-1 font-medium">
                  {item.reason}
                </p>
              </div>

              <p className="mt-4 text-gray-700">
                {item.description}
              </p>

              {item.requested_refund_amount && (
                <p className="mt-4 text-sm">
                  Reembolso solicitado:{" "}
                  <strong>
                    ${item.requested_refund_amount}
                  </strong>
                </p>
              )}

              {item.approved_refund_amount && (
                <p className="mt-2 text-sm text-green-700">
                  Reembolso aprobado:{" "}
                  <strong>
                    ${item.approved_refund_amount}
                  </strong>
                </p>
              )}

              <button
                type="button"
                onClick={() => openReturn(item)}
                className="mt-5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
              >
                Gestionar devolución
              </button>
            </article>
          ))}
        </div>
      )}

      {selected && (
        <div className="mt-8 rounded-2xl border border-green-200 bg-green-50 p-6">
          <h3 className="text-lg font-bold">
            Gestionar devolución #{selected.id}
          </h3>

          <p className="mt-1 text-sm text-gray-600">
            {selected.product_name ||
              `Ítem ${selected.order_item}`}
          </p>

          <div className="mt-5">
            <label className="mb-1 block text-sm font-medium">
              Estado
            </label>

            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value)
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
            >
              <option value="REQUESTED">
                Solicitada
              </option>

              <option value="UNDER_REVIEW">
                En revisión
              </option>

              <option value="APPROVED">
                Aprobada
              </option>

              <option value="REJECTED">
                Rechazada
              </option>

              <option value="RECEIVED">
                Producto recibido
              </option>

              <option value="REFUNDED">
                Reembolsada
              </option>

              <option value="CLOSED">
                Cerrada
              </option>
            </select>
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium">
              Reembolso aprobado
            </label>

            <input
              type="number"
              min="0"
              step="0.01"
              value={refund}
              onChange={(event) =>
                setRefund(event.target.value)
              }
              placeholder="0.00"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
            />
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium">
              Resolución administrativa
            </label>

            <textarea
              rows={4}
              value={resolution}
              onChange={(event) =>
                setResolution(
                  event.target.value
                )
              }
              placeholder="Explicá cómo se resolvió la solicitud..."
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
            />
          </div>

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={handleUpdate}
              disabled={saving}
              className="rounded-lg bg-green-700 px-5 py-2 font-medium text-white hover:bg-green-800 disabled:opacity-50"
            >
              {saving
                ? "Guardando..."
                : "Guardar cambios"}
            </button>

            <button
              type="button"
              onClick={closeEditor}
              disabled={saving}
              className="rounded-lg border border-gray-300 bg-white px-5 py-2 font-medium"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}