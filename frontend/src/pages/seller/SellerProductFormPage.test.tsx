import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, expect, test, vi } from "vitest";
import { api } from "../../lib/api";
import { AuthContext } from "../../features/auth/AuthContext";
import { authValue, deferred } from "../../test/asyncFixtures";
import { SellerProductFormPage } from "./SellerProductFormPage";

vi.mock("../../lib/api", () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));

// JSON shape from SellerProductSerializer: foreign keys are numbers, seller is a name.
const product = {
  id: 9, seller: "Agro Prueba", category: 4, category_name: "Repuestos", brand: 7,
  brand_name: "Marca Prueba", region: 3, region_name: "Mendoza", name: "Filtro agrícola",
  slug: "filtro-agricola", sku: "FILTRO-9", short_description: "Filtro para maquinaria agrícola",
  description: "Filtro de repuesto para maquinaria agrícola de prueba.", technical_description: "",
  price: "120.50", discount_price: "100.00", current_price: "100.00", unit: "unidad",
  stock: 8, minimum_stock: 2, condition: "NEW", status: "PUBLISHED", warranty: "",
  shipping_available: true, average_rating: "0.00", total_reviews: 0,
  images: [], technical_sheet: null,
  is_featured: false, is_active: true, created_at: "2026-11-01T12:00:00Z", updated_at: "2026-11-01T12:00:00Z",
};
function response(url: string) {
  if (url === "/categories/") return { data: [{ id: 4, name: "Repuestos", slug: "repuestos" }] };
  if (url === "/brands/") return { data: [{ id: 7, name: "Marca Prueba", slug: "marca" }] };
  if (url === "/regions/") return { data: [{ id: 3, name: "Mendoza", slug: "mendoza" }] };
  return { data: product };
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.get).mockImplementation(async (url) => response(url));
  vi.mocked(api.patch).mockResolvedValue({ data: product });
  vi.mocked(api.post).mockResolvedValue({ data: product });
});
function mount(path = "/seller/products/9/edit") {
  const router = createMemoryRouter([
    { path: "/seller/products/new", element: <SellerProductFormPage /> },
    { path: "/seller/products/:productId/edit", element: <SellerProductFormPage /> },
    { path: "/seller/products", element: <p>Productos guardados</p> },
  ], { initialEntries: [path] });
  render(<AuthContext.Provider value={authValue()}><RouterProvider router={router} /></AuthContext.Provider>);
  return router;
}

test("editar conserva las relaciones numéricas del JSON real y envía los valores validados", async () => {
  mount();
  expect(await screen.findByRole("combobox", { name: "Categoría" })).toHaveValue("4");
  expect(screen.getByRole("combobox", { name: "Marca" })).toHaveValue("7");
  expect(screen.getByRole("combobox", { name: "Región" })).toHaveValue("3");
  await userEvent.clear(screen.getByRole("textbox", { name: "Nombre" }));
  await userEvent.type(screen.getByRole("textbox", { name: "Nombre" }), "  Filtro actualizado  ");
  await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  expect(await screen.findByText("Productos guardados")).toBeInTheDocument();
  expect(api.patch).toHaveBeenCalledWith("/seller/products/9/", expect.objectContaining({
    category: 4, brand: 7, region: 3, name: "Filtro actualizado", price: "120.50", discount_price: "100.00",
  }));
});

test("crear con datos inválidos cancela el submit nativo y no realiza la petición", async () => {
  mount("/seller/products/new");
  const submit = await screen.findByRole("button", { name: "Crear producto" });
  expect(fireEvent.submit(submit.closest("form")!)).toBe(false);
  expect(await screen.findByRole("alert")).toHaveTextContent("El nombre es demasiado corto.");
  expect(api.post).not.toHaveBeenCalled();
});

test("crear usa las opciones de catálogo y deja la marca opcional sin asignar", async () => {
  const router = mount("/seller/products/new");
  fireEvent.change(await screen.findByRole("textbox", { name: "Nombre" }), { target: { value: "Filtro nuevo" } });
  fireEvent.change(screen.getByRole("textbox", { name: "SKU" }), { target: { value: "NUEVO-1" } });
  fireEvent.change(screen.getByRole("textbox", { name: "Descripción corta" }), { target: { value: "Filtro para maquinaria agrícola" } });
  fireEvent.change(screen.getByRole("textbox", { name: "Descripción completa" }), { target: { value: "Filtro nuevo de repuesto para maquinaria agrícola." } });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Precio" }), { target: { value: "120.50" } });
  await userEvent.click(screen.getByRole("button", { name: "Crear producto" }));
  expect(await screen.findByText("Producto creado. Ahora puedes añadir imágenes y ficha PDF.")).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/seller/products/9/edit");
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.post).toHaveBeenCalledWith("/seller/products/", expect.objectContaining({
    category: 4, region: 3, brand: null, name: "Filtro nuevo", price: "120.50", status: "DRAFT",
  }));
});

