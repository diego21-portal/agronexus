import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, expect, test, vi } from "vitest";

import { api } from "../../lib/api";
import type { SellerOrder } from "../../types/seller";
import { SellerOrdersPage } from "./SellerOrdersPage";

vi.mock("../../lib/api", () => ({ api: { get: vi.fn() } }));
beforeEach(() => vi.resetAllMocks());

test("el listado usa el subtotal y estado del vendedor aunque el pedido global siga abierto", async () => {
  const orders: SellerOrder[] = [
    {
      id: 1, order_number: "ORD-ENTREGA-PARCIAL", customer_email: "cliente@example.invalid",
      status: "DELIVERED", order_status: "PREPARING", seller_subtotal: "85000.00",
      payment_status: "APPROVED", tracking_code: "TRK-PROPIO", shipment_status: "DELIVERED",
      shipment: { id: 8, seller: 4, seller_name: "Mi tienda", status: "DELIVERED" },
      items: [], created_at: "2026-11-01T12:00:00Z",
    },
    {
      id: 2, order_number: "ORD-PREPARANDO", customer_email: "cliente@example.invalid",
      status: "PREPARING", order_status: "SHIPPED", seller_subtotal: "42000.00",
      payment_status: "APPROVED", tracking_code: "TRK-OTRO", shipment_status: "PREPARING",
      shipment: { id: 9, seller: 4, seller_name: "Mi tienda", status: "PREPARING" },
      items: [], created_at: "2026-11-02T12:00:00Z",
    },
  ];
  vi.mocked(api.get).mockResolvedValueOnce({ data: orders });

  render(<MemoryRouter><SellerOrdersPage /></MemoryRouter>);
  await screen.findByRole("link", { name: "ORD-ENTREGA-PARCIAL" });
  expect(screen.getByText(/\$\s*85\.000,00/)).toBeInTheDocument();
  expect(screen.getByText(/\$\s*42\.000,00/)).toBeInTheDocument();

  await userEvent.setup().selectOptions(screen.getByRole("combobox", { name: "Filtrar pedidos por estado" }), "DELIVERED");
  expect(screen.getByRole("link", { name: "ORD-ENTREGA-PARCIAL" })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "ORD-PREPARANDO" })).not.toBeInTheDocument();
});
