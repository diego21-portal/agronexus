import { act, render, screen } from "@testing-library/react";
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, expect, test } from "vitest";
import { AuthContext } from "../auth/AuthContext";
import { api } from "../../lib/api";
import { clearTokens, saveTokens } from "../../lib/tokenStorage";
import { authValue, deferred, testUser } from "../../test/asyncFixtures";
import type { Order } from "../../types/order";
import { OrderConfirmationPage } from "../../pages/OrderConfirmationPage";

let buyer = testUser;
function Harness({ router }: { router: ReturnType<typeof createMemoryRouter> }) {
  return <AuthContext.Provider value={authValue(buyer)}><RouterProvider router={router} /></AuthContext.Provider>;
}
function mount(historyOrder: Order, routeId = historyOrder.id) {
  const router = createMemoryRouter([{ path: "/orders/:orderId/confirmation", element: <OrderConfirmationPage /> }], {
    initialEntries: [{ pathname: `/orders/${routeId}/confirmation`, state: { order: historyOrder } }],
  });
  return { ...render(<Harness router={router} />), router };
}
function response(config: InternalAxiosRequestConfig, order: Order): AxiosResponse {
  return { config, data: order, status: 200, statusText: "OK", headers: {} };
}
const base: Order = {
  id: 31, order_number: "AGX-31", status: "PAID", subtotal: "100.00", discount_total: "0.00", shipping_cost: "0.00", total: "100.00", shipments: [], created_at: "2026-11-17T12:00:00Z",
  shipping_address_detail: { id: 3, street: "Dirección editada después", number: "999", city: "Nueva ciudad", province: "Mendoza", postal_code: "5500", is_default: true, is_active: true },
};
const captured: Order = { ...base, shipping_address_snapshot_source: "CHECKOUT", shipping_address_snapshot: {
  region_id: 2, region_name: "Mendoza", street: "Entrega original", number: "123", city: "Mendoza", province: "Mendoza", postal_code: "5500", reference: "Portón verde",
} };

beforeEach(() => {
  clearTokens();
  saveTokens("buyer-access", "buyer-refresh");
  buyer = testUser;
});

test("la confirmación obtiene del servidor la dirección capturada aunque se haya editado la libreta", async () => {
  api.defaults.adapter = async (config) => response(config, captured);
  mount(base);
  expect(await screen.findByText("Entrega original 123")).toBeVisible();
  expect(screen.queryByText(/Dirección editada después/)).not.toBeInTheDocument();
});

test("un pedido anterior avisa que no conserva dirección verificable y no inventa historia con la libreta actual", async () => {
  api.defaults.adapter = async (config) => response(config, { ...base, shipping_address_snapshot_source: "LEGACY_UNKNOWN", shipping_address_snapshot: null });
  mount(captured);
  expect(await screen.findByText(/no conserva una copia verificable/)).toBeVisible();
  expect(screen.queryByText(/Dirección editada después/)).not.toBeInTheDocument();
  expect(screen.queryByText("Entrega original 123")).not.toBeInTheDocument();
});

test("otro comprador no ve el pedido privado conservado en el historial del navegador", async () => {
  buyer = { ...testUser, id: 99, email: "buyer-b@example.invalid" };
  saveTokens("buyer-B", "refresh-B");
  api.defaults.adapter = async (config) => {
    throw new AxiosError("Not found", "ERR_BAD_REQUEST", config, undefined, {
      ...response(config, base), status: 404, data: { detail: "Pedido no encontrado." },
    });
  };
  mount(captured);
  expect(screen.queryByText("Entrega original 123")).not.toBeInTheDocument();
  expect(await screen.findByText("Pedido no encontrado.")).toBeVisible();
  expect(screen.queryByText("Entrega original 123")).not.toBeInTheDocument();
});

test("cambiar la URL ignora una respuesta anterior y un pedido distinto guardado en location.state", async () => {
  const pending = deferred<AxiosResponse>();
  let oldConfig: InternalAxiosRequestConfig;
  const newer: Order = { ...captured, id: 32, order_number: "AGX-32", shipping_address_snapshot: { ...captured.shipping_address_snapshot!, street: "Entrega del pedido nuevo" } };
  api.defaults.adapter = async (config) => {
    if (config.url === "/orders/31/") { oldConfig = config; return pending.promise; }
    return response(config, newer);
  };
  const mounted = mount(captured);
  await act(async () => { await mounted.router.navigate("/orders/32/confirmation", { state: { order: captured } }); });
  expect(await screen.findByText("Entrega del pedido nuevo 123")).toBeVisible();
  await act(async () => { pending.resolve(response(oldConfig!, captured)); });
  expect(screen.getByText("Entrega del pedido nuevo 123")).toBeVisible();
  expect(screen.queryByText("Entrega original 123")).not.toBeInTheDocument();
});

test("cambiar de comprador oculta inmediatamente el pedido anterior antes de que responda la API nueva", async () => {
  api.defaults.adapter = async (config) => response(config, captured);
  const mounted = mount(captured);
  await screen.findByText("Entrega original 123");
  const pending = deferred<AxiosResponse>();
  let newConfig: InternalAxiosRequestConfig;
  api.defaults.adapter = async (config) => { newConfig = config; return pending.promise; };
  buyer = { ...testUser, id: 99 };
  saveTokens("buyer-B", "refresh-B");
  mounted.rerender(<Harness router={mounted.router} />);
  expect(screen.queryByText("Entrega original 123")).not.toBeInTheDocument();
  await act(async () => {
    pending.reject(new AxiosError("Not found", "ERR_BAD_REQUEST", newConfig!, undefined, {
      ...response(newConfig!, base), status: 404, data: { detail: "Pedido no encontrado." },
    }));
  });
  expect(await screen.findByText("Pedido no encontrado.")).toBeVisible();
});
