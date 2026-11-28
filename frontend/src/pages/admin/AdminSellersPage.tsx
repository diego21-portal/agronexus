import { AdminResourceState } from "../../features/admin/AdminResourceState";
import { AdminPagination } from "../../features/admin/AdminPagination";
import { useAdminList } from "../../features/admin/useAdminList";

import {
  getAdminSellers,
  verifyAdminSeller,
} from "../../services/adminService";

import type { AdminSeller } from "../../types/admin";

export function AdminSellersPage() {
  const { data, loading, error, reload, saving, runAction, changePage } = useAdminList(getAdminSellers, "No se pudieron cargar los vendedores.");
  const sellers = data?.results ?? [];

  async function toggleVerified(seller: AdminSeller) {
    await runAction(() => verifyAdminSeller(seller.id, !seller.is_verified),
      "No se pudo actualizar la verificación del vendedor.");
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <div>
        <h2 id="admin-sellers-heading" tabIndex={-1} className="text-2xl font-bold">
          Vendedores
        </h2>

        <p className="mt-1 text-gray-600">
          Supervisión y verificación de vendedores de AgroNexus.
        </p>
      </div>

      <AdminResourceState loading={loading} error={error} empty={sellers.length === 0}
        loadingText="Cargando vendedores..." emptyText="No hay vendedores registrados." onRetry={reload} />

      {sellers.length > 0 && (
        <div className="mt-6 space-y-4">
          {sellers.map((seller) => (
            <article
              key={seller.id}
              className="rounded-xl border border-gray-200 p-5"
            >
              <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold">
                      {seller.business_name}
                    </h3>

                    <span
                      className={
                        seller.is_verified
                          ? "rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700"
                          : "rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700"
                      }
                    >
                      {seller.is_verified
                        ? "Verificado"
                        : "Sin verificar"}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-gray-500">
                    {seller.user?.email ||
                      seller.tax_id ||
                      "Sin información de contacto"}
                  </p>

                  {seller.description && (
                    <p className="mt-3 max-w-2xl text-sm text-gray-600">
                      {seller.description}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-5 text-sm">
                    <span>
                      Calificación:{" "}
                      <strong>
                        ⭐ {seller.rating_average || 0}
                      </strong>
                    </span>

                    <span>
                      Ventas:{" "}
                      <strong>
                        {seller.total_sales || 0}
                      </strong>
                    </span>

                    <span>
                      Estado:{" "}
                      <strong
                        className={
                          seller.is_active
                            ? "text-green-700"
                            : "text-red-700"
                        }
                      >
                        {seller.is_active
                          ? "Activo"
                          : "Inactivo"}
                      </strong>
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => toggleVerified(seller)}
                  className={
                    seller.is_verified
                      ? "rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                      : "rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
                  }
                >
                  {seller.is_verified
                    ? "Quitar verificación"
                    : "Verificar vendedor"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {data && data.count > 0 && <AdminPagination data={data} headingId="admin-sellers-heading" onPage={changePage} disabled={saving} />}
    </section>
  );
}
