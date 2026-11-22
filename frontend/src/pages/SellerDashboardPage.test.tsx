import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, expect, test, vi } from "vitest";
import { api } from "../lib/api";
import { SellerDashboardPage } from "./SellerDashboardPage";
import { AuthContext } from "../features/auth/AuthContext";
import { authValue, deferred, testUser } from "../test/asyncFixtures";
import { sellerDashboardData } from "../test/dashboardFixtures";
import type { User } from "../types/auth";

vi.mock("../lib/api", () => ({ api: { get: vi.fn() } }));
beforeEach(() => vi.resetAllMocks());
function mount(user: User | null = testUser) {
  const wrapper = (current: User | null) => <AuthContext.Provider value={authValue(current)}><MemoryRouter><SellerDashboardPage /></MemoryRouter></AuthContext.Provider>;
  const view = render(wrapper(user));
  return { ...view, changeAccount: (current: User | null) => view.rerender(wrapper(current)) };
}

test("las métricas del vendedor usan el contrato anidado, el ingreso neto y el ranking real", async () => {
  vi.mocked(api.get).mockResolvedValueOnce({ data: sellerDashboardData() });
  mount();
  expect(await screen.findByRole("article", { name: "Productos" })).toHaveTextContent("13");
  expect(screen.getByRole("article", { name: "Productos" })).toHaveTextContent("9 publicados");
  expect(screen.getByRole("article", { name: "Pedidos" })).toHaveTextContent("5");
  expect(screen.getByRole("article", { name: "Preguntas pendientes" })).toHaveTextContent("3");
  expect(screen.getByRole("article", { name: "Ingresos netos simulados" })).toHaveTextContent(/\$\s*72\.000,00/);
  expect(screen.getByRole("article", { name: "Importe bruto vendido" })).toHaveTextContent(/\$\s*85\.000,00/);
  expect(screen.getByRole("article", { name: "Reembolsos registrados" })).toHaveTextContent(/\$\s*13\.000,00/);
  expect(screen.getByText("#1 Filtro vendido propio")).toBeVisible();
  const monthly = within(screen.getByRole("row", { name: /2026-11/ }));
  expect(monthly.getByText("4")).toBeVisible();
  expect(monthly.getByText("8")).toBeVisible();
  expect(monthly.getByText(/\$\s*72\.000,00/)).toBeVisible();
});

test("los pedidos recientes muestran el importe y la entrega de los productos propios", async () => {
  vi.mocked(api.get).mockResolvedValueOnce({ data: sellerDashboardData() });
  mount();
  const row = within(await screen.findByRole("row", { name: /AGX-PARCIAL/ }));
  expect(row.getByText(/\$\s*85\.000,00/)).toBeVisible();
  expect(row.getByText("Entregado")).toBeVisible();
  expect(row.queryByText("Preparando")).not.toBeInTheDocument();
});

test("el error de carga permite reintentar sin mostrar cifras falsas", async () => {
  vi.mocked(api.get).mockRejectedValueOnce(new Error("Fallo de conexión"))
    .mockResolvedValueOnce({ data: sellerDashboardData() });
  mount();
  expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo cargar el dashboard del vendedor.");
  expect(screen.queryByRole("article", { name: "Productos" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  expect(await screen.findByRole("article", { name: "Productos" })).toHaveTextContent("13");
});

test("una respuesta incompleta se informa como error en lugar de usar ceros", async () => {
  vi.mocked(api.get).mockResolvedValueOnce({ data: { recent_orders: [], total_products: 13 } });
  mount();
  expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo cargar el dashboard del vendedor.");
  expect(screen.queryByRole("article", { name: "Productos" })).not.toBeInTheDocument();
});

test("cambiar de vendedor oculta datos previos y descarta respuestas tardías", async () => {
  const old = deferred<{ data: ReturnType<typeof sellerDashboardData> }>();
  vi.mocked(api.get).mockReturnValueOnce(old.promise)
    .mockResolvedValueOnce({ data: { ...sellerDashboardData(), products: { ...sellerDashboardData().products, total_products: 29 } } });
  const view = mount();
  view.changeAccount({ ...testUser, id: 2 });
  expect(await screen.findByRole("article", { name: "Productos" })).toHaveTextContent("29");
  await act(async () => old.resolve({ data: sellerDashboardData() }));
  expect(screen.getByRole("article", { name: "Productos" })).toHaveTextContent("29");
  view.changeAccount(null);
  expect(screen.queryByRole("article", { name: "Productos" })).not.toBeInTheDocument();
  expect(api.get).toHaveBeenCalledTimes(2);
});

test("los datos cargados desaparecen mientras se consulta otra cuenta", async () => {
  const next = deferred<{ data: ReturnType<typeof sellerDashboardData> }>();
  vi.mocked(api.get).mockResolvedValueOnce({ data: sellerDashboardData() }).mockReturnValueOnce(next.promise);
  const view = mount();
  await screen.findByRole("article", { name: "Productos" });
  view.changeAccount({ ...testUser, id: 2 });
  expect(screen.queryByRole("article", { name: "Productos" })).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Cargando dashboard");
  await act(async () => next.resolve({ data: sellerDashboardData() }));
});
