import type { Address } from "./address";

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
}

export interface Payment {
  id: number;

  payment_method: string;
  status: string;

  amount: string;

  transaction_code?: string;
  paid_at?: string | null;

  created_at?: string;
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
}

export interface Order {
  id: number;

  order_number: string;

  status: OrderStatus;

  subtotal: string;
  discount_total: string;
  shipping_cost: string;
  total: string;

  shipping_address?: Address;
  shipping_address_detail?: Address;

  items?: OrderItem[];

  payment?: Payment | null;

  shipment?: Shipment | null;
  shipments: Shipment[];

  created_at: string;
  updated_at?: string;
}

export interface OrderTrackingResponse {
  order_id: number;
  order_number: string;
  order_status: OrderStatus;

  shipment: Shipment | null;
  shipments: Shipment[];
}
