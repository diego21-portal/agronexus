import { api } from "../lib/api";
import { requestList } from "./listRequest";
import type {
  Complaint,
  CreateComplaintRequest,
} from "../types/complaint";

export function getMyComplaints(signal?: AbortSignal): Promise<Complaint[]> {
  return requestList("/users/me/complaints/", signal);
}

export async function createComplaint(
  orderId: number,
  data: CreateComplaintRequest
): Promise<Complaint> {
  const response = await api.post<Complaint>(
    `/orders/${orderId}/complaints/`,
    data
  );

  return response.data;
}
