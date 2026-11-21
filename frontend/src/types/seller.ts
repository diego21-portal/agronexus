import type { OrderItem, OrderStatus, Shipment, ShipmentStatus } from "./order";
import type { Product, ProductImage } from "./product";
import type { ProductQuestion } from "./productSocial";

export type { SellerDashboard, SellerTopProduct, SellerMonthlySale } from "../features/dashboards/contracts";

export interface SellerProductPayload {
  category: number;
  brand: number | null;
  region: number;

  name: string;
  sku: string;

  short_description: string;
  description: string;
  technical_description: string;

  price: string;
  discount_price: string | null;

  unit: string;

  stock: number;
  minimum_stock: number;

  condition: string;
  status: string;

  warranty: string;

  shipping_available: boolean;
  is_active: boolean;
  is_featured: boolean;
}

export interface StockAdjustmentPayload {
  movement_type: "RESTOCK" | "MANUAL_ADJUSTMENT";
  quantity: number;
  reason: string;
}

export interface ShipmentStatusPayload {
  status: ShipmentStatus;
  description?: string;
  location?: string;
}

export interface SellerOrder {
  id: number;
  order_number: string;
  customer_email: string;
  status: OrderStatus;
  order_status: OrderStatus;
  seller_subtotal: string;
  payment_status: string | null;
  shipment: Shipment | null;
  tracking_code: string | null;
  shipment_status: ShipmentStatus | null;
  items: OrderItem[];
  created_at: string;
  updated_at?: string;
}

export type SellerRecentOrder = Pick<SellerOrder,
  "id" | "order_number" | "status" | "order_status" | "seller_subtotal" | "created_at"
>;

export interface SellerQuestion extends ProductQuestion {
  product?: number;
  product_name?: string;
  product_slug?: string;
}

// The seller API exposes foreign keys as IDs; the public detail uses objects.
export interface SellerProduct extends Omit<Product, "seller" | "category" | "brand" | "region"> {
  seller: string;
  category: number;
  brand: number | null;
  region: number;
  images: ProductImage[];
  technical_sheet: string | null;
  sales_count?: number;
}
