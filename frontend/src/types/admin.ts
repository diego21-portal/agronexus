import type { Complaint } from "./complaint";
import type { Order, Payment, Shipment } from "./order";
import type { Product } from "./product";
import type { ReturnRequest } from "./return";
import type { User, UserRole } from "./auth";

export interface AdminDashboardSummary {
  total_users?: number;
  total_customers?: number;

  total_sellers?: number;
  verified_sellers?: number;

  total_products?: number;
  published_products?: number;
  low_stock_products?: number;
  out_of_stock_products?: number;

  total_orders?: number;
  pending_orders?: number;

  total_sales?: string | number;
  total_revenue?: string | number;

  pending_payments?: number;

  active_shipments?: number;

  open_complaints?: number;
  pending_returns?: number;
}

export interface AdminMonthlySale {
  month: string;
  orders?: number;
  revenue?: string | number;
  total?: string | number;
}

export interface AdminTopProduct {
  id: number;
  name: string;
  slug?: string;

  quantity_sold?: number;
  units_sold?: number;

  revenue?: string | number;
}

export interface AdminTopSeller {
  id: number;

  business_name: string;

  total_sales?: number;

  revenue?: string | number;

  rating_average?: string | number;

  is_verified?: boolean;
}

export interface AdminDashboard {
  summary?: AdminDashboardSummary;

  total_users?: number;
  total_sellers?: number;
  total_products?: number;
  total_orders?: number;

  total_revenue?: string | number;
  total_sales?: string | number;

  low_stock_products?: number;
  out_of_stock_products?: number;

  open_complaints?: number;
  pending_returns?: number;

  recent_orders?: Order[];

  top_products?: AdminTopProduct[];

  top_sellers?: AdminTopSeller[];

  monthly_sales?: AdminMonthlySale[];
}

export interface AdminUser extends User {
  is_active?: boolean;
  is_staff?: boolean;
  is_superuser?: boolean;

  date_joined?: string;
  last_login?: string | null;
}

export interface AdminUserUpdate {
  role?: UserRole;

  is_active?: boolean;

  is_staff?: boolean;
}

export interface AdminSeller {
  id: number;

  user?: AdminUser;

  business_name: string;

  tax_id?: string;

  description?: string;

  rating_average?: string | number;

  total_sales?: number;

  is_verified: boolean;

  is_active: boolean;
}

export interface AdminProduct extends Product {
  seller_name?: string;

  seller_id?: number;
}

export type AdminOrder = Order;

export interface AdminPayment extends Payment {
  order?: number;
  order_number?: string;
}

export interface AdminShipment extends Shipment {
  order?: number;
  order_number?: string;
}

export interface ComplaintStatusUpdate {
  status: string;

  admin_note?: string;

  resolution?: string;
}

export interface ReturnStatusUpdate {
  status: string;

  admin_note?: string;

  resolution?: string;

  approved_refund_amount?: string;
}

export type {
  Complaint,
  ReturnRequest,
};