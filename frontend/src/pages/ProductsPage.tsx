import {
  useEffect,
  useState,
} from "react";

import {
  useSearchParams,
} from "react-router";

import {
  ProductCardSkeleton,
} from "../components/ui/Skeleton";

import {
  EmptyState,
} from "../components/ui/EmptyState";

import {
  ProductCard,
} from "../features/products/ProductCard";

import {
  ProductFiltersForm,
} from "../features/products/ProductFiltersForm";

import {
  getBrands,
  getCategories,
  getProducts,
  getRegions,
} from "../services/productService";

import type {
  Brand,
  Category,
  Product,
  ProductFilters,
  Region,
} from "../types/product";

function getFiltersFromParams(
  params: URLSearchParams
): ProductFilters {
  return {
    search:
      params.get("search") ||
      undefined,

    category:
      params.get("category") ||
      undefined,

    brand:
      params.get("brand") ||
      undefined,

    region:
      params.get("region") ||
      undefined,

    min_price:
      params.get("min_price") ||
      undefined,

    max_price:
      params.get("max_price") ||
      undefined,

    in_stock:
      params.get("in_stock") ===
      "true"
        ? true
        : undefined,

    ordering:
      params.get("ordering") ||
      undefined,
  };
}

export function ProductsPage() {
  const [
    searchParams,
    setSearchParams,
  ] = useSearchParams();

  const [products, setProducts] =
    useState<Product[]>([]);

  const [
    categories,
    setCategories,
  ] = useState<Category[]>([]);

  const [brands, setBrands] =
    useState<Brand[]>([]);

  const [regions, setRegions] =
    useState<Region[]>([]);

  const [filters, setFilters] =
    useState<ProductFilters>(() =>
      getFiltersFromParams(
        searchParams
      )
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function loadOptions() {
      const results =
        await Promise.allSettled([
          getCategories(),
          getBrands(),
          getRegions(),
        ]);

      if (
        results[0].status ===
        "fulfilled"
      ) {
        setCategories(
          results[0].value
        );
      }

      if (
        results[1].status ===
        "fulfilled"
      ) {
        setBrands(
          results[1].value
        );
      }

      if (
        results[2].status ===
        "fulfilled"
      ) {
        setRegions(
          results[2].value
        );
      }
    }

    void loadOptions();
  }, []);

  useEffect(() => {
    const currentFilters =
      getFiltersFromParams(
        searchParams
      );

    setFilters(
      currentFilters
    );

    async function loadProducts() {
      try {
        setLoading(true);
        setError("");

        const data =
          await getProducts(
            currentFilters
          );

        setProducts(data);
      } catch {
        setError(
          "No se pudo cargar el catálogo."
        );
      } finally {
        setLoading(false);
      }
    }

    void loadProducts();
  }, [searchParams]);

  function applyFilters() {
    const params =
      new URLSearchParams();

    if (filters.search) {
      params.set(
        "search",
        filters.search
      );
    }

    if (filters.category) {
      params.set(
        "category",
        String(
          filters.category
        )
      );
    }

    if (filters.brand) {
      params.set(
        "brand",
        String(filters.brand)
      );
    }

    if (filters.region) {
      params.set(
        "region",
        String(filters.region)
      );
    }

    if (filters.min_price) {
      params.set(
        "min_price",
        filters.min_price
      );
    }

    if (filters.max_price) {
      params.set(
        "max_price",
        filters.max_price
      );
    }

    if (filters.in_stock) {
      params.set(
        "in_stock",
        "true"
      );
    }

    if (filters.ordering) {
      params.set(
        "ordering",
        filters.ordering
      );
    }

    setSearchParams(params);
  }

  function clearFilters() {
    setFilters({});
    setSearchParams({});
  }

  return (
    <div>
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wider text-green-700">
          Marketplace
        </p>

        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
          Productos
        </h1>

        <p className="mt-2 text-gray-600">
          Maquinaria, repuestos,
          herramientas e insumos para
          el sector agrícola.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div>
          <ProductFiltersForm
            filters={filters}
            categories={
              categories
            }
            brands={brands}
            regions={regions}
            loading={loading}
            onChange={
              setFilters
            }
            onSubmit={
              applyFilters
            }
            onClear={
              clearFilters
            }
          />
        </div>

        <section>
          <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <p className="text-sm text-gray-500">
              {loading
                ? "Buscando productos..."
                : `${products.length} producto(s) encontrado(s)`}
            </p>

            {filters.search && (
              <p className="text-sm">
                Resultados para{" "}
                <strong>
                  “
                  {
                    filters.search
                  }
                  ”
                </strong>
              </p>
            )}
          </div>

          {error && (
            <div className="mb-5 rounded-xl bg-red-50 p-4 text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({
                length: 6,
              }).map(
                (_, index) => (
                  <ProductCardSkeleton
                    key={index}
                  />
                )
              )}
            </div>
          ) : products.length ===
            0 ? (
            <EmptyState
              icon="🔍"
              title="No encontramos productos"
              description="Probá con otra búsqueda o eliminá algunos filtros."
              actionLabel="Limpiar filtros"
              actionTo="/products"
            />
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {products.map(
                (product) => (
                  <ProductCard
                    key={
                      product.id
                    }
                    product={
                      product
                    }
                  />
                )
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}