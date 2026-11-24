import { api } from "../lib/api";
import {
  extractResults,
  type ListResponse,
  type PaginatedResponse,
} from "../types/api";

import { adminEndpoints } from "../config/adminEndpoints";

import type {
  AdminDashboard,
  AdminOrder,
  AdminPayment,
  AdminProduct,
  AdminProductUpdate,
  AdminSeller,
  AdminShipment,
  AdminUser,
  AdminUserUpdate,
  Complaint,
  ComplaintStatusUpdate,
  ReturnRequest,
  ReturnStatusUpdate,
} from "../types/admin";

export interface AdminListFilters {
  search?: string;
  role?: string;
  status?: string;
}

export type AdminListQuery = AdminListFilters & { page: number };
export type AdminListPage<T> = PaginatedResponse<T> & { page: number };

async function requestAdminPage<T>(url: string, params: AdminListQuery, signal: AbortSignal): Promise<AdminListPage<T>> {
  const { data } = await api.get<AdminListPage<T>>(url, { params, signal, timeout: 15_000 });
  if (!Array.isArray(data?.results) || !Number.isSafeInteger(data.count) || data.count < 0
      || !Number.isSafeInteger(data.page) || data.page < 1) {
    throw new Error("Respuesta administrativa inválida.");
  }
  return data;
}

export async function getAdminDashboard(): Promise<AdminDashboard> {
  const response = await api.get<AdminDashboard>(
    adminEndpoints.dashboard
  );

  return response.data;
}

/* =========================
   USERS
========================= */

export function getAdminUsers(params: AdminListQuery, signal: AbortSignal): Promise<AdminListPage<AdminUser>> {
  return requestAdminPage(adminEndpoints.users, params, signal);
}

export async function updateAdminUser(
  userId: number,
  data: AdminUserUpdate
): Promise<AdminUser> {
  const response = await api.patch<AdminUser>(
    adminEndpoints.user(userId),
    data
  );

  return response.data;
}

/* =========================
   SELLERS
========================= */

export function getAdminSellers(params: AdminListQuery, signal: AbortSignal): Promise<AdminListPage<AdminSeller>> {
  return requestAdminPage(adminEndpoints.sellers, params, signal);
}

export async function verifyAdminSeller(
  sellerId: number,
  verified: boolean
): Promise<AdminSeller> {
  const response = await api.patch<AdminSeller>(
    adminEndpoints.verifySeller(sellerId),
    {
      is_verified: verified,
    }
  );

  return response.data;
}

/* =========================
   PRODUCTS
========================= */

export function getAdminProducts(params: AdminListQuery, signal: AbortSignal): Promise<AdminListPage<AdminProduct>> {
  return requestAdminPage(adminEndpoints.products, params, signal);
}

export async function updateAdminProduct(
  productId: number,
  data: AdminProductUpdate
): Promise<AdminProduct> {
  const response = await api.patch<AdminProduct>(
    adminEndpoints.product(productId),
    data
  );

  return response.data;
}

/* =========================
   ORDERS
========================= */

export function getAdminOrders(params: AdminListQuery, signal: AbortSignal): Promise<AdminListPage<AdminOrder>> {
  return requestAdminPage(adminEndpoints.orders, params, signal);
}

export async function getAdminOrder(
  orderId: number
): Promise<AdminOrder> {
  const response = await api.get<AdminOrder>(
    adminEndpoints.order(orderId)
  );

  return response.data;
}

/* =========================
   PAYMENTS
========================= */

export function getAdminPayments(params: AdminListQuery, signal: AbortSignal): Promise<AdminListPage<AdminPayment>> {
  return requestAdminPage(adminEndpoints.payments, params, signal);
}

/* =========================
   SHIPMENTS
========================= */

export function getAdminShipments(params: AdminListQuery, signal: AbortSignal): Promise<AdminListPage<AdminShipment>> {
  return requestAdminPage(adminEndpoints.shipments, params, signal);
}

/* =========================
   COMPLAINTS
========================= */

export async function getAdminComplaints(): Promise<Complaint[]> {
  const response = await api.get<ListResponse<Complaint>>(
    adminEndpoints.complaints
  );

  return extractResults(response.data);
}

export async function updateComplaintStatus(
  complaintId: number,
  data: ComplaintStatusUpdate
): Promise<Complaint> {
  const response = await api.patch<Complaint>(
    adminEndpoints.complaintStatus(complaintId),
    data
  );

  return response.data;
}

/* =========================
   RETURNS
========================= */

export async function getAdminReturns(): Promise<ReturnRequest[]> {
  const response = await api.get<ListResponse<ReturnRequest>>(
    adminEndpoints.returns
  );

  return extractResults(response.data);
}

export async function updateReturnStatus(
  returnId: number,
  data: ReturnStatusUpdate
): Promise<ReturnRequest> {
  const response = await api.patch<ReturnRequest>(
    adminEndpoints.returnStatus(returnId),
    data
  );

  return response.data;
}
