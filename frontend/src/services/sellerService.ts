import { api } from "../lib/api";
import {
  extractResults,
  type ListResponse,
} from "../types/api";

import type { Complaint } from "../types/complaint";
import type { Order } from "../types/order";
import type { ReturnRequest } from "../types/return";

import type {
  SellerDashboard,
  SellerProduct,
  SellerProductPayload,
  SellerQuestion,
  ShipmentStatusPayload,
  StockAdjustmentPayload,
} from "../types/seller";

import { sellerEndpoints } from "../config/sellerEndpoints";

export async function getSellerDashboard(): Promise<SellerDashboard> {
  const response = await api.get<SellerDashboard>(
    sellerEndpoints.dashboard
  );

  return response.data;
}

export async function getSellerProducts(): Promise<SellerProduct[]> {
  const response = await api.get<ListResponse<SellerProduct>>(
    sellerEndpoints.products
  );

  return extractResults(response.data);
}

export async function getSellerProduct(
  productId: number
): Promise<SellerProduct> {
  const response = await api.get<SellerProduct>(
    sellerEndpoints.product(productId)
  );

  return response.data;
}

export async function createSellerProduct(
  data: SellerProductPayload
): Promise<SellerProduct> {
  const response = await api.post<SellerProduct>(
    sellerEndpoints.products,
    data
  );

  return response.data;
}

export async function updateSellerProduct(
  productId: number,
  data: Partial<SellerProductPayload>
): Promise<SellerProduct> {
  const response = await api.patch<SellerProduct>(
    sellerEndpoints.product(productId),
    data
  );

  return response.data;
}

export async function deleteSellerProduct(
  productId: number
): Promise<void> {
  await api.delete(
    sellerEndpoints.product(productId)
  );
}

export async function adjustSellerStock(
  productId: number,
  data: StockAdjustmentPayload
): Promise<void> {
  await api.post(
    sellerEndpoints.stock(productId),
    data
  );
}

export async function getSellerOrders(): Promise<Order[]> {
  const response = await api.get<ListResponse<Order>>(
    sellerEndpoints.orders
  );

  return extractResults(response.data);
}

export async function getSellerOrder(
  orderId: number
): Promise<Order> {
  const response = await api.get<Order>(
    sellerEndpoints.order(orderId)
  );

  return response.data;
}

export async function updateShipmentStatus(
  shipmentId: number,
  data: ShipmentStatusPayload
): Promise<void> {
  await api.patch(
    sellerEndpoints.shipmentStatus(shipmentId),
    data
  );
}

export async function getSellerQuestions(): Promise<SellerQuestion[]> {
  const response = await api.get<ListResponse<SellerQuestion>>(
    sellerEndpoints.questions
  );

  return extractResults(response.data);
}

export async function answerSellerQuestion(
  questionId: number,
  answer: string
): Promise<SellerQuestion> {
  const response = await api.patch<SellerQuestion>(
    sellerEndpoints.answerQuestion(questionId),
    {
      answer,
    }
  );

  return response.data;
}

export async function getSellerComplaints(): Promise<Complaint[]> {
  const response = await api.get<ListResponse<Complaint>>(
    sellerEndpoints.complaints
  );

  return extractResults(response.data);
}

export async function getSellerReturns(): Promise<ReturnRequest[]> {
  const response = await api.get<ListResponse<ReturnRequest>>(
    sellerEndpoints.returns
  );

  return extractResults(response.data);
}