import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, expect, test, vi } from "vitest";
import { AuthContext } from "../features/auth/AuthContext";
import { CartContext, type CartContextValue } from "../features/cart/CartContext";
import { api } from "../lib/api";
import { clearTokens, saveTokens } from "../lib/tokenStorage";
import { authValue, deferred, testUser } from "../test/asyncFixtures";
import type { Address } from "../types/address";
import type { Cart } from "../types/cart";
import type { CheckoutQuote, CheckoutRequest } from "../types/checkout";
import type { Order } from "../types/order";
import { CheckoutPage } from "./CheckoutPage";
import { OrderConfirmationPage } from "./OrderConfirmationPage";

const address: Address = {
  id: 3, region: 2, street: "Dirección guardada", number: "123", city: "Mendoza", province: "Mendoza",
  postal_code: "5500", reference: "Portón verde", is_default: true, is_active: true,
};
const cart: Cart = {
  id: 7, status: "ACTIVE", subtotal: "200.00",
  items: [{ id: 11, product_id: 8, product_name: "Filtro del carrito", quantity: 2, unit_price: "100.00", subtotal: "200.00", available_stock: 10 }],
};

function quote(values: Partial<CheckoutQuote> = {}): CheckoutQuote {
  return {
    quote_token: "signed-quote-A", expires_at: new Date(Date.now() + 300_000).toISOString(), cart_id: 7,
    items: [{ cart_item_id: 11, product_id: 8, product_name: "Filtro cotizado", sku: "F-8", seller_id: 9, seller_name: "Tienda agrícola", quantity: 2, unit_price: "90.00", total_price: "180.00" }],
    subtotal: "200.00", discount_total: "20.00", shipping_cost: "50.00", total: "230.00", currency: "ARS",
    shipping_address_snapshot: { region_id: 2, region_name: "Mendoza", street: "Entrega congelada", number: "123", city: "Mendoza", province: "Mendoza", postal_code: "5500", reference: "Portón verde" },
    price_changed: true, ...values,
  };
}

function order(values: Partial<Order> = {}): Order {
  const current = quote();
  return {
    id: 31, order_number: "AGX-COMPRA-31", status: "PAID", subtotal: current.subtotal,
    discount_total: current.discount_total, shipping_cost: current.shipping_cost, total: current.total,
    created_at: new Date().toISOString(), shipments: [], items: [],
    shipping_address_snapshot: current.shipping_address_snapshot, shipping_address_snapshot_source: "CHECKOUT",
    payment: { id: 12, payment_method: "SIMULATED_CARD", status: "APPROVED", amount: current.total },
    ...values,
  };
}

function response(config: InternalAxiosRequestConfig, data: unknown, status = 200): AxiosResponse {
  return { config, data, status, statusText: "OK", headers: {} };
}

function fail(config: InternalAxiosRequestConfig, status: number, data: unknown): never {
  throw new AxiosError("Request failed", "ERR_BAD_REQUEST", config, undefined, response(config, data, status));
}

let currentCart: Cart | null;
let currentUser = testUser;
let refreshCart = vi.fn<() => Promise<void>>();
let acknowledgeCheckout = vi.fn<(cartId: number) => void>();
let quoteHandler: (config: InternalAxiosRequestConfig) => Promise<AxiosResponse>;
let confirmHandler: (config: InternalAxiosRequestConfig) => Promise<AxiosResponse>;
let addressHandler: (config: InternalAxiosRequestConfig) => Promise<AxiosResponse>;
let adapter: ReturnType<typeof vi.fn<AxiosAdapter>>;
const quoteRequests: Record<string, unknown>[] = [];
const confirmRequests: CheckoutRequest[] = [];

function Harness({ router }: { router: ReturnType<typeof createMemoryRouter> }) {
  const value: CartContextValue = {
    cart: currentCart, loading: false, operationLoading: false, error: "", itemCount: currentCart?.items.length ?? 0,
    subtotal: Number(currentCart?.subtotal ?? 0), refreshCart, acknowledgeCheckout,
    addItem: vi.fn(), changeQuantity: vi.fn(), removeItem: vi.fn(), clearAll: vi.fn(), resetCartState: vi.fn(),
  };
  return <AuthContext.Provider value={authValue(currentUser)}><CartContext.Provider value={value}>
    <RouterProvider router={router} />
  </CartContext.Provider></AuthContext.Provider>;
}

function mount() {
  const router = createMemoryRouter([
    { path: "/checkout", element: <CheckoutPage /> },
    { path: "/orders/:orderId/confirmation", element: <OrderConfirmationPage /> },
    { path: "/account/orders", element: <p>Pedidos del comprador</p> },
  ], { initialEntries: ["/checkout"] });
  return { ...render(<Harness router={router} />), router };
}

