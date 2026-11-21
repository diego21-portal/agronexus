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
  return response.data;
}
