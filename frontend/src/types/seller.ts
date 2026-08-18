import type { Order } from "./order";
import type { Product } from "./product";
import type { ProductQuestion } from "./productSocial";
import type { Complaint } from "./complaint";
import type { ReturnRequest } from "./return";

export interface SellerSummary {
  total_products?: number;
  published_products?: number;
  draft_products?: number;
  out_of_stock_products?: number;
  low_stock_products?: number;

  total_orders?: number;
  pending_orders?: number;

  total_sales?: string | number;
  total_revenue?: string | number;

  pending_questions?: number;
  total_reviews?: number;

  open_complaints?: number;
  pending_returns?: number;
}

export interface SellerMonthlySale {
  month: string;
  orders?: number;
  total?: string | number;
  revenue?: string | number;
}

export interface SellerTopProduct {
  id: number;
  name: string;
  slug?: string;
  quantity_sold?: number;
  units_sold?: number;
  revenue?: string | number;
  total_sales?: string | number;
}

export interface SellerDashboard {
  summary?: SellerSummary;

  total_products?: number;
  published_products?: number;
  low_stock_products?: number;
  out_of_stock_products?: number;

  total_orders?: number;
  total_sales?: string | number;
  total_revenue?: string | number;

  pending_questions?: number;

  recent_orders?: Order[];
  top_products?: SellerTopProduct[];
  monthly_sales?: SellerMonthlySale[];

  complaints?: Complaint[];
  returns?: ReturnRequest[];
}

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
  movement_type: string;
  quantity: number;
  reason: string;
}

export interface ShipmentStatusPayload {
  status: string;
  description?: string;
  location?: string;
}

export interface SellerQuestion extends ProductQuestion {
  product?: number;
  product_name?: string;
  product_slug?: string;
}

export interface SellerProduct extends Product {
  sales_count?: number;
}