async function review() {
  await userEvent.setup().click(await screen.findByRole("button", { name: "Revisar compra" }));
  return screen.findByRole("button", { name: "Confirmar compra" });
}

beforeEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
  clearTokens();
  saveTokens("checkout-access", "checkout-refresh");
  currentUser = testUser;
  currentCart = cart;
  refreshCart = vi.fn().mockResolvedValue(undefined);
  acknowledgeCheckout = vi.fn();
  quoteRequests.length = 0;
  confirmRequests.length = 0;
  quoteHandler = async (config) => response(config, quote());
  confirmHandler = async (config) => response(config, order(), 201);
  addressHandler = async (config) => response(config, { ...address, id: 5, street: "Dirección nueva" }, 201);
  adapter = vi.fn<AxiosAdapter>(async (config) => {
    if (config.url === "/users/me/addresses/") {
      if (config.method === "post") return addressHandler(config);
      return response(config, [address, { ...address, id: 4, street: "Otra dirección", is_default: false }]);
    }
    if (config.url === "/regions/") return response(config, [{ id: 2, name: "Mendoza", province: "Mendoza", country: "Argentina" }]);
    if (config.url === "/checkout/quote/") { quoteRequests.push(JSON.parse(config.data)); return quoteHandler(config); }
    if (config.url === "/checkout/") { confirmRequests.push(JSON.parse(config.data)); return confirmHandler(config); }
    if (config.url === "/orders/31/") return response(config, order());
    throw new Error(`Unexpected HTTP request: ${config.url}`);
  });
  api.defaults.adapter = adapter;
});

test("revisa el total y la entrega del servidor antes de permitir una confirmación con el contrato real", async () => {
  mount();
  expect(screen.queryByRole("button", { name: "Confirmar compra" })).not.toBeInTheDocument();
  await review();
  expect(quoteRequests).toEqual([{ address_id: 3, payment_method: "SIMULATED_CARD" }]);
  expect(confirmRequests).toHaveLength(0);
  expect(screen.getByText("Total a confirmar").parentElement).toHaveTextContent(/230,00/);
  expect(screen.getByText("Envío").parentElement).toHaveTextContent(/50,00/);
  expect(screen.getByText("Entrega congelada 123")).toBeVisible();
  expect(screen.getByText("Filtro cotizado")).toBeVisible();
  expect(screen.queryByText("Filtro del carrito")).not.toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole("button", { name: "Confirmar compra" }));
  await screen.findByRole("heading", { name: "¡Gracias por tu compra!" });
  expect(confirmRequests).toHaveLength(1);
  expect(confirmRequests[0]).toEqual({ address_id: 3, payment_method: "SIMULATED_CARD", quote_token: "signed-quote-A", idempotency_key: expect.stringMatching(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i) });
  expect(acknowledgeCheckout).toHaveBeenCalledWith(7);
  expect(refreshCart).toHaveBeenCalledTimes(1);
  expect(sessionStorage.getItem(`agronexus_checkout_attempt:${currentUser.id}`)).toBeNull();
});

test("transferencia usa su enum real y todos los métodos se presentan como simulados aprobados", async () => {
  mount();
  const transfer = await screen.findByRole("radio", { name: "Transferencia simulada" });
  await userEvent.setup().click(transfer);
  await review();
  expect(quoteRequests[0].payment_method).toBe("SIMULATED_BANK_TRANSFER");
  expect(screen.getByText(/registra todos los métodos como aprobados/)).toBeVisible();
  expect(screen.getByRole("radio", { name: "Cuenta empresarial simulada" })).toBeVisible();
  expect(screen.getByRole("radio", { name: "Mercado Pago simulado" })).toBeVisible();
});

test("un fallo de refresco del carrito después del pedido no cambia el éxito de la compra", async () => {
  refreshCart.mockRejectedValue(new Error("GET cart offline"));
  mount();
  await userEvent.setup().click(await review());
  await screen.findByRole("heading", { name: "¡Gracias por tu compra!" });
  expect(acknowledgeCheckout).toHaveBeenCalledWith(7);
  expect(screen.queryByText(/No se pudo confirmar/)).not.toBeInTheDocument();
  expect(confirmRequests).toHaveLength(1);
});

