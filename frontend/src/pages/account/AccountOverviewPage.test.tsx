import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, expect, test, vi } from "vitest";
import { AuthContext } from "../../features/auth/AuthContext";
import { api } from "../../lib/api";
import { authValue } from "../../test/asyncFixtures";
import { AccountOverviewPage } from "./AccountOverviewPage";

vi.mock("../../lib/api", () => ({ api: { get: vi.fn() } }));

beforeEach(() => vi.resetAllMocks());

test.each(["HTTP 503", "respuesta inválida"])("un fallo de pedidos (%s) conserva las otras secciones y se puede reintentar", async (failure) => {
  let ordersAvailable = false;
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === "/favorites/") return { data: [{ id: 1 }] };
    if (url !== "/orders/") return { data: [] };
    if (!ordersAvailable && failure === "HTTP 503") throw new Error("Servicio no disponible");
    if (!ordersAvailable) return { data: { results: null } };
    return {
      data: [{
        id: 3, order_number: "AGX-TEST-3", created_at: "2026-11-23T12:00:00Z",
        total: "300.00", status: "PAID",
      }],
    };
  });

  render(
    <AuthContext.Provider value={authValue()}>
      <MemoryRouter><AccountOverviewPage /></MemoryRouter>
    </AuthContext.Provider>,
  );

  expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cargar tus pedidos.");
  expect(screen.queryByText("Todavía no realizaste compras.")).not.toBeInTheDocument();
  expect(within(screen.getByRole("article", { name: "Pedidos" })).getByText("No disponible")).toBeVisible();
  expect(within(screen.getByRole("article", { name: "Favoritos" })).getByText("1")).toBeVisible();

  ordersAvailable = true;
  await userEvent.click(screen.getByRole("button", { name: "Reintentar pedidos" }));
  expect(await screen.findByRole("link", { name: /AGX-TEST-3/ })).toBeVisible();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(vi.mocked(api.get).mock.calls.filter(([url]) => url === "/favorites/")).toHaveLength(1);
});
