import { useEffect, useState } from "react";
import { getMyComplaints } from "../../services/complaintService";
import type { Complaint } from "../../types/complaint";
import { getApiErrorMessage } from "../../utils/apiError";

export function ComplaintsPage() {
  const [complaints, setComplaints] =
    useState<Complaint[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function load() {
      try {
        setComplaints(
          await getMyComplaints()
        );
      } catch (requestError) {
        setError(
          getApiErrorMessage(
            requestError,
            "No se pudieron cargar los reclamos."
          )
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  return (
    <ActivityList
      title="Mis reclamos"
      description="Seguimiento de problemas reportados."
      loading={loading}
      error={error}
      empty={complaints.length === 0}
    >
      {complaints.map((complaint) => (
        <article
          key={complaint.id}
          className="rounded-xl border border-gray-200 p-5"
        >
          <div className="flex justify-between gap-4">
            <div>
              <h3 className="font-bold">
                {complaint.title}
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                Orden{" "}
                {complaint.order_number ||
                  complaint.order}
              </p>
            </div>

            <span className="h-fit rounded-full bg-gray-100 px-3 py-1 text-sm">
              {complaint.status}
            </span>
          </div>

          <p className="mt-4 text-gray-700">
            {complaint.description}
          </p>

          {complaint.resolution && (
            <div className="mt-4 rounded-lg bg-green-50 p-4">
              <p className="text-sm font-bold text-green-800">
                Resolución
              </p>

              <p className="mt-1 text-green-800">
                {complaint.resolution}
              </p>
            </div>
          )}
        </article>
      ))}
    </ActivityList>
  );
}

function ActivityList({
  title,
  description,
  loading,
  error,
  empty,
  children,
}: {
  title: string;
  description: string;
  loading: boolean;
  error: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-bold">
        {title}
      </h2>

      <p className="mt-1 text-gray-600">
        {description}
      </p>

      {error && (
        <div className="mt-5 rounded-lg bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="mt-6">Cargando...</p>
      ) : empty ? (
        <p className="mt-6 rounded-xl bg-gray-50 p-6 text-center text-gray-600">
          No hay registros.
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {children}
        </div>
      )}
    </section>
  );
}