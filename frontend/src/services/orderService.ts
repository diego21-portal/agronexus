import { api } from "../lib/api";
import { requestList } from "./listRequest";
import type {
  Order,
  OrderTrackingResponse,
} from "../types/order";

export function getOrders(signal?: AbortSignal): Promise<Order[]> {
  return requestList("/orders/", signal);
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
