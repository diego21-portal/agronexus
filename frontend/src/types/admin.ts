import type { Complaint as PublicComplaint } from "./complaint";
import type { Order, Payment, Shipment } from "./order";
import type { Product } from "./product";
import type { ReturnRequest as PublicReturnRequest, ReturnStatus } from "./return";
import type { User, UserRole } from "./auth";

export type { AdminDashboard, AdminTopProduct, AdminTopSeller, AdminMonthlySale } from "../features/dashboards/contracts";

export interface AdminSellerProfile {
  id: number;
  business_name: string;
  tax_id: string;
  description: string;
  is_active: boolean;
  is_verified: boolean;
}

export interface SellerOnboardingPayload {
  business_name?: string;
  tax_id?: string;
  description?: string;
  is_active?: true;
}

export interface AdminUser extends User {
  is_active?: boolean;
  is_staff?: boolean;
  is_superuser?: boolean;

  date_joined?: string;
  last_login?: string | null;
  seller_profile?: AdminSellerProfile | null;
}

export interface AdminUserUpdate {
  role?: UserRole;

  is_active?: boolean;
  seller_profile?: SellerOnboardingPayload;

}

export interface AdminProductUpdate {
  is_active: boolean;
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
  status: ReturnStatus;

  admin_note?: string;

  resolution?: string;

  approved_refund_amount?: string;
}

export interface Complaint extends PublicComplaint {
  admin_note: string;
  resolved_by_email?: string;
}

export interface ReturnRequest extends PublicReturnRequest {
  admin_note: string;
  resolved_by_email?: string;
}
