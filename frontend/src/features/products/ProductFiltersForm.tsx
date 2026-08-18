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
    <aside className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-bold">Filtros</h2>

        <button
          type="button"
          onClick={onClear}
          className="text-sm font-medium text-green-700"
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
          <label className="mb-1 block text-sm font-medium">Buscar</label>
          <input
            value={filters.search || ""}
            onChange={(event) =>
              updateFilter("search", event.target.value || undefined)
            }
            placeholder="Nombre, marca o SKU"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-green-700"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Categoría</label>
          <select
            value={filters.category || ""}
            onChange={(event) =>
              updateFilter("category", event.target.value || undefined)
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-green-700"
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
          <label className="mb-1 block text-sm font-medium">Marca</label>
          <select
            value={filters.brand || ""}
            onChange={(event) =>
              updateFilter("brand", event.target.value || undefined)
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-green-700"
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
          <label className="mb-1 block text-sm font-medium">Región</label>
          <select
            value={filters.region || ""}
            onChange={(event) =>
              updateFilter(
                "region",
                event.target.value || undefined
              )
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-green-700"
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
            <label className="mb-1 block text-sm font-medium">Precio mín.</label>
            <input
              type="number"
              min="0"
              value={filters.min_price || ""}
              onChange={(event) =>
                updateFilter("min_price", event.target.value || undefined)
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-green-700"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Precio máx.</label>
            <input
              type="number"
              min="0"
              value={filters.max_price || ""}
              onChange={(event) =>
                updateFilter("max_price", event.target.value || undefined)
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-green-700"
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
          <label className="mb-1 block text-sm font-medium">Ordenar</label>
          <select
            value={filters.ordering || ""}
            onChange={(event) =>
              updateFilter("ordering", event.target.value || undefined)
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-green-700"
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
          className="w-full rounded-lg bg-green-700 px-4 py-2 font-medium text-white hover:bg-green-800 disabled:opacity-60"
        >
          {loading ? "Buscando..." : "Aplicar filtros"}
        </button>
      </form>
    </aside>
  );
}