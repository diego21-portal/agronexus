import { act, render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, expect, test, vi } from "vitest";
import { getOrderTracking } from "../../services/orderService";
import { deferred } from "../../test/asyncFixtures";
import type { OrderTrackingResponse, Shipment } from "../../types/order";
import { OrderTrackingPage } from "./OrderTrackingPage";

vi.mock("../../services/orderService", () => ({ getOrderTracking: vi.fn() }));
beforeEach(() => vi.resetAllMocks());

const firstShipment: Shipment = {
  id: 11, seller: 1, seller_name: "Repuestos Mendoza", status: "DELIVERED",
  tracking_code: "TRK-MENDOZA", carrier: "Logística Mendoza",
  events: [{ id: 101, status: "DELIVERED", description: "Filtro entregado en Mendoza.", created_at: "2026-11-01T12:00:00Z" }],
};
const secondShipment: Shipment = {
  id: 12, seller: 2, seller_name: "Bombas Córdoba", status: "PREPARING",
  tracking_code: "TRK-CORDOBA", carrier: "Logística Córdoba",
  events: [{ id: 102, status: "PREPARING", description: "Bomba en preparación en Córdoba.", created_at: "2026-11-01T13:00:00Z" }],
};
const tracking: OrderTrackingResponse = {
  order_id: 1, order_number: "AGX-001", order_status: "PREPARING",
  shipment: null, shipments: [firstShipment, secondShipment],
};

function mount() {
  const router = createMemoryRouter(
    [{ path: "/account/orders/:orderId/tracking", element: <OrderTrackingPage /> }],
    { initialEntries: ["/account/orders/1/tracking"] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

test("muestra los envíos de cada vendedor con su código e historial independientes", async () => {
  vi.mocked(getOrderTracking).mockResolvedValue(tracking);
  mount();

  const mendoza = within(await screen.findByRole("article", { name: "Envío de Repuestos Mendoza" }));
  const cordoba = within(screen.getByRole("article", { name: "Envío de Bombas Córdoba" }));
  expect(mendoza.getByText("TRK-MENDOZA")).toBeVisible();
  expect(mendoza.getByText("Filtro entregado en Mendoza.")).toBeVisible();
  expect(mendoza.queryByText("Bomba en preparación en Córdoba.")).not.toBeInTheDocument();
  expect(cordoba.getByText("TRK-CORDOBA")).toBeVisible();
  expect(cordoba.getByText("Bomba en preparación en Córdoba.")).toBeVisible();
  expect(cordoba.queryByText("Filtro entregado en Mendoza.")).not.toBeInTheDocument();
});

test("el seguimiento tardío de otro pedido no reemplaza el pedido abierto después", async () => {
  const previous = deferred<OrderTrackingResponse>();
  const current: OrderTrackingResponse = {
    order_id: 2, order_number: "AGX-002", order_status: "PREPARING",
    shipment: secondShipment, shipments: [secondShipment],
  };
  vi.mocked(getOrderTracking).mockReturnValueOnce(previous.promise).mockResolvedValueOnce(current);
  const router = mount();
  await act(async () => { await router.navigate("/account/orders/2/tracking"); });
  await screen.findByText("TRK-CORDOBA");
  await act(async () => { previous.resolve(tracking); });

  expect(screen.queryByText("TRK-MENDOZA")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "← Volver al pedido" })).toHaveAttribute("href", "/account/orders/2");
});

test("si falla un nuevo pedido no conserva el seguimiento del anterior", async () => {
  vi.mocked(getOrderTracking).mockResolvedValueOnce(tracking).mockRejectedValueOnce(new Error("Sin conexión"));
  const router = mount();
  await screen.findByText("TRK-MENDOZA");
  await act(async () => { await router.navigate("/account/orders/2/tracking"); });

  expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo cargar el seguimiento.");
  expect(screen.queryByText("TRK-MENDOZA")).not.toBeInTheDocument();
});

test("un pedido sin envíos muestra un estado vacío", async () => {
  vi.mocked(getOrderTracking).mockResolvedValue({ ...tracking, shipments: [], shipment: null });
  mount();
  expect(await screen.findByText("Todavía no hay envíos registrados.")).toBeVisible();
});
