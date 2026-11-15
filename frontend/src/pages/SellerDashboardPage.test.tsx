import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, expect, test, vi } from "vitest";

import { api } from "../lib/api";
import { SellerDashboardPage } from "./SellerDashboardPage";

vi.mock("../lib/api", () => ({ api: { get: vi.fn() } }));
beforeEach(() => vi.resetAllMocks());

test("los pedidos recientes muestran el importe y la entrega de los productos propios", async () => {
  vi.mocked(api.get).mockResolvedValueOnce({
    data: {
      recent_orders: [{
        id: 1, order_number: "AGX-PARCIAL", status: "DELIVERED", order_status: "PREPARING",
        seller_subtotal: "85000.00", created_at: "2026-11-01T12:00:00Z",
      }],
    },
  });

  render(<MemoryRouter><SellerDashboardPage /></MemoryRouter>);
  const row = within(await screen.findByRole("row", { name: /AGX-PARCIAL/ }));
  expect(row.getByText(/\$\s*85\.000,00/)).toBeVisible();
  expect(row.getByText("Entregado")).toBeVisible();
  expect(row.queryByText("Preparando")).not.toBeInTheDocument();
});
