import {
  useEffect,
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
import { getApiErrorMessage } from "../../utils/apiError";

export function AdminProductsPage() {
  const [products, setProducts] =
    useState<AdminProduct[]>([]);

  const [search, setSearch] =
    useState("");

  const [error, setError] =
    useState("");

  async function loadProducts() {
    try {
      setProducts(
        await getAdminProducts()
      );
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "No se pudieron cargar los productos."
        )
      );
    }
  }

  useEffect(() => {
    void loadProducts();
  }, []);

  const filtered =
    useMemo(() => {
      const query =
        search.toLowerCase();

      return products.filter(
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
    }, [products, search]);

  async function toggleActive(
    product: AdminProduct
  ) {
    try {
      await updateAdminProduct(
        product.id,
        {
          is_active:
            !product.is_active,
        }
      );

      await loadProducts();
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "No se pudo modificar el producto."
        )
      );
    }
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

      {error && (
        <div className="mt-5 rounded-lg bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

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
                      product.current_price ||
                        product.price
                    )}
                  </td>

                  <td className="py-4">
                    {product.stock}
                  </td>

                  <td className="py-4">
                    <StatusBadge
                      status={
                        product.status
                      }
                    />
                  </td>

                  <td className="py-4 text-right">
                    <button
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
    </section>
  );
}