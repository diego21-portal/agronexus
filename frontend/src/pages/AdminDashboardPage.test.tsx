import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, expect, test, vi } from "vitest";
import { api } from "../lib/api";
import { AuthContext } from "../features/auth/AuthContext";
import { authValue, deferred, testUser } from "../test/asyncFixtures";
import { adminDashboardData } from "../test/dashboardFixtures";
import { AdminDashboardPage } from "./AdminDashboardPage";
import type { User } from "../types/auth";

vi.mock("../lib/api", () => ({ api: { get: vi.fn() } }));
const admin: User = { ...testUser, role: "ADMIN" };
beforeEach(() => vi.resetAllMocks());
function mount(user: User | null = admin) {
  const wrapper = (current: User | null) => <AuthContext.Provider value={authValue(current)}><MemoryRouter><AdminDashboardPage /></MemoryRouter></AuthContext.Provider>;
  const view = render(wrapper(user));
  return { ...view, changeAccount: (current: User | null) => view.rerender(wrapper(current)) };
}

test("muestra métricas anidadas reales, importes distintos y nombres de rankings", async () => {
  vi.mocked(api.get).mockResolvedValue({ data: adminDashboardData() });
  mount();
  const users = await screen.findByRole("article", { name: "Usuarios" });
  expect(within(users).getByText("17")).toBeVisible();
  expect(within(screen.getByRole("article", { name: "Productos" })).getByText("23")).toBeVisible();
  expect(within(screen.getByRole("article", { name: "Órdenes" })).getByText("11")).toBeVisible();
  expect(within(screen.getByRole("article", { name: "Vendedores" })).getByText("5")).toBeVisible();
  const income = within(screen.getByRole("region", { name: "Ingresos netos simulados" }));
  expect(income.getByText(/\$\s*54\.321,99/)).toBeVisible();
  expect(income.getByText(/\$\s*60\.000,00/)).toBeVisible();
  expect(income.getByText(/\$\s*5\.678,01/)).toBeVisible();
  expect(screen.getByRole("link", { name: "Stock bajo: 3" })).toBeVisible();
  expect(screen.getByRole("link", { name: "Activos sin existencias: 4" })).toBeVisible();
  expect(screen.getByRole("link", { name: "Reclamos abiertos: 6" })).toBeVisible();
  expect(screen.getByRole("link", { name: "Devoluciones solicitadas: 2" })).toBeVisible();
  expect(screen.getByText("#1 Filtro real del catálogo")).toBeVisible();
  expect(screen.getByText("#1 Agro del Sur")).toBeVisible();
  expect(screen.getByText("4 pedidos · 8 unidades")).toBeVisible();
  const month = within(screen.getByRole("row", { name: /2026-11/ }));
  expect(month.getByText("7")).toBeVisible();
  expect(month.getByText(/\$\s*54\.321,99/)).toBeVisible();
  expect(screen.getByRole("link", { name: "AGX-ADMIN" })).toHaveAttribute("href", "/admin/orders/2");
});

test("un contrato plano incompatible se informa como error y se puede reintentar", async () => {
  vi.mocked(api.get).mockResolvedValueOnce({ data: { total_users: 17, total_revenue: 54321.99 } })
    .mockResolvedValueOnce({ data: adminDashboardData() });
  mount();
  expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo cargar el dashboard administrativo.");
  expect(screen.queryByRole("article", { name: "Usuarios" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  expect(await screen.findByRole("article", { name: "Usuarios" })).toHaveTextContent("17");
});

test("los valores cero y rankings vacíos son datos válidos del servidor", async () => {
  const data = adminDashboardData();
  data.users.total_users = 0; data.products.total_products = 0;
  data.top_products = []; data.top_sellers = []; data.monthly_sales = []; data.recent_orders = [];
  vi.mocked(api.get).mockResolvedValueOnce({ data });
  mount();
  expect(await screen.findByRole("article", { name: "Usuarios" })).toHaveTextContent("0");
  expect(screen.getByText("Todavía no hay productos vendidos.")).toBeVisible();
  expect(screen.getByText("Todavía no hay vendedores con ventas.")).toBeVisible();
  expect(screen.getByText("Todavía no hay ventas mensuales registradas.")).toBeVisible();
});

test("el cambio de cuenta o rol descarta la respuesta administrativa anterior", async () => {
  const pending = deferred<{ data: ReturnType<typeof adminDashboardData> }>();
  vi.mocked(api.get).mockReturnValueOnce(pending.promise)
    .mockResolvedValueOnce({ data: { ...adminDashboardData(), users: { total_users: 88 } } });
  const view = mount();
  view.changeAccount({ ...admin, id: 2 });
  expect(await screen.findByRole("article", { name: "Usuarios" })).toHaveTextContent("88");
  await act(async () => pending.resolve({ data: adminDashboardData() }));
  expect(screen.getByRole("article", { name: "Usuarios" })).toHaveTextContent("88");
  view.changeAccount({ ...admin, id: 2, role: "CUSTOMER" });
  expect(screen.queryByRole("article", { name: "Usuarios" })).not.toBeInTheDocument();
  expect(api.get).toHaveBeenCalledTimes(2);
});