test("una respuesta perdida recupera la misma compra al reloguear al mismo comprador aunque la revisión venció", async () => {
  let calls = 0;
  confirmHandler = async (config) => {
    if (++calls === 1) throw new AxiosError("Network failed", "ERR_NETWORK", config);
    return response(config, order(), 200);
  };
  const first = mount();
  await userEvent.setup().click(await review());
  await screen.findByRole("button", { name: "Recuperar confirmación" });
  expect(screen.getByRole("alert")).toHaveTextContent(/No pudimos comprobar/);
  expect(screen.queryByText(/ningún cobro/)).not.toBeInTheDocument();
  const payload = confirmRequests[0];
  const attemptStorageKey = `agronexus_checkout_attempt:${currentUser.id}`;
  expect(sessionStorage.getItem(attemptStorageKey)).toContain(payload.idempotency_key);
  const stored = JSON.parse(sessionStorage.getItem(attemptStorageKey)!) as { quote: CheckoutQuote };
  stored.quote.expires_at = new Date(Date.now() - 60_000).toISOString();
  sessionStorage.setItem(attemptStorageKey, JSON.stringify(stored));
  first.unmount();
  clearTokens();
  saveTokens("new-login-same-user", "new-refresh");
  currentCart = { ...cart, id: 17, items: [], subtotal: "0.00" };
  mount();
  const recover = await screen.findByRole("button", { name: "Recuperar confirmación" });
  expect(screen.getByText("Total a confirmar").parentElement).toHaveTextContent(/230,00/);
  await userEvent.setup().click(recover);
  await screen.findByRole("heading", { name: "¡Gracias por tu compra!" });
  expect(confirmRequests).toEqual([payload, payload]);
  expect(quoteRequests).toHaveLength(1);
  expect(acknowledgeCheckout).toHaveBeenCalledWith(7);
});

test("un intento guardado nunca aparece ni se reenvía para otro comprador", async () => {
  confirmHandler = async (config) => { throw new AxiosError("Network failed", "ERR_NETWORK", config); };
  const first = mount();
  await userEvent.setup().click(await review());
  await screen.findByRole("button", { name: "Recuperar confirmación" });
  first.unmount();
  saveTokens("access-B", "refresh-B");
  currentUser = { ...testUser, id: 99, email: "other@example.invalid" };
  currentCart = { ...cart, items: [], subtotal: "0.00" };
  mount();
  await screen.findByText("No hay productos para comprar");
  expect(screen.queryByRole("button", { name: "Recuperar confirmación" })).not.toBeInTheDocument();
  expect(screen.queryByText("Entrega congelada 123")).not.toBeInTheDocument();
  expect(confirmRequests).toHaveLength(1);
});

test("un cambio de precio muestra la nueva revisión y requiere un segundo consentimiento con otra referencia", async () => {
  const updated = quote({ quote_token: "signed-quote-B", total: "300.00" });
  confirmHandler = async (config) => {
    if (confirmRequests.length === 1) fail(config, 409, { code: "quote_changed", detail: "La compra cambió. Revisa el total actualizado.", quote: updated });
    return response(config, order({ total: "300.00" }), 201);
  };
  mount();
  await userEvent.setup().click(await review());
  await screen.findByRole("alert");
  expect(screen.getByText("Total a confirmar").parentElement).toHaveTextContent(/300,00/);
  expect(confirmRequests).toHaveLength(1);
  expect(screen.queryByRole("heading", { name: "¡Gracias por tu compra!" })).not.toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole("button", { name: "Confirmar compra" }));
  await screen.findByRole("heading", { name: "¡Gracias por tu compra!" });
  expect(confirmRequests[1].quote_token).toBe("signed-quote-B");
  expect(confirmRequests[1].idempotency_key).not.toBe(confirmRequests[0].idempotency_key);
});

test("la revisión tardía de una selección anterior no reemplaza el método y total nuevos", async () => {
  const pending = deferred<AxiosResponse>();
  let oldConfig: InternalAxiosRequestConfig;
  quoteHandler = async (config) => {
    if (JSON.parse(config.data).payment_method === "SIMULATED_CARD") { oldConfig = config; return pending.promise; }
    return response(config, quote({ quote_token: "transfer-quote", total: "999.00" }));
  };
  mount();
  await userEvent.setup().click(await screen.findByRole("button", { name: "Revisar compra" }));
  await userEvent.setup().click(screen.getByRole("radio", { name: "Transferencia simulada" }));
  await review();
  await act(async () => { pending.resolve(response(oldConfig!, quote())); });
  expect(screen.getByText("Total a confirmar").parentElement).toHaveTextContent(/999,00/);
  await userEvent.setup().click(screen.getByRole("button", { name: "Confirmar compra" }));
  await screen.findByRole("heading", { name: "¡Gracias por tu compra!" });
  expect(confirmRequests[0].payment_method).toBe("SIMULATED_BANK_TRANSFER");
  expect(confirmRequests[0].quote_token).toBe("transfer-quote");
});

