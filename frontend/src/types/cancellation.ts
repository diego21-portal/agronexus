import type { ReturnInspection } from "./return";

export type CancellationStatus =
  | "REQUESTED"
  | "RETURNING"
  | "RECEIVED"
  | "INSPECTED"
  | "COMPLETED"
  | "REJECTED"
  | "WITHDRAWN";

export interface CancellationRequest {
  id: number;
  shipment: number;
  order_id: number;
  order_number: string;
  seller: number;
  seller_name: string;
  status: CancellationStatus;
  reason: string;
  resolution: string;
  is_pre_dispatch: boolean;
  inspections: Array<ReturnInspection & { order_item: number; product_name: string }>;
  events?: Array<{ id: number; status: CancellationStatus; action: string; description: string; created_at: string }>;
  refunded_amount: string;
  shipping_refundable_amount?: string;
  created_at: string;
  updated_at: string;
}

export type CancellationRole = "customer" | "seller" | "admin";
export type CancellationAction = "start_return" | "receive" | "inspect" | "complete" | "reject" | "refund_shipping";

export interface CancellationActionPayload {
  action: CancellationAction;
  resolution?: string;
  amount?: string;
  operation_key?: string;
  items?: Array<{
    order_item: number;
    received_quantity?: number;
    restocked_quantity?: number;
    defective_quantity?: number;
  }>;
}

export const cancellationLabels: Record<CancellationStatus, string> = {
  REQUESTED: "Cancelación solicitada",
  RETURNING: "Retorno en camino",
  RECEIVED: "Productos recibidos",
  INSPECTED: "Inspección completada",
  COMPLETED: "Cancelación completada",
  REJECTED: "Solicitud rechazada",
  WITHDRAWN: "Solicitud retirada",
};
