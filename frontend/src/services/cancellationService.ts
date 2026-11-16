import { api } from "../lib/api";
import { extractResults, type ListResponse } from "../types/api";
import type {
  CancellationActionPayload,
  CancellationRequest,
  CancellationRole,
} from "../types/cancellation";

export async function requestShipmentCancellation(shipmentId: number, reason: string): Promise<CancellationRequest> {
  const response = await api.post<CancellationRequest>(`/shipments/${shipmentId}/cancellation/`, { reason });
  return response.data;
}

export async function getCancellations(role: CancellationRole): Promise<CancellationRequest[]> {
  const prefix = role === "customer" ? "users/me" : role;
  const response = await api.get<ListResponse<CancellationRequest>>(`/${prefix}/cancellations/`);
  return extractResults(response.data);
}

export async function withdrawCancellation(id: number): Promise<CancellationRequest> {
  const response = await api.post<CancellationRequest>(`/cancellations/${id}/withdraw/`, {});
  return response.data;
}

export async function actOnCancellation(
  role: "seller" | "admin", id: number, payload: CancellationActionPayload,
): Promise<CancellationRequest> {
  const response = await api.post<CancellationRequest>(`/${role}/cancellations/${id}/action/`, payload);
  return response.data;
}
