import { api } from "../lib/api";
import { extractResults } from "../types/api";
import type { ListResponse } from "../types/api";
import type {
  Order,
  OrderTrackingResponse,
} from "../types/order";

export async function getOrders(): Promise<Order[]> {
  const response = await api.get<ListResponse<Order>>(
    "/orders/"
  );

  return extractResults(response.data);
}

export async function getOrderById(
  orderId: number
): Promise<Order> {
  const response = await api.get<Order>(
    `/orders/${orderId}/`
  );

  return response.data;
}

export async function getOrderTracking(
  orderId: number
): Promise<OrderTrackingResponse> {
  const response = await api.get<OrderTrackingResponse>(
    `/orders/${orderId}/tracking/`
  );

  return response.data;
}
