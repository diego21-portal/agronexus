import { api } from "../lib/api";
import {
  extractResults,
  type ListResponse,
} from "../types/api";

import { adminEndpoints } from "../config/adminEndpoints";

import type {
  AdminDashboard,
  AdminOrder,
  AdminPayment,
  AdminProduct,
  AdminSeller,
  AdminShipment,
  AdminUser,
  AdminUserUpdate,
  Complaint,
  ComplaintStatusUpdate,
  ReturnRequest,
  ReturnStatusUpdate,
} from "../types/admin";

export async function getAdminDashboard(): Promise<AdminDashboard> {
  const response = await api.get<AdminDashboard>(
    adminEndpoints.dashboard
  );

  return response.data;
}

/* =========================
   USERS
========================= */

export async function getAdminUsers(): Promise<AdminUser[]> {
  const response = await api.get<ListResponse<AdminUser>>(
    adminEndpoints.users
  );

  return extractResults(response.data);
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

export async function getAdminSellers(): Promise<AdminSeller[]> {
  const response = await api.get<ListResponse<AdminSeller>>(
    adminEndpoints.sellers
  );

  return extractResults(response.data);
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

export async function getAdminProducts(): Promise<AdminProduct[]> {
  const response = await api.get<ListResponse<AdminProduct>>(
    adminEndpoints.products
  );

  return extractResults(response.data);
}

export async function updateAdminProduct(
  productId: number,
  data: Partial<AdminProduct>
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

export async function getAdminOrders(): Promise<AdminOrder[]> {
  const response = await api.get<ListResponse<AdminOrder>>(
    adminEndpoints.orders
  );

  return extractResults(response.data);
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

export async function getAdminPayments(): Promise<AdminPayment[]> {
  const response = await api.get<ListResponse<AdminPayment>>(
    adminEndpoints.payments
  );

  return extractResults(response.data);
}

/* =========================
   SHIPMENTS
========================= */

export async function getAdminShipments(): Promise<AdminShipment[]> {
  const response = await api.get<ListResponse<AdminShipment>>(
    adminEndpoints.shipments
  );

  return extractResults(response.data);
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