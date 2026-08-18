import { api } from "../lib/api";
import {
  extractResults,
  type ListResponse,
} from "../types/api";
import type {
  Complaint,
  CreateComplaintRequest,
} from "../types/complaint";

export async function getMyComplaints(): Promise<Complaint[]> {
  const response =
    await api.get<ListResponse<Complaint>>(
      "/users/me/complaints/"
    );

  return extractResults(response.data);
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