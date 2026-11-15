import { render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, expect, test, vi } from "vitest";
import { getOrderById } from "../../services/orderService";
import type { Order, Shipment } from "../../types/order";
import { OrderDetailPage } from "./OrderDetailPage";

vi.mock("../../services/orderService", () => ({ getOrderById: vi.fn() }));
beforeEach(() => vi.resetAllMocks());

const shipments: Shipment[] = [
  { id: 10, seller: 1, seller_name: "Repuestos Mendoza", status: "DELIVERED", tracking_code: "TRK-FILTRO" },
  { id: 20, seller: 2, seller_name: "Bombas Córdoba", status: "PREPARING", tracking_code: "TRK-BOMBA" },
];
const order: Order = {
  id: 1, order_number: "AGX-PARCIAL", status: "PREPARING", subtotal: "300.00",
  discount_total: "0.00", shipping_cost: "0.00", total: "300.00", shipment: null, shipments,
  created_at: "2026-11-01T12:00:00Z",
  items: [
    {
      id: 101, product: 1, product_name: "Filtro entregado", product_slug: "filtro", sku: "F-1",
      quantity: 1, unit_price: "100.00", total_price: "100.00", seller: 1,
      is_delivered: true, delivery_status: "DELIVERED",
    },
    {
      id: 102, product: 2, product_name: "Bomba pendiente", product_slug: "bomba", sku: "B-2",
      quantity: 1, unit_price: "200.00", total_price: "200.00", seller: 2,
      is_delivered: false, delivery_status: "PREPARING",
    },
  ],
};

function mount() {
  const router = createMemoryRouter(
    [{ path: "/account/orders/:orderId", element: <OrderDetailPage /> }],
    { initialEntries: ["/account/orders/1"] },
  );
  render(<RouterProvider router={router} />);
}

test("una entrega parcial habilita reseña y devolución solo para los productos entregados", async () => {
  vi.mocked(getOrderById).mockResolvedValue(order);
  mount();
  const delivered = within((await screen.findByText("Filtro entregado")).closest("article")!);
  const pending = within(screen.getByText("Bomba pendiente").closest("article")!);

  expect(delivered.getByRole("link", { name: "Solicitar devolución" })).toHaveAttribute("href", "/account/orders/1/items/101/return");
  expect(delivered.getByRole("link", { name: "Calificar" })).toHaveAttribute("href", "/products/filtro?order_item=101#reviews");
  expect(pending.queryByRole("link", { name: "Solicitar devolución" })).not.toBeInTheDocument();
  expect(pending.queryByRole("link", { name: "Calificar" })).not.toBeInTheDocument();
  expect(screen.getByText("TRK-FILTRO")).toBeVisible();
  expect(screen.getByText("TRK-BOMBA")).toBeVisible();
});
