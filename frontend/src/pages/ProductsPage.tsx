import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { EmptyState } from "../components/ui/EmptyState";
import { ProductCardSkeleton } from "../components/ui/Skeleton";
import { ProductCard } from "../features/products/ProductCard";
import { ProductFiltersForm } from "../features/products/ProductFiltersForm";
import { useRemoteList } from "../hooks/useRemoteList";
import { getBrands, getCategories, getProductPage, getRegions } from "../services/productService";
import type { PaginatedResponse } from "../types/api";
import type { CatalogProduct, ProductFilters } from "../types/product";

const textFilters = ["search", "category", "brand", "region", "min_price", "max_price", "ordering"] as const;

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

type Results =
  | { query: string; status: "loading" }
  | { query: string; status: "error" }
  | { query: string; status: "loaded"; page: PaginatedResponse<CatalogProduct> };

export function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.toString();
  const appliedFilters = getFiltersFromParams(searchParams);
  const categories = useRemoteList(getCategories);
  const brands = useRemoteList(getBrands);
  const regions = useRemoteList(getRegions);
  const [filters, setFilters] = useState<ProductFilters>(appliedFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterError, setFilterError] = useState("");
  const [revision, setRevision] = useState(0);
  const [results, setResults] = useState<Results>({ query, status: "loading" });
  const filterToggle = useRef<HTMLButtonElement>(null);
  const resultsSection = useRef<HTMLElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    const currentFilters = getFiltersFromParams(new URLSearchParams(query));
    setFilters(currentFilters);
    setFilterError("");
    setResults({ query, status: "loading" });
    void getProductPage(currentFilters, controller.signal).then(
      (page) => {
        if (!controller.signal.aborted) setResults({ query, status: "loaded", page });
      },
      () => {
        if (!controller.signal.aborted) setResults({ query, status: "error" });
      },
    );
    return () => controller.abort();
  }, [query, revision]);

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

    const params = new URLSearchParams();
    for (const field of textFilters) {
      const value = filters[field];
      if (value) params.set(field, value);
    }
    if (filters.in_stock) params.set("in_stock", "true");
    if (filters.page_size && filters.page_size !== 24) params.set("page_size", String(filters.page_size));
    setFilterError("");
    setSearchParams(params);
    if (filtersOpen) filterToggle.current?.focus();
    setFiltersOpen(false);
  }

  function changePage(page: number) {
    const params = new URLSearchParams(searchParams);
    if (page > 1) params.set("page", String(page));
    else params.delete("page");
    resultsSection.current?.focus({ preventScroll: true });
    resultsSection.current?.scrollIntoView({ block: "start", behavior: "instant" });
    setSearchParams(params);
  }

  function removeFilter(field: string) {
    const params = new URLSearchParams(searchParams);
    params.delete(field);
    params.delete("page");
    setSearchParams(params);
  }

  const categoryOptions = categories.state.status === "loaded" ? categories.state.items : [];
  const brandOptions = brands.state.status === "loaded" ? brands.state.items : [];
  const regionOptions = regions.state.status === "loaded" ? regions.state.items : [];
  const failedOptions = [categories, brands, regions].filter(({ state }) => state.status === "error");

  const activeFilters = [
    ["search", appliedFilters.search && `Búsqueda: ${appliedFilters.search}`],
    ["category", categoryOptions.find((option) => option.slug === appliedFilters.category)?.name || appliedFilters.category],
    ["brand", brandOptions.find((option) => option.slug === appliedFilters.brand)?.name || appliedFilters.brand],
    ["region", regionOptions.find((option) => (option.slug || String(option.id)) === appliedFilters.region)?.name || appliedFilters.region],
    ["min_price", appliedFilters.min_price && `Desde $ ${appliedFilters.min_price}`],
    ["max_price", appliedFilters.max_price && `Hasta $ ${appliedFilters.max_price}`],
    ["in_stock", appliedFilters.in_stock && "Con stock"],
  ] as const;

  const current = results.query === query ? results : { query, status: "loading" as const };
  const count = current.status === "loaded" ? current.page.count : null;

  return (
    <div>
      <header className="mb-5 rounded-2xl border border-agro-line bg-agro-cream p-5 sm:mb-7 sm:p-8">
        <h1 className="font-display text-4xl leading-none tracking-tight text-agro-forest sm:text-5xl">Productos</h1>
        <p className="mt-2 max-w-prose text-agro-muted">Maquinaria, repuestos, herramientas e insumos para el sector agrícola.</p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-6">
        <div className="min-w-0">
          <button
            ref={filterToggle}
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="catalog-filters"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-agro-control bg-white px-4 font-semibold text-agro-forest lg:hidden"
            onClick={() => setFiltersOpen((open) => !open)}
          >
            Filtros <span aria-hidden="true">{filtersOpen ? "−" : "+"}</span>
          </button>
          <div id="catalog-filters" className={filtersOpen ? "mt-3 lg:mt-0" : "hidden lg:block"}>
            <ProductFiltersForm
              filters={filters}
              categories={categoryOptions}
              brands={brandOptions}
              regions={regionOptions}
              loading={current.status === "loading"}
              onChange={setFilters}
              onSubmit={applyFilters}
              onClear={() => { setFilterError(""); setFilters({}); setSearchParams({}); }}
            />
            {filterError && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-4 text-red-900">{filterError}</p>}
            {failedOptions.length > 0 && (
              <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                <p role="status">Algunas opciones de filtro no se pudieron cargar.</p>
                <button type="button" onClick={() => failedOptions.forEach(({ retry }) => retry())} className="mt-1 min-h-11 font-semibold underline underline-offset-4">
                  Reintentar opciones
                </button>
              </div>
            )}
          </div>
        </div>

        <section ref={resultsSection} aria-label="Resultados del catálogo" tabIndex={-1} className="min-w-0 @3xl:scroll-mt-40">
          <p role="status" className="mb-4 font-semibold text-agro-muted">
            {current.status === "loading" ? "Buscando productos…" : current.status === "error" ? "Catálogo no disponible"
              : count === 1 ? "1 producto encontrado" : `${count} productos encontrados`}
          </p>
          {activeFilters.some(([, label]) => Boolean(label)) && (
            <ul aria-label="Filtros activos" className="mb-4 flex flex-wrap gap-2">
              {activeFilters.map(([field, label]) => label && (
                <li key={field} className="max-w-full">
                  <button
                    type="button"
                    aria-label={`Quitar filtro ${label}`}
                    onClick={() => removeFilter(field)}
                    className="inline-flex min-h-10 max-w-full items-center gap-2 rounded-full border border-agro-line bg-agro-mist px-3 text-left text-sm font-semibold text-agro-forest hover:border-agro-forest"
                  >
                    <span className="min-w-0 break-words">{label}</span><span aria-hidden="true">×</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {current.status === "error" ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
              <p role="alert">No se pudo cargar el catálogo.</p>
              <button type="button" onClick={() => setRevision((value) => value + 1)} className="mt-3 min-h-11 rounded-lg border border-red-300 bg-white px-4 font-semibold">
                Reintentar
              </button>
            </div>
          ) : current.status === "loading" ? (
            <div aria-hidden="true" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, index) => <ProductCardSkeleton key={index} />)}
            </div>
          ) : current.page.results.length === 0 ? (
            <EmptyState icon="🔍" title="No encontramos productos"
              description="Probá con otra búsqueda o eliminá algunos filtros." actionLabel="Limpiar filtros" actionTo="/products" />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {current.page.results.map((product) => <ProductCard key={product.id} product={product} />)}
              </div>
              {(current.page.previous || current.page.next) && <nav aria-label="Páginas del catálogo" className="mt-5 flex flex-wrap items-center justify-between gap-2 text-sm">
                <button type="button" disabled={!current.page.previous} onClick={() => changePage((appliedFilters.page ?? 1) - 1)}
                  className="min-h-11 rounded-lg border border-agro-control bg-white px-3 font-semibold text-agro-forest disabled:border-agro-line disabled:text-agro-muted">Anterior</button>
                <span>Página {appliedFilters.page ?? 1}</span>
                <button type="button" disabled={!current.page.next} onClick={() => changePage((appliedFilters.page ?? 1) + 1)}
                  className="min-h-11 rounded-lg border border-agro-control bg-white px-3 font-semibold text-agro-forest disabled:border-agro-line disabled:text-agro-muted">Siguiente</button>
              </nav>}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
