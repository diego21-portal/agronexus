import { api } from "../lib/api";
import type {
  CreateReturnRequest,
  InspectReturnPayload,
  ReceiveReturnPayload,
  ReturnRequest,
} from "../types/return";
import { requestList } from "./listRequest";

export function getMyReturns(signal?: AbortSignal): Promise<ReturnRequest[]> {
  return requestList("/users/me/returns/", signal);
}

export async function createReturn(
  orderItemId: number,
  data: CreateReturnRequest
): Promise<ReturnRequest> {
  const response = await api.post<ReturnRequest>(
    `/order-items/${orderItemId}/returns/`,
    data
  );

  return response.data;
}

export async function receiveReturn(
  role: "seller" | "admin",
  returnId: number,
  data: ReceiveReturnPayload,
): Promise<ReturnRequest> {
  const response = await api.post<ReturnRequest>(`/${role}/returns/${returnId}/receive/`, data);
  return response.data;
}

export async function inspectReturn(
  role: "seller" | "admin",
  returnId: number,
  data: InspectReturnPayload,
): Promise<ReturnRequest> {
  const response = await api.post<ReturnRequest>(`/${role}/returns/${returnId}/inspect/`, data);
  return response.data;
}
