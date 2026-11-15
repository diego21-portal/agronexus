import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router";
import { SellerOrderDetailPage } from "./SellerOrderDetailPage";
import { getSellerOrder, updateShipmentStatus } from "../../services/sellerService";
import { deferred } from "../../test/asyncFixtures";
import type { SellerOrder } from "../../types/seller";

vi.mock("../../services/sellerService", () => ({ getSellerOrder: vi.fn(), updateShipmentStatus: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
const order: SellerOrder = {
  id: 1, order_number: "ORD-001", status: "PREPARING", order_status: "PAID",
  customer_email: "cliente@example.invalid", seller_subtotal: "85000.00",
  payment_status: "APPROVED", tracking_code: "TRK-PROPIO", shipment_status: "PREPARING",
  created_at: "2026-11-01T12:00:00Z", items: [],
  shipment: { id: 8, status: "PREPARING", seller: 4, seller_name: "Mi tienda", tracking_code: "TRK-PROPIO" },
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
  const old = deferred<SellerOrder>();
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
  expect(screen.getByRole("combobox", { name: "Estado del envío" })).toBeDisabled();
  expect(screen.getByPlaceholderText("Ubicación")).toBeDisabled();
  expect(screen.getByPlaceholderText("Descripción del evento")).toBeDisabled();
  await act(async () => { pending.resolve(undefined); });
  expect(screen.getByText("Estado del envío actualizado.")).toBeInTheDocument();
  expect(screen.getByText("No se pudo cargar el pedido.")).toBeInTheDocument();
  expect(screen.queryByText("No se pudo actualizar el envío.")).not.toBeInTheDocument();
});

test("usa el subtotal y el envío propios del contrato vendedor al despachar", async () => {
  vi.mocked(getSellerOrder).mockResolvedValue(order);
  vi.mocked(updateShipmentStatus).mockResolvedValue(undefined);
  mount();
  await screen.findByRole("heading", { name: "ORD-001" });
  expect(screen.getByText(/\$\s*85\.000,00/)).toBeInTheDocument();
  expect(screen.getByText(/TRK-PROPIO/)).toBeInTheDocument();

  const user = userEvent.setup();
  await user.selectOptions(screen.getByRole("combobox", { name: "Estado del envío" }), "DISPATCHED");
  await user.type(screen.getByPlaceholderText("Ubicación"), "Mendoza");
  await user.type(screen.getByPlaceholderText("Descripción del evento"), "Retirado por transporte");
  await user.click(screen.getByRole("button", { name: "Actualizar seguimiento" }));

  expect(updateShipmentStatus).toHaveBeenCalledExactlyOnceWith(8, {
    status: "DISPATCHED", location: "Mendoza", description: "Retirado por transporte",
  });
});

test.each(["DELIVERED", "CANCELLED"] as const)("el envío %s no permite modificar ningún campo", async (status) => {
  vi.mocked(getSellerOrder).mockResolvedValue({
    ...order, shipment: { ...order.shipment!, status },
  });
  mount();
  await screen.findByRole("heading", { name: "ORD-001" });
  expect(screen.getByRole("button", { name: "Actualizar seguimiento" })).toBeDisabled();
  expect(screen.getByRole("combobox", { name: "Estado del envío" })).toBeDisabled();
  expect(screen.getByPlaceholderText("Ubicación")).toBeDisabled();
  expect(screen.getByPlaceholderText("Descripción del evento")).toBeDisabled();
  expect(updateShipmentStatus).not.toHaveBeenCalled();
});

test("un envío abierto no ofrece cancelación", async () => {
  vi.mocked(getSellerOrder).mockResolvedValue(order);
  mount();
  await screen.findByRole("heading", { name: "ORD-001" });
  expect(screen.queryByRole("option", { name: "Cancelado" })).not.toBeInTheDocument();
});

test.each(["DELIVERED", "CANCELLED"] as const)("el pedido global %s bloquea un envío heredado que todavía figura abierto", async (orderStatus) => {
  vi.mocked(getSellerOrder).mockResolvedValue({ ...order, order_status: orderStatus });
  mount();
  await screen.findByRole("heading", { name: "ORD-001" });
  expect(screen.getByText("El pedido está cerrado y no admite cambios de envío.")).toBeVisible();
  expect(screen.getByRole("button", { name: "Actualizar seguimiento" })).toBeDisabled();
  expect(screen.getByRole("combobox", { name: "Estado del envío" })).toBeDisabled();
  expect(screen.getByPlaceholderText("Ubicación")).toBeDisabled();
  expect(updateShipmentStatus).not.toHaveBeenCalled();
});

test("un guardado tardío no actualiza el mismo pedido si se abrió de nuevo", async () => {
  const pending = deferred<void>();
  vi.mocked(getSellerOrder).mockResolvedValue(order);
  vi.mocked(updateShipmentStatus).mockReturnValueOnce(pending.promise);
  const router = mount();
  await screen.findByRole("heading", { name: "ORD-001" });
  await userEvent.setup().click(screen.getByRole("button", { name: "Actualizar seguimiento" }));

  await act(async () => { await router.navigate("/seller/orders/2"); });
  await act(async () => { await router.navigate("/seller/orders/1"); });
  await screen.findByRole("button", { name: "Actualizar seguimiento" });
  const loadCount = vi.mocked(getSellerOrder).mock.calls.length;
  await act(async () => { pending.resolve(undefined); });

  expect(screen.queryByText("Estado del envío actualizado.")).not.toBeInTheDocument();
  expect(getSellerOrder).toHaveBeenCalledTimes(loadCount);
  expect(screen.getByRole("button", { name: "Actualizar seguimiento" })).toBeEnabled();
});
