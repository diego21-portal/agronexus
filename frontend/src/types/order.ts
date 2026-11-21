import type { Address } from "./address";
import type { CancellationRequest } from "./cancellation";

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PAID"
  | "PREPARING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "PROBLEM";

export type ShipmentStatus =
  | "CREATED"
  | "PREPARING"
  | "DISPATCHED"
  | "IN_TRANSIT"
  | "IN_DISTRIBUTION_CENTER"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "DELIVERY_PROBLEM"
  | "CANCELLED";

export interface OrderItem {
  id: number;

  product?: number | null;

  product_name: string;
  product_slug?: string | null;
  sku: string;

  quantity: number;

  unit_price: string;
  total_price: string;

  seller?: number;
  seller_name?: string;

  reviewed?: boolean;

  is_delivered: boolean;
  delivery_status: ShipmentStatus | null;
  can_request_return?: boolean;
}

export interface Payment {
  id: number;

  payment_method: string;
  status: string;

  amount: string;

  transaction_code?: string;
  paid_at?: string | null;

  created_at?: string;
  refunded_amount?: string;
  refundable_amount?: string;
  refund_review_required?: boolean;
  refunds?: Refund[];
}

export interface Refund {
  id: number;
  kind: "PRODUCT" | "SHIPPING";
  order_item: number | null;
  amount: string;
  created_at: string;
}

export interface ShipmentEvent {
  id: number;

  status: ShipmentStatus;
  description: string;

  location?: string;

  created_at: string;
}

export interface Shipment {
  id: number;

  seller: number | null;
  seller_name: string | null;

  tracking_code?: string;

  carrier?: string;

  status: ShipmentStatus;

  estimated_delivery_date?: string | null;
  delivered_at?: string | null;

  events?: ShipmentEvent[];
  seller_subtotal?: string;
  can_request_cancellation?: boolean;
  cancellation_pending?: boolean;
  cancellation?: CancellationRequest | null;
}

export interface DeliveryAddressSnapshot {
  region_id: number;
  region_name: string;
  street: string;
  number: string;
  city: string;
  province: string;
  postal_code: string;
  reference: string;
}

export type DeliveryAddressSnapshotSource = "CHECKOUT" | "LEGACY_UNKNOWN";

export interface Order {
  id: number;

  order_number: string;

  status: OrderStatus;

  subtotal: string;
  discount_total: string;
  shipping_cost: string;
  total: string;

  shipping_address?: Address | number | null;
  shipping_address_detail?: Address;
  shipping_address_snapshot?: DeliveryAddressSnapshot | null;
  shipping_address_snapshot_source?: DeliveryAddressSnapshotSource;

  items?: OrderItem[];

  payment?: Payment | null;

  shipment?: Shipment | null;
  shipments: Shipment[];

  created_at: string;
  updated_at?: string;
  has_cancellations?: boolean;
  refunded_amount?: string;
  net_total?: string;
}

export interface OrderTrackingResponse {
  order_id: number;
  order_number: string;
  order_status: OrderStatus;

  shipment: Shipment | null;
  shipments: Shipment[];
}
