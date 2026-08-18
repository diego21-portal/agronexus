import { useEffect, useState } from "react";

import {
  getAdminSellers,
  verifyAdminSeller,
} from "../../services/adminService";

import type { AdminSeller } from "../../types/admin";

import { getApiErrorMessage } from "../../utils/apiError";

export function AdminSellersPage() {
  const [sellers, setSellers] = useState<AdminSeller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadSellers() {
    try {
      setLoading(true);
      setError("");

      const data = await getAdminSellers();
      setSellers(data);
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "No se pudieron cargar los vendedores."
        )
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSellers();
  }, []);

  async function toggleVerified(seller: AdminSeller) {
    try {
      setError("");

      await verifyAdminSeller(
        seller.id,
        !seller.is_verified
      );

      await loadSellers();
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "No se pudo actualizar la verificación del vendedor."
        )
      );
    }
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-2xl font-bold">
          Vendedores
        </h2>

        <p className="mt-1 text-gray-600">
          Supervisión y verificación de vendedores de AgroNexus.
        </p>
      </div>

      {error && (
        <div className="mt-5 rounded-lg bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="mt-6 text-gray-600">
          Cargando vendedores...
        </p>
      ) : sellers.length === 0 ? (
        <div className="mt-6 rounded-xl bg-gray-50 p-8 text-center text-gray-600">
          No hay vendedores registrados.
        </div>
      ) : (
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
    </section>
  );
}