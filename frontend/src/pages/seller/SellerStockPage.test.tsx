import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders } from "axios";
import { api } from "../../lib/api";
import { SellerStockPage } from "./SellerStockPage";

vi.mock("../../lib/api", () => ({ api: { get: vi.fn(), post: vi.fn() } }));

const product = {
  id: 9, name: "Filtro de prueba", sku: "STOCK-9", stock: 10, minimum_stock: 2,
};

beforeEach(() => {
  vi.mocked(api.get).mockResolvedValue({ data: [product] });
  vi.mocked(api.post).mockResolvedValue({ data: {} });
});

afterEach(() => vi.resetAllMocks());

async function openAdjustment() {
  render(<SellerStockPage />);
  await userEvent.click(await screen.findByRole("button", { name: "Ajustar" }));
}

async function enterQuantity(value: string) {
  const input = screen.getByRole("spinbutton", { name: "Cantidad" });
  await userEvent.clear(input);
  await userEvent.type(input, value);
}

test("reposicion conecta el formulario con el endpoint real y muestra el stock recargado", async () => {
  vi.mocked(api.get)
    .mockResolvedValueOnce({ data: [product] })
    .mockResolvedValueOnce({ data: [{ ...product, stock: 15 }] });

  await openAdjustment();
  await enterQuantity("5");
  await userEvent.type(screen.getByRole("textbox", { name: "Motivo" }), "Reposición de prueba");
  await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));

  await waitFor(() => expect(api.post).toHaveBeenCalledExactlyOnceWith(
    "/seller/stock/movements/",
    { product: 9, movement_type: "RESTOCK", quantity: 5, reason: "Reposición de prueba" },
  ));
  expect(await screen.findByText("15")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Confirmar" })).not.toBeInTheDocument();
});

test("ajuste manual conserva el signo negativo para descontar unidades", async () => {
  await openAdjustment();
  await userEvent.selectOptions(screen.getByRole("combobox"), "MANUAL_ADJUSTMENT");
  await enterQuantity("-2");
  await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
  await waitFor(() => expect(api.post).toHaveBeenCalledExactlyOnceWith(
    "/seller/stock/movements/",
    { product: 9, movement_type: "MANUAL_ADJUSTMENT", quantity: -2, reason: "" },
  ));
});

test.each(["0", "1.5", "-3"])("no envia reposiciones invalidas con cantidad %s", async (amount) => {
  await openAdjustment();
  await enterQuantity(amount);
  // Ejercita tambien la validacion JS sin depender de la validacion nativa del navegador.
  fireEvent.submit(screen.getByRole("button", { name: "Confirmar" }).closest("form")!);
  expect(await screen.findByRole("alert")).toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
});

test("mantiene el formulario y el stock cuando Django rechaza un descuento excesivo", async () => {
  const config = { headers: new AxiosHeaders() };
  vi.mocked(api.post).mockRejectedValueOnce(new AxiosError("Bad Request", "ERR_BAD_REQUEST", config, undefined, {
    data: { quantity: ["El movimiento no puede dejar el stock en negativo."] },
    status: 400, statusText: "Bad Request", headers: {}, config,
  }));

  await openAdjustment();
  await userEvent.selectOptions(screen.getByRole("combobox"), "MANUAL_ADJUSTMENT");
  await enterQuantity("-11");
  await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("El movimiento no puede dejar el stock en negativo.");
  expect(screen.getByRole("button", { name: "Confirmar" })).toBeEnabled();
  expect(screen.getByText("10")).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledTimes(1);
});

test("deshabilita el formulario y los ajustes mientras la peticion esta pendiente", async () => {
  let resolvePost!: (value: { data: object }) => void;
  vi.mocked(api.post).mockReturnValueOnce(new Promise((resolve) => { resolvePost = resolve; }));

  await openAdjustment();
  await userEvent.dblClick(screen.getByRole("button", { name: "Confirmar" }));
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Guardando..." })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Ajustar" })).toBeDisabled();
  expect(screen.getByRole("spinbutton")).toBeDisabled();

  resolvePost({ data: {} });
  expect(await screen.findByText("Stock actualizado correctamente.")).toBeInTheDocument();
});

test("si falla la recarga distingue el movimiento guardado de un error al guardar", async () => {
  vi.mocked(api.get)
    .mockResolvedValueOnce({ data: [product] })
    .mockRejectedValueOnce(new Error("No se pudo recargar"));

  await openAdjustment();
  await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("El movimiento se guardó");
  expect(screen.getByText("Stock actualizado correctamente.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Confirmar" })).not.toBeInTheDocument();
  expect(api.post).toHaveBeenCalledTimes(1);
});

test("informa errores al cargar los productos", async () => {
  vi.mocked(api.get).mockRejectedValueOnce(new Error("Fallo de conexión"));
  render(<SellerStockPage />);
  expect(await screen.findByRole("alert")).toHaveTextContent("No se pudieron cargar los productos.");
});