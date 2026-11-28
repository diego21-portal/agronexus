import { AdminResourceState } from "../../features/admin/AdminResourceState";
import { AdminPagination } from "../../features/admin/AdminPagination";
import { useAdminList } from "../../features/admin/useAdminList";
import { useState } from "react";

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
  const [search, setSearch] = useState("");
  const { data, loading, error, reload, saving, runAction, changePage } = useAdminList(
    getAdminProducts, "No se pudieron cargar los productos.", { search },
  );
  const products = data?.results ?? [];

  async function toggleActive(product: AdminProduct) {
    await runAction(() => updateAdminProduct(product.id, { is_active: !product.is_active }),
      "No se pudo modificar el producto.");
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 id="admin-products-heading" tabIndex={-1} className="text-2xl font-bold">
        Productos
      </h2>

      <p className="mt-1 text-gray-600">
        Supervisión global del catálogo.
      </p>

      <input
        aria-label="Buscar productos por nombre, SKU o vendedor"
        disabled={saving}
        value={search}
        onChange={(event) =>
          setSearch(
            event.target.value
          )
        }
        placeholder="Buscar producto, SKU o vendedor..."
        className="mt-6 w-full rounded-lg border px-4 py-2"
      />

      <AdminResourceState loading={loading} error={error} empty={products.length === 0}
        loadingText="Cargando productos..." emptyText="No se encontraron productos." onRetry={reload} />

      {products.length > 0 && (
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
            {products.map(
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
      {data && data.count > 0 && <AdminPagination data={data} headingId="admin-products-heading" onPage={changePage} disabled={saving} />}
    </section>
  );
}
