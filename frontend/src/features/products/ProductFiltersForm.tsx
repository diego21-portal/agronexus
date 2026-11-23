import { useId } from "react";
import type {
  Brand,
  Category,
  ProductFilters,
  Region,
} from "../../types/product";

interface ProductFiltersFormProps {
  filters: ProductFilters;
  categories: Category[];
  brands: Brand[];
  regions: Region[];
  loading: boolean;
  onChange: (filters: ProductFilters) => void;
  onSubmit: () => void;
  onClear: () => void;
}

export function ProductFiltersForm({
  filters,
  categories,
  brands,
  regions,
  loading,
  onChange,
  onSubmit,
  onClear,
}: ProductFiltersFormProps) {
  const id = useId();
  function updateFilter(
    field: keyof ProductFilters,
    value: string | boolean | undefined
  ) {
    onChange({
      ...filters,
      [field]: value,
    });
  }

  return (
    <aside className="rounded-2xl border border-agro-line bg-white p-4">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-bold text-agro-forest">Filtros</h2>

        <button
          type="button"
          onClick={onClear}
          className="min-h-11 px-1 text-sm font-semibold text-agro-forest underline underline-offset-4"
        >
          Limpiar
        </button>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        className="space-y-4"
      >
        <div>
          <label htmlFor={`${id}-search`} className="mb-1 block text-sm font-medium">Buscar</label>
          <input
            id={`${id}-search`}
            value={filters.search || ""}
            onChange={(event) =>
              updateFilter("search", event.target.value || undefined)
            }
            placeholder="Nombre, marca o SKU"
            className="min-h-11 w-full min-w-0 rounded-lg border border-agro-control bg-white px-3 py-2 text-base focus:border-agro-forest"
          />
        </div>

        <div>
          <label htmlFor={`${id}-category`} className="mb-1 block text-sm font-medium">Categoría</label>
          <select
            id={`${id}-category`}
            value={filters.category || ""}
            onChange={(event) =>
              updateFilter("category", event.target.value || undefined)
            }
            className="min-h-11 w-full min-w-0 rounded-lg border border-agro-control bg-white px-3 py-2 text-base focus:border-agro-forest"
          >
            <option value="">Todas</option>

            {categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`${id}-brand`} className="mb-1 block text-sm font-medium">Marca</label>
          <select
            id={`${id}-brand`}
            value={filters.brand || ""}
            onChange={(event) =>
              updateFilter("brand", event.target.value || undefined)
            }
            className="min-h-11 w-full min-w-0 rounded-lg border border-agro-control bg-white px-3 py-2 text-base focus:border-agro-forest"
          >
            <option value="">Todas</option>

            {brands.map((brand) => (
              <option key={brand.id} value={brand.slug}>
                {brand.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`${id}-region`} className="mb-1 block text-sm font-medium">Región</label>
          <select
            id={`${id}-region`}
            value={filters.region || ""}
            onChange={(event) =>
              updateFilter(
                "region",
                event.target.value || undefined
              )
            }
            className="min-h-11 w-full min-w-0 rounded-lg border border-agro-control bg-white px-3 py-2 text-base focus:border-agro-forest"
          >
            <option value="">Todas</option>

            {regions.map((region) => (
              <option
                key={region.id}
                value={region.slug || region.id.toString()}
              >
                {region.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor={`${id}-min_price`} className="mb-1 block text-sm font-medium">Precio mín.</label>
            <input
              type="number"
              min="0"
              step="0.01"
              id={`${id}-min_price`}
              value={filters.min_price || ""}
              onChange={(event) =>
                updateFilter("min_price", event.target.value || undefined)
              }
              className="min-h-11 w-full min-w-0 rounded-lg border border-agro-control bg-white px-3 py-2 text-base focus:border-agro-forest"
            />
          </div>

          <div>
            <label htmlFor={`${id}-max_price`} className="mb-1 block text-sm font-medium">Precio máx.</label>
            <input
              type="number"
              min="0"
              step="0.01"
              id={`${id}-max_price`}
              value={filters.max_price || ""}
              onChange={(event) =>
                updateFilter("max_price", event.target.value || undefined)
              }
              className="min-h-11 w-full min-w-0 rounded-lg border border-agro-control bg-white px-3 py-2 text-base focus:border-agro-forest"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(filters.in_stock)}
            onChange={(event) =>
              updateFilter(
                "in_stock",
                event.target.checked ? true : undefined
              )
            }
          />
          Solo productos con stock
        </label>

        <div>
          <label htmlFor={`${id}-ordering`} className="mb-1 block text-sm font-medium">Ordenar</label>
          <select
            id={`${id}-ordering`}
            value={filters.ordering || ""}
            onChange={(event) =>
              updateFilter("ordering", event.target.value || undefined)
            }
            className="min-h-11 w-full min-w-0 rounded-lg border border-agro-control bg-white px-3 py-2 text-base focus:border-agro-forest"
          >
            <option value="">Más recientes</option>
            <option value="price">Menor precio</option>
            <option value="-price">Mayor precio</option>
            <option value="-average_rating">Mejor calificación</option>
            <option value="-created_at">Más nuevos</option>
          </select>
        </div>

        <button
          disabled={loading}
          className="w-full min-h-11 rounded-lg bg-agro-forest px-4 py-2 font-semibold text-white hover:bg-agro-deep disabled:opacity-60"
        >
          {loading ? "Buscando..." : "Aplicar filtros"}
        </button>
      </form>
    </aside>
  );
}