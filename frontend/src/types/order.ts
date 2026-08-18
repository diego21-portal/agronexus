import type { Address } from "./address";

export type OrderStatus =
  | "PENDING"
  | "PAID"
  | "PREPARING"
  | "SHIPPED"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "CANCELLED"
  | string;

export interface OrderItem {
  id: number;

  product?: number | null;

  product_name: string;
  product_slug?: string;
  sku: string;

  quantity: number;

  unit_price: string;
  total_price: string;

  seller?: number;
  seller_name?: string;

  reviewed?: boolean;
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

  status: string;
  description: string;

  location?: string;

  created_at: string;
}

export interface Shipment {
  id: number;

  tracking_code?: string;

  carrier?: string;

  status: string;

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

  created_at: string;
  updated_at?: string;
}

export interface OrderTrackingResponse {
  order_id?: number;
  order_number?: string;
  order_status?: string;

  shipment: Shipment;
}