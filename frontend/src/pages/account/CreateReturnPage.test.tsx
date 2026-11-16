import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, expect, test, vi } from "vitest";
import { api } from "../../lib/api";
import { getOrderById } from "../../services/orderService";
import { deferred } from "../../test/asyncFixtures";
import type { Order } from "../../types/order";
import { CreateReturnPage } from "./CreateReturnPage";

vi.mock("../../lib/api", () => ({ api: { post: vi.fn() } }));
vi.mock("../../services/orderService", () => ({ getOrderById: vi.fn() }));
beforeEach(() => vi.resetAllMocks());

const order: Order = {
  id: 1, order_number: "AGX-RETORNO", status: "DELIVERED", subtotal: "100.00", discount_total: "0.00",
  shipping_cost: "0.00", total: "100.00", shipments: [], created_at: "2026-11-15T10:00:00Z",
  items: [{ id: 11, product_name: "Filtro recibido", sku: "FILTRO-1", quantity: 2, unit_price: "50.00", total_price: "100.00", is_delivered: true, delivery_status: "DELIVERED", can_request_return: true }],
};

function mount() {
  const router = createMemoryRouter([
    { path: "/account/orders/:orderId/items/:itemId/return", element: <CreateReturnPage /> },
    { path: "/account/returns", element: <h2>Solicitudes registradas</h2> },
  ], { initialEntries: ["/account/orders/1/items/11/return"] });
  render(<RouterProvider router={router} />);
  return router;
}

async function explain() {
  await screen.findByText("Filtro recibido");
  await userEvent.type(screen.getByLabelText("Descripción del problema"), "El filtro presenta una falla durante su uso.");
}

test("selecciona la compra y envía DAMAGED_SHIPPING sin pedir un identificador técnico", async () => {
  vi.mocked(getOrderById).mockResolvedValue(order);
  vi.mocked(api.post).mockResolvedValue({ data: {} });
  mount();
  await explain();
  expect(screen.getByLabelText("Unidades a devolver")).toHaveAttribute("max", "2");
  await userEvent.selectOptions(screen.getByLabelText("Motivo"), "DAMAGED_SHIPPING");
  fireEvent.change(screen.getByLabelText("Unidades a devolver"), { target: { value: "2" } });
  await userEvent.click(screen.getByRole("button", { name: "Solicitar devolución" }));
  expect(api.post).toHaveBeenCalledWith("/order-items/11/returns/", {
    reason: "DAMAGED_SHIPPING", description: "El filtro presenta una falla durante su uso.", quantity: 2,
  });
  expect(await screen.findByRole("heading", { name: "Solicitudes registradas" })).toBeVisible();
});

test("no permite devolver más unidades que las compradas al omitir la validación nativa", async () => {
  vi.mocked(getOrderById).mockResolvedValue(order);
  mount();
  await explain();
  fireEvent.change(screen.getByLabelText("Unidades a devolver"), { target: { value: "3" } });
  fireEvent.submit(screen.getByRole("form", { name: "Solicitar devolución de compra" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("unidades compradas");
  expect(api.post).not.toHaveBeenCalled();
});

test("bloquea el formulario y no duplica la solicitud mientras el backend responde", async () => {
  const pending = deferred<{ data: object }>();
  vi.mocked(getOrderById).mockResolvedValue(order);
  vi.mocked(api.post).mockReturnValueOnce(pending.promise);
  mount();
  await explain();
  await userEvent.dblClick(screen.getByRole("button", { name: "Solicitar devolución" }));
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText("Motivo")).toBeDisabled();
  expect(screen.getByLabelText("Unidades a devolver")).toBeDisabled();
  pending.resolve({ data: {} });
  await screen.findByRole("heading", { name: "Solicitudes registradas" });
});

test("una respuesta tardía no navega fuera de otro producto abierto después", async () => {
  const pending = deferred<{ data: object }>();
  const nextOrder: Order = { ...order, id: 2, items: [{ ...order.items![0], id: 22, product_name: "Bomba recibida" }] };
  vi.mocked(getOrderById).mockResolvedValueOnce(order).mockResolvedValueOnce(nextOrder);
  vi.mocked(api.post).mockReturnValueOnce(pending.promise);
  const router = mount();
  await explain();
  await userEvent.click(screen.getByRole("button", { name: "Solicitar devolución" }));
  await act(async () => { await router.navigate("/account/orders/2/items/22/return"); });
  await screen.findByText("Bomba recibida");
  await act(async () => { pending.resolve({ data: {} }); });
  expect(screen.queryByRole("heading", { name: "Solicitudes registradas" })).not.toBeInTheDocument();
  expect(screen.getByLabelText("Descripción del problema")).toHaveValue("");
  expect(screen.getByLabelText("Motivo")).toBeEnabled();
});

test("respeta que el backend no autorice otra solicitud sobre ese producto", async () => {
  vi.mocked(getOrderById).mockResolvedValue({ ...order, items: [{ ...order.items![0], can_request_return: false }] });
  mount();
  expect(await screen.findByText(/no está habilitado para una nueva solicitud/)).toBeVisible();
  expect(screen.queryByRole("form")).not.toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
});

test("una selección que no pertenece al pedido no presenta un formulario", async () => {
  vi.mocked(getOrderById).mockResolvedValue({ ...order, items: [] });
  mount();
  expect(await screen.findByRole("alert")).toHaveTextContent("producto de tu compra");
  expect(screen.queryByRole("form")).not.toBeInTheDocument();
});
