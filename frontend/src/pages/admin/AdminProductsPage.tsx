import { AdminResourceState } from "../../features/admin/AdminResourceState";
import { useAdminResource } from "../../features/admin/useAdminResource";
import {
  useMemo,
  useState,
} from "react";

import {
  getAdminProducts,
  updateAdminProduct,
} from "../../services/adminService";

import type {
  AdminProduct,
} from "../../types/admin";

import { StatusBadge } from "../../features/seller/StatusBadge";
import { formatCurrency } from "../../utils/currency";

export function AdminProductsPage() {
  const { data, loading, error, reload, saving, runAction } = useAdminResource(getAdminProducts, "No se pudieron cargar los productos.");
  const [search, setSearch] = useState("");

  const filtered =
    useMemo(() => {
      const query =
        search.toLowerCase();

      return (data ?? []).filter(
        (product) =>
          product.name
            .toLowerCase()
            .includes(query) ||
          product.sku
            .toLowerCase()
            .includes(query) ||
          (
            product.seller_name ||
            ""
          )
            .toLowerCase()
            .includes(query)
      );
    }, [data, search]);

  async function toggleActive(product: AdminProduct) {
    await runAction(() => updateAdminProduct(product.id, { is_active: !product.is_active }),
      "No se pudo modificar el producto.");
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-bold">
        Productos
      </h2>

      <p className="mt-1 text-gray-600">
        Supervisión global del catálogo.
      </p>

      <input
        value={search}
        onChange={(event) =>
          setSearch(
            event.target.value
          )
        }
        placeholder="Buscar producto, SKU o vendedor..."
        className="mt-6 w-full rounded-lg border px-4 py-2"
      />

      <AdminResourceState loading={loading} error={error} empty={filtered.length === 0}
        loadingText="Cargando productos..." emptyText="No se encontraron productos." onRetry={reload} />

      {data && (
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b text-gray-500">
              <th className="pb-3">
                Producto
              </th>

              <th className="pb-3">
                Vendedor
              </th>

              <th className="pb-3">
                Precio
              </th>

              <th className="pb-3">
                Stock
              </th>

              <th className="pb-3">
                Estado
              </th>

              <th className="pb-3 text-right">
                Acción
              </th>
            </tr>
          </thead>

          <tbody>
            {filtered.map(
              (product) => (
                <tr
                  key={product.id}
                  className="border-b"
                >
                  <td className="py-4">
                    <p className="font-semibold">
                      {product.name}
                    </p>

                    <p className="text-xs text-gray-500">
                      {product.sku}
                    </p>
                  </td>

                  <td className="py-4">
                    {product.seller
                      ?.business_name ||
                      product.seller_name ||
                      "—"}
                  </td>

                  <td className="py-4 font-semibold">
                    {formatCurrency(
                      product.current_price ??
                        product.price
                    )}
                  </td>

                  <td className="py-4">
                    {product.stock}
                  </td>

                  <td className="py-4">
                    <span className="mr-2">{product.is_active ? "Activo" : "Inactivo"}</span>
                    <StatusBadge
                      status={
                        product.status
                      }
                    />
                  </td>

                  <td className="py-4 text-right">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        toggleActive(
                          product
                        )
                      }
                      className={
                        product.is_active
                          ? "rounded-lg border border-red-200 px-3 py-2 text-red-700"
                          : "rounded-lg border border-green-200 px-3 py-2 text-green-700"
                      }
                    >
                      {product.is_active
                        ? "Desactivar"
                        : "Activar"}
                    </button>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
      )}
    </section>
  );
}