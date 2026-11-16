import { api } from "../lib/api";
import {
  extractResults,
  type ListResponse,
} from "../types/api";
import type {
  CreateReturnRequest,
  InspectReturnPayload,
  ReceiveReturnPayload,
  ReturnRequest,
} from "../types/return";

export async function getMyReturns(): Promise<ReturnRequest[]> {
  const response = await api.get<ListResponse<ReturnRequest>>(
    "/users/me/returns/"
  );

  return extractResults(response.data);
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
