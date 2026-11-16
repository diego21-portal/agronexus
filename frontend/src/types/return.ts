export type ReturnStatus =
  | "REQUESTED"
  | "IN_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "PRODUCT_RECEIVED"
  | "INSPECTED"
  | "REFUNDED"
  | "CLOSED";

export type ReturnReason =
  | "DEFECTIVE_PRODUCT"
  | "WRONG_PRODUCT"
  | "DAMAGED_SHIPPING"
  | "NOT_AS_DESCRIBED"
  | "CUSTOMER_REGRET"
  | "OTHER";

export const returnStatusLabels: Record<ReturnStatus, string> = {
  REQUESTED: "Solicitada",
  IN_REVIEW: "En revisión",
  APPROVED: "Aprobada para devolución",
  REJECTED: "Rechazada",
  PRODUCT_RECEIVED: "Producto recibido",
  INSPECTED: "Inspección completa",
  REFUNDED: "Reembolsada",
  CLOSED: "Cerrada",
};

export const returnReasonLabels: Record<ReturnReason, string> = {
  DEFECTIVE_PRODUCT: "Producto defectuoso",
  WRONG_PRODUCT: "Producto incorrecto",
  DAMAGED_SHIPPING: "Producto dañado durante el envío",
  NOT_AS_DESCRIBED: "No coincide con la descripción",
  CUSTOMER_REGRET: "Arrepentimiento de compra",
  OTHER: "Otro motivo",
};

export interface ReturnInspection {
  id: number;
  order_item?: number;
  product_name?: string;
  expected_quantity: number;
  received_quantity: number;
  restocked_quantity: number;
  defective_quantity: number;
  quarantined_quantity: number;
  received_at: string | null;
  inspected_at: string | null;
}

export interface ReturnRequest {
  id: number;
  order_item_id: number;
  order_number?: string;
  product_name?: string;
  reason: ReturnReason;
  description: string;
  quantity: number;
  requested_refund_amount?: string;
  approved_refund_amount?: string | null;
  status: ReturnStatus;
  resolution?: string;
  inspection?: ReturnInspection | null;
  can_receive?: boolean;
  can_inspect?: boolean;
  allowed_statuses?: ReturnStatus[];
  created_at: string;
  updated_at?: string;
  resolved_at?: string | null;
}

export interface CreateReturnRequest {
  reason: ReturnReason;
  description: string;
  quantity: number;
}

export interface ReceiveReturnPayload {
  received_quantity: number;
  note?: string;
}

export interface InspectReturnPayload {
  restocked_quantity: number;
  defective_quantity: number;
  note?: string;
}
