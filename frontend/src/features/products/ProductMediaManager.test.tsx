import { AxiosError, AxiosHeaders } from "axios";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { AuthContext } from "../auth/AuthContext";
import { authValue, deferred, testUser } from "../../test/asyncFixtures";
import { getSellerProduct } from "../../services/sellerService";
import {
  deleteProductImage, deleteTechnicalSheet, updateProductImage,
  uploadProductImage, uploadTechnicalSheet,
} from "../../services/productMediaService";
import type { SellerProduct } from "../../types/seller";
import type { User } from "../../types/auth";
import { ProductMediaManager } from "./ProductMediaManager";

vi.mock("../../services/sellerService", () => ({ getSellerProduct: vi.fn() }));
vi.mock("../../services/productMediaService", () => ({
  deleteProductImage: vi.fn(), deleteTechnicalSheet: vi.fn(), updateProductImage: vi.fn(),
  uploadProductImage: vi.fn(), uploadTechnicalSheet: vi.fn(),
}));

const firstImage = { id: 31, image: "http://api.example.invalid/media/products/images/first.png", alt_text: "Filtro en caja", is_main: true, order: 0 };
const secondImage = { id: 32, image: "http://api.example.invalid/media/products/images/second.png", alt_text: "Vista lateral", is_main: false, order: 1 };
function product(overrides: Partial<SellerProduct> = {}): SellerProduct {
  return {
    id: 9, seller: "Agro Prueba", category: 4, brand: null, region: 3, name: "Filtro agrícola", slug: "filtro-agricola", sku: "F-9",
    short_description: "Filtro para maquinaria", description: "Descripción del producto", technical_description: "",
    price: "100.00", discount_price: null, current_price: "100.00", unit: "unidad", stock: 5, minimum_stock: 0,
    condition: "NEW", status: "PUBLISHED", warranty: "", shipping_available: true, average_rating: "0.00", total_reviews: 0,
    is_featured: false, is_active: true, images: [], technical_sheet: null, created_at: "2026-11-21T12:00:00Z", updated_at: "2026-11-21T12:00:00Z",
    ...overrides,
  };
}
let current: SellerProduct;
beforeEach(() => {
  vi.resetAllMocks();
  current = product();
  vi.mocked(getSellerProduct).mockImplementation(async () => current);
  vi.mocked(uploadProductImage).mockImplementation(async () => {
    current = { ...current, images: [firstImage] };
    return firstImage;
  });
  vi.mocked(uploadTechnicalSheet).mockImplementation(async () => {
    current = { ...current, technical_sheet: "http://api.example.invalid/media/products/documents/ficha.pdf" };
    return current;
  });
  vi.mocked(deleteProductImage).mockResolvedValue(undefined);
  vi.mocked(deleteTechnicalSheet).mockResolvedValue(undefined);
  vi.mocked(updateProductImage).mockResolvedValue(firstImage);
});
function mount(id = 9, user: User | null = testUser) {
  const content = (productId: number, account: User | null) => (
    <AuthContext.Provider value={authValue(account)}><ProductMediaManager productId={productId} /></AuthContext.Provider>
  );
  const view = render(content(id, user));
  return { ...view, changeScope: (productId: number, account: User | null = user) => view.rerender(content(productId, account)) };
}
const imageInput = () => screen.getByLabelText("Imagen JPEG, PNG o WebP (máximo 5 MiB)");
const pdfInput = () => screen.getByLabelText("Ficha PDF (máximo 10 MiB)");
const imageFile = () => new File(["png bytes"], "filtro.png", { type: "image/png" });

async function ready() {
  await screen.findByText("El producto todavía no tiene imágenes.");
}

test("subir imagen conserva texto alternativo, refresca la lista real y limpia el archivo elegido", async () => {
  mount();
  await ready();
  const file = imageFile();
  await userEvent.upload(imageInput(), file);
  await userEvent.type(screen.getByLabelText("Descripción de la nueva imagen"), "  Filtro en caja  ");
  await userEvent.click(screen.getByRole("button", { name: "Subir imagen" }));
  expect(await screen.findByText("Imagen guardada.")).toBeVisible();
  expect(uploadProductImage).toHaveBeenCalledWith(9, file, "  Filtro en caja  ");
  expect(screen.getByRole("img", { name: "Filtro en caja" })).toHaveAttribute("src", firstImage.image);
  expect(screen.getByText("Imagen principal")).toBeVisible();
  expect(imageInput()).toHaveValue("");
  expect(screen.getByLabelText("Descripción de la nueva imagen")).toHaveValue("");
  expect(screen.getByRole("button", { name: "Subir imagen" })).toBeDisabled();
});

