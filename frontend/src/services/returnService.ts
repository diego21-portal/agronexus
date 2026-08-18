import { api } from "../lib/api";
import {
  extractResults,
  type ListResponse,
} from "../types/api";
import type {
  CreateReturnRequest,
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