test("cambiar dirección o carrito invalida la revisión antes de confirmar", async () => {
  const mounted = mount();
  await review();
  await userEvent.setup().click(screen.getByRole("radio", { name: /Otra dirección/ }));
  expect(screen.queryByRole("button", { name: "Confirmar compra" })).not.toBeInTheDocument();
  await review();
  expect(quoteRequests[1].address_id).toBe(4);
  currentCart = { ...cart, items: cart.items.map((item) => ({ ...item, quantity: 3 })) };
  mounted.rerender(<Harness router={mounted.router} />);
  await waitFor(() => expect(screen.queryByRole("button", { name: "Confirmar compra" })).not.toBeInTheDocument());
  expect(confirmRequests).toHaveLength(0);
});

test("doble clic en confirmar produce una sola petición y conserva la referencia mientras espera", async () => {
  const pending = deferred<AxiosResponse>();
  let config: InternalAxiosRequestConfig;
  confirmHandler = async (request) => { config = request; return pending.promise; };
  mount();
  const button = await review();
  fireEvent.click(button);
  fireEvent.click(button);
  await waitFor(() => expect(confirmRequests).toHaveLength(1));
  expect(screen.getByRole("button", { name: "Confirmando..." })).toBeDisabled();
  await act(async () => { pending.resolve(response(config!, order(), 201)); });
  await screen.findByRole("heading", { name: "¡Gracias por tu compra!" });
  expect(confirmRequests).toHaveLength(1);
});

async function fillNewAddress() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Nueva dirección" }));
  await user.type(screen.getByRole("textbox", { name: "Calle" }), "Dirección nueva");
  await user.type(screen.getByRole("textbox", { name: "Número" }), "456");
  await user.type(screen.getByRole("textbox", { name: "Ciudad" }), "Mendoza");
  await user.type(screen.getByRole("textbox", { name: "Código postal" }), "5501");
  return user;
}

test("guardar una dirección invalida la revisión y bloquea revisar o confirmar hasta que termina", async () => {
  const pendingAddress = deferred<AxiosResponse>();
  let addressConfig: InternalAxiosRequestConfig;
  addressHandler = async (config) => { addressConfig = config; return pendingAddress.promise; };
  mount();
  await review();
  const user = await fillNewAddress();
  await user.click(screen.getByRole("button", { name: "Guardar dirección" }));

  expect(screen.queryByRole("button", { name: "Confirmar compra" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Revisar compra" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Guardando..." })).toBeDisabled();
  expect(screen.getByRole("radio", { name: "Transferencia simulada" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Revisar compra" }));
  expect(quoteRequests).toHaveLength(1);
  expect(confirmRequests).toHaveLength(0);

  await act(async () => { pendingAddress.resolve(response(addressConfig!, { ...address, id: 5, street: "Dirección nueva" }, 201)); });
  await screen.findByText(/Dirección guardada. Revisa la compra/);
  expect(screen.getByRole("button", { name: "Revisar compra" })).toBeEnabled();
  expect(screen.queryByRole("button", { name: "Confirmar compra" })).not.toBeInTheDocument();
  await review();
  expect(quoteRequests[1].address_id).toBe(5);
});

test("una revisión en vuelo no reaparece mientras se guarda una dirección nueva", async () => {
  const pendingQuote = deferred<AxiosResponse>();
  const pendingAddress = deferred<AxiosResponse>();
  let quoteConfig: InternalAxiosRequestConfig;
  let addressConfig: InternalAxiosRequestConfig;
  quoteHandler = async (config) => { quoteConfig = config; return pendingQuote.promise; };
  addressHandler = async (config) => { addressConfig = config; return pendingAddress.promise; };
  mount();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Revisar compra" }));
  await fillNewAddress();
  await user.click(screen.getByRole("button", { name: "Guardar dirección" }));
  await act(async () => { pendingQuote.resolve(response(quoteConfig!, quote())); });

  expect(screen.queryByRole("button", { name: "Confirmar compra" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Revisar compra" })).toBeDisabled();
  expect(confirmRequests).toHaveLength(0);
  await act(async () => { pendingAddress.resolve(response(addressConfig!, { ...address, id: 5 }, 201)); });
  expect(await screen.findByRole("button", { name: "Revisar compra" })).toBeEnabled();
  expect(screen.queryByRole("button", { name: "Confirmar compra" })).not.toBeInTheDocument();
});
