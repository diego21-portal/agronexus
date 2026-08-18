import { api } from "../lib/api";
import type {
  CheckoutRequest,
  CheckoutResponse,
} from "../types/checkout";
import type { Order } from "../types/order";

export async function performCheckout(
  data: CheckoutRequest
): Promise<CheckoutResponse> {
  const response = await api.post<
    CheckoutResponse | Order
  >("/checkout/", data);

  const responseData = response.data;

  if (
    typeof responseData === "object" &&
    responseData !== null &&
    "order" in responseData
  ) {
    return responseData as CheckoutResponse;
  }

  return {
    order: responseData as Order,
  };
}