test("dos submits durante una subida producen una sola petición", async () => {
  const pending = deferred<typeof firstImage>();
  vi.mocked(uploadProductImage).mockReturnValue(pending.promise);
  mount();
  await ready();
  await userEvent.upload(imageInput(), imageFile());
  const button = screen.getByRole("button", { name: "Subir imagen" });
  fireEvent.submit(button.closest("form")!);
  fireEvent.submit(button.closest("form")!);
  expect(uploadProductImage).toHaveBeenCalledTimes(1);
  expect(button).toBeDisabled();
  await act(async () => pending.resolve(firstImage));
});

test("un rechazo de validación del servidor permite corregir el archivo sin inventar un éxito", async () => {
  vi.mocked(uploadProductImage).mockRejectedValueOnce(new AxiosError("Bad request", "ERR_BAD_REQUEST", undefined, undefined, {
    status: 400, statusText: "Bad Request", headers: {}, config: { headers: new AxiosHeaders() }, data: { image: ["El archivo no contiene una imagen válida."] },
  }));
  mount();
  await ready();
  await userEvent.upload(imageInput(), imageFile());
  await userEvent.click(screen.getByRole("button", { name: "Subir imagen" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("El archivo no contiene una imagen válida.");
  expect(screen.queryByText("Imagen guardada.")).not.toBeInTheDocument();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Subir imagen" })).toBeEnabled();
  expect(getSellerProduct).toHaveBeenCalledTimes(1);
});

test("una respuesta perdida exige revisar los archivos antes de reintentar y muestra la imagen ya guardada", async () => {
  vi.mocked(uploadProductImage).mockImplementationOnce(async () => {
    current = { ...current, images: [firstImage] };
    throw new AxiosError("Network failed", "ERR_NETWORK");
  });
  mount();
  await ready();
  await userEvent.upload(imageInput(), imageFile());
  await userEvent.click(screen.getByRole("button", { name: "Subir imagen" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos confirmar el resultado");
  expect(screen.getByRole("button", { name: "Subir imagen" })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Actualizar archivos" }));
  expect(await screen.findByRole("img", { name: "Filtro en caja" })).toBeVisible();
  expect(uploadProductImage).toHaveBeenCalledTimes(1);
  expect(imageInput()).toHaveValue("");
  expect(screen.getByRole("button", { name: "Subir imagen" })).toBeDisabled();
});

test.each([502, 504, 408])("una respuesta HTTP %s posterior al guardado exige revisar antes de otra subida", async (status) => {
  vi.mocked(uploadProductImage).mockImplementationOnce(async () => {
    current = { ...current, images: [firstImage] };
    throw new AxiosError("Proxy or timeout error", "ERR_BAD_RESPONSE", undefined, undefined, {
      status, statusText: "Upstream Error", headers: {}, config: { headers: new AxiosHeaders() }, data: "Gateway or timeout error",
    });
  });
  mount();
  await ready();
  await userEvent.upload(imageInput(), imageFile());
  const upload = screen.getByRole("button", { name: "Subir imagen" });
  await userEvent.click(upload);
  expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos confirmar el resultado");
  expect(upload).toBeDisabled();
  expect(screen.getByRole("button", { name: "Subir ficha PDF" })).toBeDisabled();
  expect(uploadProductImage).toHaveBeenCalledTimes(1);
  expect(getSellerProduct).toHaveBeenCalledTimes(1);

  await userEvent.click(screen.getByRole("button", { name: "Actualizar archivos" }));
  expect(await screen.findByRole("img", { name: "Filtro en caja" })).toBeVisible();
  expect(imageInput()).toHaveValue("");
  expect(upload).toBeDisabled();
  expect(uploadProductImage).toHaveBeenCalledTimes(1);
});

test("un 404 confirmado muestra el rechazo sin repetir la operación ni exigir revisión por un éxito incierto", async () => {
  vi.mocked(uploadProductImage).mockRejectedValueOnce(new AxiosError("Not found", "ERR_BAD_REQUEST", undefined, undefined, {
    status: 404, statusText: "Not Found", headers: {}, config: { headers: new AxiosHeaders() }, data: { detail: "El producto no existe." },
  }));
  mount();
  await ready();
  await userEvent.upload(imageInput(), imageFile());
  await userEvent.click(screen.getByRole("button", { name: "Subir imagen" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("El producto no existe.");
  expect(screen.getByRole("alert")).not.toHaveTextContent("No pudimos confirmar el resultado");
  expect(screen.getByRole("button", { name: "Subir imagen" })).toBeEnabled();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(uploadProductImage).toHaveBeenCalledTimes(1);
  expect(getSellerProduct).toHaveBeenCalledTimes(1);
});

test("si el GET posterior falla informa que la escritura se guardó y no repite la subida", async () => {
  vi.mocked(getSellerProduct).mockResolvedValueOnce(product()).mockRejectedValueOnce(new Error("GET failed")).mockImplementation(async () => current);
  mount();
  await ready();
  await userEvent.upload(imageInput(), imageFile());
  await userEvent.click(screen.getByRole("button", { name: "Subir imagen" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("La operación se guardó");
  expect(screen.getByRole("button", { name: "Subir imagen" })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Actualizar archivos" }));
  expect(await screen.findByRole("img", { name: "Filtro en caja" })).toBeVisible();
  expect(uploadProductImage).toHaveBeenCalledTimes(1);
});

test("un error de carga inicial tiene reintento independiente de las operaciones de archivo", async () => {
  vi.mocked(getSellerProduct).mockRejectedValueOnce(new Error("GET failed"));
  mount();
  expect(await screen.findByRole("alert")).toHaveTextContent("No se pudieron cargar los archivos");
  expect(screen.queryByRole("button", { name: "Subir imagen" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Actualizar archivos" }));
  await ready();
  expect(uploadProductImage).not.toHaveBeenCalled();
});

test.each([
  { file: () => new File(["svg"], "imagen.svg", { type: "image/svg+xml" }), message: "La imagen debe ser JPEG, PNG o WebP." },
  { file: () => new File(["png bytes"], "imagen.txt", { type: "image/png" }), message: "La imagen debe ser JPEG, PNG o WebP." },
  { file: () => new File([new Uint8Array(5 * 1024 * 1024 + 1)], "grande.png", { type: "image/png" }), message: "La imagen no puede superar 5 MiB." },
])("un archivo de imagen inválido se rechaza antes de enviarlo ($message)", async ({ file, message }) => {
  const user = userEvent.setup({ applyAccept: false });
  mount();
  await ready();
  await user.upload(imageInput(), file());
  await user.click(screen.getByRole("button", { name: "Subir imagen" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(message);
  expect(uploadProductImage).not.toHaveBeenCalled();
});

test("una imagen con extensión admitida y sin MIME del navegador se envía para validación del servidor", async () => {
  mount();
  await ready();
  const file = new File(["png bytes"], "foto.png");
  const user = userEvent.setup({ applyAccept: false });
  await user.upload(imageInput(), file);
  await user.click(screen.getByRole("button", { name: "Subir imagen" }));
  expect(await screen.findByText("Imagen guardada.")).toBeVisible();
  expect(uploadProductImage).toHaveBeenCalledWith(9, file, "");
});

test("gestiona imagen principal, texto alternativo, orden y borrado con el id del producto", async () => {
  current = product({ images: [firstImage, secondImage] });
  vi.mocked(updateProductImage).mockImplementation(async (_productId, imageId, values) => {
    current = { ...current, images: current.images.map((entry) => ({ ...entry,
      ...(values.is_main ? { is_main: entry.id === imageId } : {}), ...(entry.id === imageId ? values : {}),
    })) };
    return current.images.find((entry) => entry.id === imageId)!;
  });
  vi.mocked(deleteProductImage).mockImplementation(async (_productId, imageId) => {
    current = { ...current, images: current.images.filter((entry) => entry.id !== imageId) };
  });
  mount();
  const side = await screen.findByRole("article", { name: "Imagen 2" });
  await userEvent.click(within(side).getByRole("button", { name: "Hacer principal imagen 2" }));
  await waitFor(() => expect(within(screen.getByRole("article", { name: "Imagen 2" })).getByText("Imagen principal")).toBeVisible());
  expect(updateProductImage).toHaveBeenCalledWith(9, 32, { is_main: true });
  await userEvent.clear(screen.getByLabelText("Descripción de imagen 2"));
  await userEvent.type(screen.getByLabelText("Descripción de imagen 2"), "  Nueva vista  ");
  fireEvent.change(screen.getByLabelText("Orden de imagen 2"), { target: { value: "2" } });
  await userEvent.click(screen.getByRole("button", { name: "Guardar imagen 2" }));
  await waitFor(() => expect(updateProductImage).toHaveBeenCalledWith(9, 32, { alt_text: "Nueva vista", order: 2 }));
  await userEvent.click(screen.getByRole("button", { name: "Eliminar imagen 2" }));
  await waitFor(() => expect(screen.queryByRole("article", { name: "Imagen 2" })).not.toBeInTheDocument());
  expect(deleteProductImage).toHaveBeenCalledWith(9, 32);
});

test("sube y elimina la ficha PDF pública, conservando el enlace del servidor", async () => {
  vi.mocked(deleteTechnicalSheet).mockImplementation(async () => { current = { ...current, technical_sheet: null }; });
  mount();
  await ready();
  const pdf = new File(["%PDF-1.4\n..."], "ficha.pdf", { type: "application/pdf" });
  await userEvent.upload(pdfInput(), pdf);
  await userEvent.click(screen.getByRole("button", { name: "Subir ficha PDF" }));
  expect(await screen.findByRole("link", { name: "Descargar ficha PDF actual" })).toHaveAttribute("href", current.technical_sheet);
  expect(uploadTechnicalSheet).toHaveBeenCalledWith(9, pdf);
  expect(pdfInput()).toHaveValue("");
  await userEvent.click(screen.getByRole("button", { name: "Eliminar ficha PDF" }));
  expect(await screen.findByText("No hay una ficha PDF adjunta.")).toBeVisible();
  expect(deleteTechnicalSheet).toHaveBeenCalledWith(9);
});

test.each([
  { file: () => new File(["plain"], "texto.txt", { type: "text/plain" }), message: "La ficha técnica debe ser un archivo PDF." },
  { file: () => new File([new Uint8Array(10 * 1024 * 1024 + 1)], "grande.pdf", { type: "application/pdf" }), message: "La ficha PDF no puede superar 10 MiB." },
])("un adjunto PDF inválido no se envía ($message)", async ({ file, message }) => {
  const user = userEvent.setup({ applyAccept: false });
  mount();
  await ready();
  await user.upload(pdfInput(), file());
  await user.click(screen.getByRole("button", { name: "Subir ficha PDF" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(message);
  expect(uploadTechnicalSheet).not.toHaveBeenCalled();
});

test("cambiar de producto descarta una carga anterior tardía y no muestra archivos de otro producto", async () => {
  const old = deferred<SellerProduct>();
  vi.mocked(getSellerProduct).mockReturnValueOnce(old.promise).mockResolvedValueOnce(product({ id: 10, images: [secondImage] }));
  const view = mount();
  view.changeScope(10);
  expect(await screen.findByRole("img", { name: "Vista lateral" })).toBeVisible();
  await act(async () => old.resolve(product({ images: [firstImage] })));
  expect(screen.queryByRole("img", { name: "Filtro en caja" })).not.toBeInTheDocument();
});

test("una operación de la cuenta anterior no modifica la pantalla ni refresca archivos de la nueva cuenta", async () => {
  const pending = deferred<typeof firstImage>();
  vi.mocked(uploadProductImage).mockReturnValueOnce(pending.promise);
  const view = mount();
  await ready();
  await userEvent.upload(imageInput(), imageFile());
  await userEvent.click(screen.getByRole("button", { name: "Subir imagen" }));
  view.changeScope(10, { ...testUser, id: 2 });
  await ready();
  expect(imageInput()).toHaveValue("");
  const loads = vi.mocked(getSellerProduct).mock.calls.length;
  await act(async () => pending.resolve(firstImage));
  expect(getSellerProduct).toHaveBeenCalledTimes(loads);
  expect(screen.queryByText("Imagen guardada.")).not.toBeInTheDocument();
  expect(screen.queryByRole("img", { name: "Filtro en caja" })).not.toBeInTheDocument();
  view.changeScope(10, null);
  expect(screen.queryByRole("region", { name: "Archivos del producto" })).not.toBeInTheDocument();
});
