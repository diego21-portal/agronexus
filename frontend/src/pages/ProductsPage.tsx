import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { ProductCardSkeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { ProductCard } from "../features/products/ProductCard";
import { ProductFiltersForm } from "../features/products/ProductFiltersForm";
import { getBrands, getCategories, getProductPage, getRegions } from "../services/productService";
import type { PaginatedResponse } from "../types/api";
import type { Brand, Category, CatalogProduct, ProductFilters, Region } from "../types/product";
import { getApiErrorMessage } from "../utils/apiError";

function positiveInteger(value: string | null, fallback: number) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}

function getFiltersFromParams(params: URLSearchParams): ProductFilters {
  return {
    search: params.get("search") || undefined,
    category: params.get("category") || undefined,
    brand: params.get("brand") || undefined,
    region: params.get("region") || undefined,
    min_price: params.get("min_price") || undefined,
    max_price: params.get("max_price") || undefined,
    in_stock: params.get("in_stock") === "true" ? true : undefined,
    ordering: params.get("ordering") || undefined,
    page: positiveInteger(params.get("page"), 1),
    page_size: positiveInteger(params.get("page_size"), 24),
  };
}

interface CatalogState {
  query: string;
  page: PaginatedResponse<CatalogProduct> | null;
  loading: boolean;
  error: string;
}

export function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.toString();
  const appliedFilters = getFiltersFromParams(searchParams);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [filters, setFilters] = useState<ProductFilters>(appliedFilters);
  const [filterError, setFilterError] = useState("");
  const [retry, setRetry] = useState(0);
  const [catalog, setCatalog] = useState<CatalogState>({ query, page: null, loading: true, error: "" });

  useEffect(() => {
    let active = true;
    void Promise.allSettled([getCategories(), getBrands(), getRegions()]).then((results) => {
      if (!active) return;
      if (results[0].status === "fulfilled") setCategories(results[0].value);
      if (results[1].status === "fulfilled") setBrands(results[1].value);
      if (results[2].status === "fulfilled") setRegions(results[2].value);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const currentFilters = getFiltersFromParams(new URLSearchParams(query));
    setFilters(currentFilters);
    setFilterError("");
    setCatalog({ query, page: null, loading: true, error: "" });
    void getProductPage(currentFilters).then((page) => {
      if (active) setCatalog({ query, page, loading: false, error: "" });
    }).catch((error: unknown) => {
      if (active) setCatalog({ query, page: null, loading: false,
        error: getApiErrorMessage(error, "No se pudo cargar el catálogo.") });
    });
    return () => { active = false; };
  }, [query, retry]);

  function applyFilters() {
    const prices = [filters.min_price, filters.max_price].filter((price) => price !== undefined && price !== "");
    if (prices.some((price) => !Number.isFinite(Number(price)) || Number(price) < 0)) {
      setFilterError("Los precios deben ser números mayores o iguales a cero.");
      return;
    }
    if (filters.min_price && filters.max_price && Number(filters.min_price) > Number(filters.max_price)) {
      setFilterError("El precio mínimo no puede superar al máximo.");
      return;
    }
    setFilterError("");
    const params = new URLSearchParams();
    for (const field of ["search", "category", "brand", "region", "min_price", "max_price", "ordering"] as const) {
      const value = filters[field];
      if (value) params.set(field, value);
    }
    if (filters.in_stock) params.set("in_stock", "true");
    if (filters.page_size && filters.page_size !== 24) params.set("page_size", String(filters.page_size));
    setSearchParams(params);
  }

  function changePage(page: number) {
    const params = new URLSearchParams(searchParams);
    if (page > 1) params.set("page", String(page));
    else params.delete("page");
    setSearchParams(params);
  }

  const current = catalog.query === query ? catalog : { page: null, loading: true, error: "" };
  const products = current.page?.results ?? [];
  const pageNumber = appliedFilters.page ?? 1;
  const loading = current.loading;

  return (
    <div>
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wider text-green-700">Marketplace</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Productos</h1>
        <p className="mt-2 text-gray-600">Maquinaria, repuestos, herramientas e insumos para el sector agrícola.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div>
          <ProductFiltersForm filters={filters} categories={categories} brands={brands} regions={regions}
            loading={loading} onChange={setFilters} onSubmit={applyFilters}
            onClear={() => { setFilterError(""); setFilters({}); setSearchParams({}); }} />
          {filterError && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-4 text-red-700">{filterError}</p>}
        </div>
        <section aria-label="Resultados del catálogo">
          <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <p role="status" className="text-sm text-gray-500">
              {loading ? "Buscando productos..." : current.error ? "Catálogo no disponible" : `${current.page?.count ?? 0} producto(s) encontrado(s)`}
            </p>
            {appliedFilters.search && <p className="text-sm">Resultados para <strong>“{appliedFilters.search}”</strong></p>}
          </div>
          {current.error ? (
            <div role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-red-700">
              <p>{current.error}</p>
              <button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-3 rounded-lg border px-4 py-2">Reintentar</button>
            </div>
          ) : loading ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => <ProductCardSkeleton key={index} />)}
            </div>
          ) : products.length === 0 ? (
            <EmptyState icon="🔍" title="No encontramos productos"
              description="Probá con otra búsqueda o eliminá algunos filtros." actionLabel="Limpiar filtros" actionTo="/products" />
          ) : (
            <>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {products.map((product) => <ProductCard key={product.id} product={product} />)}
              </div>
              <nav aria-label="Páginas del catálogo" className="mt-6 flex items-center justify-between gap-4">
                <button type="button" disabled={!current.page?.previous} onClick={() => changePage(pageNumber - 1)}
                  className="rounded-lg border px-4 py-2 disabled:opacity-50">Anterior</button>
                <span>Página {pageNumber}</span>
                <button type="button" disabled={!current.page?.next} onClick={() => changePage(pageNumber + 1)}
                  className="rounded-lg border px-4 py-2 disabled:opacity-50">Siguiente</button>
              </nav>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