test("el descuento inválido se muestra sin enviar ni recargar la página", async () => {
  mount();
  const discount = await screen.findByRole("spinbutton", { name: "Precio con descuento" });
  await userEvent.clear(discount);
  await userEvent.type(discount, "150");
  expect(fireEvent.submit(discount.closest("form")!)).toBe(false);
  expect(await screen.findByRole("alert")).toHaveTextContent("El precio con descuento debe ser menor");
  expect(api.patch).not.toHaveBeenCalled();
});

test("una marca opcional vacía se conserva como null y evita duplicados al guardar", async () => {
  const pending = deferred<{ data: typeof product }>();
  vi.mocked(api.patch).mockReturnValue(pending.promise);
  mount();
  await userEvent.selectOptions(await screen.findByRole("combobox", { name: "Marca" }), "");
  const button = screen.getByRole("button", { name: "Guardar cambios" });
  fireEvent.submit(button.closest("form")!);
  fireEvent.submit(button.closest("form")!);
  expect(api.patch).toHaveBeenCalledTimes(1);
  expect(api.patch).toHaveBeenCalledWith("/seller/products/9/", expect.objectContaining({ brand: null }));
  await act(async () => pending.resolve({ data: product }));
});

test("cambiar de producto descarta una respuesta tardía del formulario anterior", async () => {
  const old = deferred<{ data: typeof product }>();
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === "/seller/products/9/") return old.promise;
    if (url === "/seller/products/10/") return { data: { ...product, id: 10, name: "Bomba actual" } };
    return response(url);
  });
  const router = mount();
  await waitFor(() => expect(api.get).toHaveBeenCalledWith("/seller/products/9/"));
  await act(async () => { await router.navigate("/seller/products/10/edit"); });
  expect(await screen.findByRole("textbox", { name: "Nombre" })).toHaveValue("Bomba actual");
  await act(async () => old.resolve({ data: product }));
  expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveValue("Bomba actual");
});


test.each(["PAUSED", "OUT_OF_STOCK", "ARCHIVED"])("editar un producto %s conserva su estado operativo", async (status) => {
  vi.mocked(api.get).mockImplementation(async (url) => url === "/seller/products/9/"
    ? { data: { ...product, status } } : response(url));
  mount();
  expect(await screen.findByRole("combobox", { name: "Estado" })).toHaveValue(status);
  await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  expect(await screen.findByText("Productos guardados")).toBeInTheDocument();
  expect(api.patch).toHaveBeenCalledWith("/seller/products/9/", expect.objectContaining({ status }));
});

test("un fallo al cargar y subir archivos después de crear conserva el editor sin repetir la creación", async () => {
  let productLoads = 0;
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === "/seller/products/9/" && ++productLoads === 2) throw new Error("No se pudo cargar media");
    return response(url);
  });
  vi.mocked(api.post).mockImplementation(async (url) => {
    if (url === "/seller/products/9/images/") throw new Error("Respuesta de upload perdida");
    return { data: product };
  });
  const router = mount("/seller/products/new");
  fireEvent.change(await screen.findByRole("textbox", { name: "Nombre" }), { target: { value: "Producto creado una vez" } });
  fireEvent.change(screen.getByRole("textbox", { name: "SKU" }), { target: { value: "CREADO-1" } });
  fireEvent.change(screen.getByRole("textbox", { name: "Descripción corta" }), { target: { value: "Filtro para maquinaria agrícola" } });
  fireEvent.change(screen.getByRole("textbox", { name: "Descripción completa" }), { target: { value: "Filtro de repuesto para maquinaria agrícola." } });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Precio" }), { target: { value: "100.00" } });
  await userEvent.click(screen.getByRole("button", { name: "Crear producto" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("No se pudieron cargar los archivos");
  expect(router.state.location.pathname).toBe("/seller/products/9/edit");
  await userEvent.click(screen.getByRole("button", { name: "Actualizar archivos" }));
  const image = await screen.findByLabelText("Imagen JPEG, PNG o WebP (máximo 5 MiB)");
  await userEvent.upload(image, new File(["png bytes"], "filtro.png", { type: "image/png" }));
  await userEvent.click(screen.getByRole("button", { name: "Subir imagen" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos confirmar el resultado");
  await userEvent.click(screen.getByRole("button", { name: "Actualizar archivos" }));
  await screen.findByText("El producto todavía no tiene imágenes.");
  expect(vi.mocked(api.post).mock.calls.filter(([url]) => url === "/seller/products/")).toHaveLength(1);
  expect(vi.mocked(api.post).mock.calls.filter(([url]) => url === "/seller/products/9/images/")).toHaveLength(1);
});
