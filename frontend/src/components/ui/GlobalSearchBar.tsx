import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router";

export function GlobalSearchBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState("");

  useEffect(() => {
    setSearch(new URLSearchParams(location.search).get("search") || "");
  }, [location.search]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    navigate(query ? `/products?${new URLSearchParams({ search: query })}` : "/products");
  }

  return (
    <form
      role="search"
      aria-label="Buscar productos en AgroNexus"
      onSubmit={handleSubmit}
      className="flex w-full min-w-0 items-stretch gap-1 rounded-xl border border-agro-line bg-agro-paper p-0.5 focus-within:border-agro-forest"
    >
      <input
        value={search}
        aria-label="Buscar productos"
        enterKeyHint="search"
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Producto, marca o SKU"
        className="min-w-0 flex-1 rounded-lg px-2.5 text-base text-agro-ink placeholder:text-agro-muted"
      />
      <button type="submit" className="min-h-10 shrink-0 rounded-lg bg-agro-forest px-3 text-sm font-semibold text-white hover:bg-agro-deep sm:px-4">
        Buscar
      </button>
    </form>
  );
}
