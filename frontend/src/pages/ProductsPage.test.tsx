import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, expect, test, vi } from "vitest";
import { api } from "../lib/api";
import { deferred } from "../test/asyncFixtures";
import { ProductsPage } from "./ProductsPage";

vi.mock("../lib/api", () => ({ api: { get: vi.fn() } }));
const product = {
  id: 1, name: "Filtro primera página", slug: "filtro", sku: "F-1", seller: "Agro Prueba",
  category: "Repuestos", region: "Mendoza", price: "100.00", current_price: "80.00", discount_price: "80.00",
  stock: 3, average_rating: "0.00", total_reviews: 0, is_featured: false, main_image: null,
};
function page(name = product.name, number = 1) {
  return { count: 25, next: number === 1 ? "/products/?page=2" : null,
    previous: number === 2 ? "/products/?page=1" : null, results: [{ ...product, name }] };
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.get).mockImplementation(async (url) => ({ data: url === "/products/" ? page() : [] }));
});
function mount(path = "/products") {
  const router = createMemoryRouter([{ path: "/products", element: <ProductsPage /> }], { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

test("página siguiente usa count total y conserva los filtros de URL", async () => {
  vi.mocked(api.get).mockImplementation(async (url, config) => ({ data: url !== "/products/" ? [] :
    (config?.params as { page?: number } | undefined)?.page === 2 ? page("Filtro segunda página", 2) : page() }));
  const router = mount("/products?category=repuestos&min_price=10.50&ordering=price");
  expect(await screen.findByText("25 producto(s) encontrado(s)")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
  expect(await screen.findByRole("heading", { name: "Filtro segunda página" })).toBeInTheDocument();
  expect(router.state.location.search).toContain("category=repuestos");
  expect(router.state.location.search).toContain("min_price=10.50");
  expect(router.state.location.search).toContain("page=2");
  expect(api.get).toHaveBeenCalledWith("/products/", { params: expect.objectContaining({ page: 2, category: "repuestos", min_price: "10.50" }) });
  expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
});

test("al aplicar filtros desde página dos se vuelve a la primera", async () => {
  const router = mount("/products?page=2&search=viejo");
  await screen.findByRole("button", { name: "Aplicar filtros" });
  await userEvent.clear(screen.getByRole("textbox", { name: "Buscar" }));
  await userEvent.type(screen.getByRole("textbox", { name: "Buscar" }), "bomba");
  await userEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
  expect(router.state.location.search).toBe("?search=bomba");
  expect(api.get).toHaveBeenLastCalledWith("/products/", { params: expect.objectContaining({ search: "bomba", page: 1 }) });
});

test("una página antigua que llega después no reemplaza los resultados actuales", async () => {
  const old = deferred<{ data: ReturnType<typeof page> }>();
  vi.mocked(api.get).mockImplementation(async (url, config) => {
    if (url !== "/products/") return { data: [] };
    if ((config?.params as { page?: number } | undefined)?.page === 1) return old.promise;
    return { data: page("Filtro página actual", 2) };
  });
  const router = mount();
  await act(async () => { await router.navigate("/products?page=2"); });
  await screen.findByRole("heading", { name: "Filtro página actual" });
  await act(async () => old.resolve({ data: page("Filtro obsoleto") }));
  expect(screen.queryByRole("heading", { name: "Filtro obsoleto" })).not.toBeInTheDocument();
  expect(screen.getByText("Página 2")).toBeInTheDocument();
});

test("un fallo de catálogo muestra retry sin confundirlo con resultados vacíos ni conservar datos viejos", async () => {
  let fail = false;
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url !== "/products/") return { data: [] };
    if (fail) throw new Error("Conexión interrumpida");
    return { data: page() };
  });
  const router = mount();
  await screen.findByRole("heading", { name: product.name });
  fail = true;
  await act(async () => { await router.navigate("/products?search=bomba"); });
  expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo cargar el catálogo.");
  expect(screen.queryByText("No encontramos productos")).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: product.name })).not.toBeInTheDocument();
  fail = false;
  await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  expect(await screen.findByRole("heading", { name: product.name })).toBeInTheDocument();
});

test("los precios decimales son válidos y un rango invertido no lanza otra búsqueda", async () => {
  mount();
  await screen.findByRole("button", { name: "Aplicar filtros" });
  const minimum = screen.getByRole("spinbutton", { name: "Precio mín." });
  const maximum = screen.getByRole("spinbutton", { name: "Precio máx." });
  expect(minimum).toHaveAttribute("step", "0.01");
  await userEvent.type(minimum, "20.50");
  await userEvent.type(maximum, "10.25");
  const count = vi.mocked(api.get).mock.calls.length;
  fireEvent.submit(minimum.closest("form")!);
  expect(screen.getByRole("alert")).toHaveTextContent("El precio mínimo no puede superar al máximo.");
  expect(api.get).toHaveBeenCalledTimes(count);
});
