export type ComplaintStatus =
  | "OPEN"
  | "IN_REVIEW"
  | "RESOLVED"
  | "REJECTED"
  | "CLOSED"
  | string;

export interface Complaint {
  id: number;

  order: number;
  order_number?: string;

  order_item?: number | null;
  product_name?: string | null;

  complaint_type: string;

  title: string;
  description: string;

  status: ComplaintStatus;

  admin_note?: string;
  resolution?: string;

  created_at: string;
  updated_at?: string;
  resolved_at?: string | null;
}

export interface CreateComplaintRequest {
  complaint_type: string;

  title: string;
  description: string;

  order_item_id?: number;
}