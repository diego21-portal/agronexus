import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router";
import { SellerOrderDetailPage } from "./SellerOrderDetailPage";
import { getSellerOrder, updateShipmentStatus } from "../../services/sellerService";
import { deferred } from "../../test/asyncFixtures";
import type { Order } from "../../types/order";

vi.mock("../../services/sellerService", () => ({ getSellerOrder: vi.fn(), updateShipmentStatus: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
const order: Order = {
  id: 1, order_number: "ORD-001", status: "PAID", subtotal: "100.00",
  discount_total: "0.00", shipping_cost: "0.00", total: "100.00",
  created_at: "2026-11-01T12:00:00Z", items: [], shipment: { id: 8, status: "PREPARING" },
};
function mount() {
  const router = createMemoryRouter([{ path: "/seller/orders/:orderId", element: <SellerOrderDetailPage /> }], { initialEntries: ["/seller/orders/1"] });
  render(<RouterProvider router={router} />);
  return router;
}

test("si falla la carga muestra un error y permite reintentar", async () => {
  vi.mocked(getSellerOrder).mockRejectedValueOnce(new Error("Sin conexión")).mockResolvedValueOnce(order);
  mount();
  expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo cargar el pedido.");
  expect(screen.queryByText("Cargando pedido...")).not.toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole("button", { name: "Reintentar" }));
  expect(await screen.findByRole("heading", { name: "ORD-001" })).toBeInTheDocument();
});

test("una respuesta tardía no reemplaza el pedido abierto después", async () => {
  const old = deferred<Order>();
  vi.mocked(getSellerOrder).mockReturnValueOnce(old.promise).mockResolvedValueOnce({ ...order, id: 2, order_number: "ORD-002" });
  const router = mount();
  await act(async () => { await router.navigate("/seller/orders/2"); });
  await screen.findByRole("heading", { name: "ORD-002" });
  await act(async () => { old.resolve(order); });
  expect(screen.queryByRole("heading", { name: "ORD-001" })).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "ORD-002" })).toBeInTheDocument();
});

test("bloquea el envío mientras guarda y diferencia un fallo posterior al recargar", async () => {
  const pending = deferred<Awaited<ReturnType<typeof updateShipmentStatus>>>();
  vi.mocked(getSellerOrder).mockResolvedValueOnce(order).mockRejectedValueOnce(new Error("Fallo al recargar"));
  vi.mocked(updateShipmentStatus).mockReturnValue(pending.promise);
  mount();
  await screen.findByRole("heading", { name: "ORD-001" });
  await userEvent.setup().click(screen.getByRole("button", { name: "Actualizar seguimiento" }));
  expect(screen.getByRole("button", { name: "Actualizando..." })).toBeDisabled();
  await act(async () => { pending.resolve(undefined); });
  expect(screen.getByText("Estado del envío actualizado.")).toBeInTheDocument();
  expect(screen.getByText("No se pudo cargar el pedido.")).toBeInTheDocument();
  expect(screen.queryByText("No se pudo actualizar el envío.")).not.toBeInTheDocument();
});
