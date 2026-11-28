import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { beforeEach, expect, test, vi } from "vitest";
import { api } from "../lib/api";
import { clearTokens, saveTokens } from "../lib/tokenStorage";
import { paymentMethodLabels, type CheckoutRequest } from "../types/checkout";
import { createAddress, deleteAddress, getAddresses, updateAddress } from "./addressService";
import { getCheckoutQuote, performCheckout } from "./checkoutService";

function response(config: InternalAxiosRequestConfig, data: unknown, status = 200): AxiosResponse {
  return { config, data, status, statusText: "OK", headers: {} };
}

beforeEach(() => { clearTokens(); saveTokens("test-access", "test-refresh"); });

test("cotizar envía address_id y los cinco enums reales sin confirmar una compra", async () => {
  const adapter = vi.fn<AxiosAdapter>(async (config) => response(config, { quote_token: "signed" }));
  api.defaults.adapter = adapter;
  for (const payment_method of Object.keys(paymentMethodLabels) as (keyof typeof paymentMethodLabels)[]) {
    await getCheckoutQuote({ address_id: 3, payment_method });
  }
  expect(adapter).toHaveBeenCalledTimes(5);
  for (const [config] of adapter.mock.calls) {
    expect(config.url).toBe("/checkout/quote/");
    expect(config.method).toBe("post");
    expect(JSON.parse(config.data)).toEqual({ address_id: 3, payment_method: expect.any(String) });
  }
});

test.each([201, 200])("confirmación %s devuelve el Order directo y conserva exactamente el intento enviado", async (status) => {
  const order = { id: 31, order_number: "AGX-31", total: "230.00" };
  const adapter = vi.fn<AxiosAdapter>(async (config) => response(config, order, status));
  api.defaults.adapter = adapter;
  const payload: CheckoutRequest = { address_id: 3, payment_method: "SIMULATED_BANK_TRANSFER", quote_token: "signed", idempotency_key: "ac54c08e-fbe4-4834-b011-f7bcd83ff38c" };
  expect(await performCheckout(payload)).toEqual(order);
  expect(adapter.mock.calls[0][0].url).toBe("/checkout/");
  expect(JSON.parse(adapter.mock.calls[0][0].data)).toEqual(payload);
});

test.each([null, { id: 0 }, { id: "31" }, { total: "230.00" }])("rechaza confirmaciones sin un identificador de pedido válido", async (body) => {
  api.defaults.adapter = async (config) => response(config, body, 201);
  await expect(performCheckout({
    address_id: 3, payment_method: "SIMULATED_CARD", quote_token: "signed",
    idempotency_key: "ac54c08e-fbe4-4834-b011-f7bcd83ff38c",
  })).rejects.toThrow("La confirmación de compra no contiene un pedido válido.");
});

test("las direcciones utilizan el contrato users/me tanto para cargar como para crear y editar", async () => {
  const adapter = vi.fn<AxiosAdapter>(async (config) => response(config, config.method === "get" ? [] : {}));
  api.defaults.adapter = adapter;
  const address = { region: 2, street: "Calle", number: "3", city: "Mendoza", province: "Mendoza", postal_code: "5500", is_default: true };
  await getAddresses();
  await createAddress(address);
  await updateAddress(3, { street: "Calle nueva" });
  await deleteAddress(3);
  expect(adapter.mock.calls.map(([config]) => [config.method, config.url])).toEqual([
    ["get", "/users/me/addresses/"], ["post", "/users/me/addresses/"],
    ["patch", "/users/me/addresses/3/"], ["delete", "/users/me/addresses/3/"],
  ]);
});
