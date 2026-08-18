import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { Link } from "react-router";

import {
  deleteSellerProduct,
  getSellerProducts,
} from "../../services/sellerService";

import type { SellerProduct } from "../../types/seller";

import { ProductPrice } from "../../features/products/ProductPrice";
import { StatusBadge } from "../../features/seller/StatusBadge";

import { getApiErrorMessage } from "../../utils/apiError";

export function SellerProductsPage() {
  const [products, setProducts] =
    useState<SellerProduct[]>([]);

  const [search, setSearch] =
    useState("");

  const [status, setStatus] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  async function loadProducts() {
    try {
      setLoading(true);

      setProducts(
        await getSellerProducts()
      );
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "No se pudieron cargar los productos."
        )
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(
    product: SellerProduct
  ) {
    const confirmed =
      window.confirm(
        `¿Querés archivar/eliminar "${product.name}"?`
      );

    if (!confirmed) {
      return;
    }

    try {
      await deleteSellerProduct(
        product.id
      );

      await loadProducts();
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "No se pudo eliminar el producto."
        )
      );
    }
  }

  useEffect(() => {
    void loadProducts();
  }, []);

  const filteredProducts =
    useMemo(() => {
      const normalizedSearch =
        search.trim().toLowerCase();

      return products.filter(
        (product) => {
          const matchesSearch =
            !normalizedSearch ||
            product.name
              .toLowerCase()
              .includes(
                normalizedSearch
              ) ||
            product.sku
              .toLowerCase()
              .includes(
                normalizedSearch
              );

          const matchesStatus =
            !status ||
            product.status ===
              status;

          return (
            matchesSearch &&
            matchesStatus
          );
        }
      );
    }, [products, search, status]);

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h2 className="text-2xl font-bold">
            Mis productos
          </h2>

          <p className="mt-1 text-gray-600">
            Gestioná tu catálogo publicado.
          </p>
        </div>

        <Link
          to="/seller/products/new"
          className="rounded-lg bg-green-700 px-5 py-3 text-center font-semibold text-white hover:bg-green-800"
        >
          + Nuevo producto
        </Link>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-[1fr_220px]">
        <input
          placeholder="Buscar por nombre o SKU..."
          value={search}
          onChange={(event) =>
            setSearch(
              event.target.value
            )
          }
          className="rounded-lg border border-gray-300 px-4 py-2"
        />

        <select
          value={status}
          onChange={(event) =>
            setStatus(
              event.target.value
            )
          }
          className="rounded-lg border border-gray-300 px-4 py-2"
        >
          <option value="">
            Todos los estados
          </option>

          <option value="PUBLISHED">
            Publicados
          </option>

          <option value="DRAFT">
            Borradores
          </option>

          <option value="OUT_OF_STOCK">
            Sin stock
          </option>

          <option value="ARCHIVED">
            Archivados
          </option>
        </select>
      </div>

      {error && (
        <div className="mt-5 rounded-lg bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="mt-6">
          Cargando productos...
        </p>
      ) : filteredProducts.length ===
        0 ? (
        <div className="mt-6 rounded-xl bg-gray-50 p-8 text-center">
          No se encontraron productos.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="pb-3">
                  Producto
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
                  Acciones
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredProducts.map(
                (product) => (
                  <tr
                    key={product.id}
                    className="border-b last:border-0"
                  >
                    <td className="py-4">
                      <p className="font-semibold">
                        {product.name}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        {product.sku}
                      </p>
                    </td>

                    <td className="py-4">
                      <ProductPrice
                        price={
                          product.price
                        }
                        discountPrice={
                          product.discount_price
                        }
                        currentPrice={
                          product.current_price
                        }
                      />
                    </td>

                    <td className="py-4">
                      <span
                        className={
                          product.stock <=
                          product.minimum_stock
                            ? "font-semibold text-red-700"
                            : "font-semibold text-green-700"
                        }
                      >
                        {product.stock}
                      </span>
                    </td>

                    <td className="py-4">
                      <StatusBadge
                        status={
                          product.status
                        }
                      />
                    </td>

                    <td className="py-4">
                      <div className="flex justify-end gap-2">
                        <Link
                          to={`/seller/products/${product.id}/edit`}
                          className="rounded-lg border px-3 py-2 font-medium hover:bg-gray-50"
                        >
                          Editar
                        </Link>

                        <Link
                          to={`/seller/products/${product.id}/stock`}
                          className="rounded-lg border border-green-200 px-3 py-2 font-medium text-green-700 hover:bg-green-50"
                        >
                          Stock
                        </Link>

                        <button
                          onClick={() =>
                            handleDelete(
                              product
                            )
                          }
                          className="rounded-lg border border-red-200 px-3 py-2 font-medium text-red-700 hover:bg-red-50"
                        >
                          Archivar
                        </button>
                      </div>
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