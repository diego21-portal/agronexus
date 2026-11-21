import { act, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, expect, test, vi } from "vitest";
import { AuthContext } from "../features/auth/AuthContext";
import { clearTokens, saveTokens } from "../lib/tokenStorage";
import { getOrderById } from "../services/orderService";
import { authValue, deferred, testUser } from "../test/asyncFixtures";
import type { User } from "../types/auth";
import type { Order } from "../types/order";
import { OrderConfirmationPage } from "./OrderConfirmationPage";

vi.mock("../services/orderService", () => ({ getOrderById: vi.fn() }));

function order(id: number, street: string): Order {
  return {
    id, order_number: `AGX-${id}`, status: "PAID", subtotal: "100.00",
    discount_total: "0.00", shipping_cost: "0.00", total: "100.00",
    created_at: "2026-11-01T12:00:00Z", shipments: [], items: [],
    shipping_address_snapshot_source: "CHECKOUT",
    shipping_address_snapshot: {
      region_id: 2, region_name: "Mendoza", street, number: "123", city: "Mendoza",
      province: "Mendoza", postal_code: "5500", reference: "Entrega privada",
    },
  };
}

let currentUser: User | null;

function Harness({ router }: { router: ReturnType<typeof createMemoryRouter> }) {
  return <AuthContext.Provider value={authValue(currentUser)}>
    <RouterProvider router={router} />
  </AuthContext.Provider>;
}

function mount(historyOrder?: Order) {
  const router = createMemoryRouter([
    { path: "/orders/:orderId/confirmation", element: <OrderConfirmationPage /> },
    { path: "/account/orders", element: <p>Mis pedidos actuales</p> },
  ], {
    initialEntries: [{ pathname: "/orders/31/confirmation", state: { order: historyOrder } }],
  });
  return { ...render(<Harness router={router} />), router };
}

beforeEach(() => {
  vi.resetAllMocks();
  clearTokens();
  saveTokens("confirmation-access-A", "confirmation-refresh-A");
  currentUser = testUser;
});

test("siempre consulta el pedido autorizado y nunca usa la dirección guardada en el historial", async () => {
  const pending = deferred<Order>();
  vi.mocked(getOrderById).mockReturnValue(pending.promise);
  mount(order(31, "Dirección obsoleta del historial"));

  await waitFor(() => expect(getOrderById).toHaveBeenCalledWith(31));
  expect(screen.getByText("Cargando orden...")).toBeVisible();
  expect(screen.queryByText(/Dirección obsoleta del historial/)).not.toBeInTheDocument();

  await act(async () => { pending.resolve(order(31, "Dirección confirmada por el servidor")); });
  expect(await screen.findByText("Dirección confirmada por el servidor 123")).toBeVisible();
  expect(screen.queryByText(/Dirección obsoleta del historial/)).not.toBeInTheDocument();
});

test("volver al historial de A después de cerrar sesión y entrar como B no muestra los datos de A", async () => {
  const aliceOrder = order(31, "Dirección privada del comprador A");
  const pendingForB = deferred<Order>();
  vi.mocked(getOrderById).mockResolvedValueOnce(aliceOrder).mockReturnValueOnce(pendingForB.promise);
  const mounted = mount(aliceOrder);
  await screen.findByText("Dirección privada del comprador A 123");
  await act(async () => { await mounted.router.navigate("/account/orders"); });

  clearTokens();
  currentUser = null;
  mounted.rerender(<Harness router={mounted.router} />);
  saveTokens("confirmation-access-B", "confirmation-refresh-B");
  currentUser = { ...testUser, id: 99, email: "buyer-B@example.invalid" };
  mounted.rerender(<Harness router={mounted.router} />);
  await act(async () => { await mounted.router.navigate(-1); });

  expect(getOrderById).toHaveBeenCalledTimes(2);
  expect(screen.getByText("Cargando orden...")).toBeVisible();
  expect(screen.queryByText(/Dirección privada del comprador A/)).not.toBeInTheDocument();
  expect(screen.queryByText("AGX-31")).not.toBeInTheDocument();
  await act(async () => { pendingForB.reject(new Error("Este pedido no pertenece a B")); });
  expect(await screen.findByRole("link", { name: "Ver mis pedidos" })).toBeVisible();
  expect(screen.queryByText(/Dirección privada del comprador A/)).not.toBeInTheDocument();
  expect(screen.queryByText("AGX-31")).not.toBeInTheDocument();
});

test("oculta la confirmación anterior al cambiar de comprador y descarta su respuesta tardía", async () => {
  const lateForA = deferred<Order>();
  const pendingForB = deferred<Order>();
  vi.mocked(getOrderById).mockReturnValueOnce(lateForA.promise).mockReturnValueOnce(pendingForB.promise);
  const mounted = mount(order(31, "Dirección privada del comprador A"));
  await waitFor(() => expect(getOrderById).toHaveBeenCalledTimes(1));

  clearTokens();
  currentUser = null;
  mounted.rerender(<Harness router={mounted.router} />);
  saveTokens("confirmation-access-B", "confirmation-refresh-B");
  currentUser = { ...testUser, id: 99, email: "buyer-B@example.invalid" };
  mounted.rerender(<Harness router={mounted.router} />);
  await waitFor(() => expect(getOrderById).toHaveBeenCalledTimes(2));
  await act(async () => { lateForA.resolve(order(31, "Dirección privada del comprador A")); });

  expect(screen.getByText("Cargando orden...")).toBeVisible();
  expect(screen.queryByText(/Dirección privada del comprador A/)).not.toBeInTheDocument();
  await act(async () => { pendingForB.reject(new Error("Acceso denegado")); });
  expect(await screen.findByRole("link", { name: "Ver mis pedidos" })).toBeVisible();
  expect(screen.queryByText(/Dirección privada del comprador A/)).not.toBeInTheDocument();
});

test("cambiar el pedido en la URL oculta el anterior y no acepta su respuesta fuera de orden", async () => {
  const previous = deferred<Order>();
  const current = deferred<Order>();
  const newer = deferred<Order>();
  vi.mocked(getOrderById)
    .mockReturnValueOnce(previous.promise).mockReturnValueOnce(current.promise).mockReturnValueOnce(newer.promise);
  const mounted = mount();
  await waitFor(() => expect(getOrderById).toHaveBeenCalledWith(31));
  await act(async () => { await mounted.router.navigate("/orders/32/confirmation"); });
  await act(async () => { current.resolve(order(32, "Entrega del pedido actual")); });
  await screen.findByText("Entrega del pedido actual 123");
  await act(async () => { previous.resolve(order(31, "Entrega del pedido anterior")); });
  expect(screen.queryByText(/Entrega del pedido anterior/)).not.toBeInTheDocument();
  expect(screen.getByText("AGX-32")).toBeVisible();

  await act(async () => { await mounted.router.navigate("/orders/33/confirmation"); });
  expect(screen.getByText("Cargando orden...")).toBeVisible();
  expect(screen.queryByText(/Entrega del pedido actual/)).not.toBeInTheDocument();
  await act(async () => { newer.resolve(order(33, "Entrega del nuevo pedido")); });
  expect(await screen.findByText("Entrega del nuevo pedido 123")).toBeVisible();
});
