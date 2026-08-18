export type ReturnStatus =
  | "REQUESTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "RECEIVED"
  | "REFUNDED"
  | "CLOSED"
  | string;

export interface ReturnRequest {
  id: number;

  order_item: number;

  order_number?: string;
  product_name?: string;

  reason: string;
  description: string;

  quantity: number;

  requested_refund_amount?: string;
  approved_refund_amount?: string | null;

  status: ReturnStatus;

  admin_note?: string;
  resolution?: string;

  created_at: string;
  updated_at?: string;
  resolved_at?: string | null;
}

export interface CreateReturnRequest {
  reason: string;
  description: string;
  quantity: number;
}