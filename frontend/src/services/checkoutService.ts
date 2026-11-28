import { api } from "../lib/api";
import type {
  CheckoutRequest,
  CheckoutResponse,
  CheckoutQuote,
  CheckoutQuoteRequest,
} from "../types/checkout";

export async function getCheckoutQuote(data: CheckoutQuoteRequest): Promise<CheckoutQuote> {
  const response = await api.post<CheckoutQuote>("/checkout/quote/", data);
  return response.data;
}

export async function performCheckout(
  data: CheckoutRequest
): Promise<CheckoutResponse> {
  const response = await api.post<CheckoutResponse>("/checkout/", data);
  const order = response.data;
  // Without a usable order ID, the caller must keep the reference for recovery.
  if (!Number.isSafeInteger(order?.id) || order.id < 1) {
    throw new Error("La confirmación de compra no contiene un pedido válido.");
  }
  return order;
}
