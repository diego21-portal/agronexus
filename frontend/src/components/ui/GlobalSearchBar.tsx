import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import {
  useLocation,
  useNavigate,
} from "react-router";

interface GlobalSearchBarProps {
  large?: boolean;
}

export function GlobalSearchBar({
  large = false,
}: GlobalSearchBarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const [search, setSearch] =
    useState("");

  useEffect(() => {
    const params =
      new URLSearchParams(
        location.search
      );

    setSearch(
      params.get("search") || ""
    );
  }, [location.search]);

  function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const query =
      search.trim();

    if (!query) {
      navigate("/products");
      return;
    }

    const params =
      new URLSearchParams();

    params.set(
      "search",
      query
    );

    navigate(
      `/products?${params.toString()}`
    );
  }

  return (
    <form
      role="search"
      aria-label="Buscar productos en AgroNexus"
      onSubmit={handleSubmit}
      className={
        large
          ? "flex w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg"
          : "flex w-full overflow-hidden rounded-xl border border-gray-300 bg-white"
      }
    >
      <input
        value={search}
        aria-label="Buscar productos"
        onChange={(event) =>
          setSearch(
            event.target.value
          )
        }
        placeholder="Buscar maquinaria, repuestos, insumos o SKU..."
        className={
          large
            ? "min-w-0 flex-1 px-5 py-4 text-base outline-none"
            : "min-w-0 flex-1 px-4 py-2.5 text-sm outline-none"
        }
      />

      <button
        type="submit"
        className={
          large
            ? "bg-green-700 px-6 font-semibold text-white transition hover:bg-green-800"
            : "bg-green-700 px-5 text-sm font-semibold text-white transition hover:bg-green-800"
        }
      >
        Buscar
      </button>
    </form>
  );
}