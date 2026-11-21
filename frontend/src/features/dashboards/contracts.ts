import { z } from "zod";

// Validate the fields displayed by the dashboards. Additional API sections are
// preserved so an incompatible response becomes a load error, never fake zeroes.
const count = z.number().int().nonnegative();
const amount = z.number().finite();
const orderStatus = z.enum(["PENDING", "CONFIRMED", "PAID", "PREPARING", "SHIPPED", "DELIVERED", "CANCELLED", "PROBLEM"]);
const products = z.object({
  total_products: count, published_products: count, low_stock_products: count,
  out_of_stock_products: count,
}).passthrough();
const sales = z.object({
  total_orders: count, total_units_sold: count, total_revenue: amount,
  gross_revenue: amount, refunded_amount: amount, average_order_value: amount,
}).passthrough();
const topProduct = z.object({
  product_id: count.nullable(), product_name: z.string(), sku: z.string(),
  units_sold: count, revenue: amount,
});
const monthlySale = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).nullable(), revenue: amount, orders_count: count,
});
const recentOrder = z.object({
  id: count, order_number: z.string(), status: orderStatus, created_at: z.string().datetime({ offset: true }),
}).passthrough();

export const adminDashboardSchema = z.object({
  users: z.object({ total_users: count }).passthrough(),
  sellers: z.object({ total_sellers: count }).passthrough(),
  products,
  orders: z.object({ total_orders: count }).passthrough(),
  sales,
  stock: z.object({ out_of_stock_count: count }).passthrough(),
  complaints: z.object({ open_complaints: count }).passthrough(),
  returns: z.object({ requested_returns: count }).passthrough(),
  top_products: z.array(topProduct.extend({ seller: z.string().nullable() })),
  top_sellers: z.array(z.object({
    seller_id: count.nullable(), seller: z.string().nullable(), orders_count: count,
    units_sold: count, revenue: amount,
  })),
  recent_orders: z.array(recentOrder.extend({ total: amount })),
  monthly_sales: z.array(monthlySale),
}).passthrough();

export const sellerDashboardSchema = z.object({
  products,
  sales,
  orders: z.object({ total_orders: count }).passthrough(),
  stock: z.object({ out_of_stock_count: count }).passthrough(),
  questions: z.object({ pending_questions: count }).passthrough(),
  top_products: z.array(topProduct),
  recent_orders: z.array(recentOrder.extend({
    order_status: orderStatus, seller_subtotal: z.string().regex(/^-?\d+\.\d{2}$/),
  })),
  monthly_sales: z.array(monthlySale.extend({ units_sold: count })),
}).passthrough();

export type AdminDashboard = z.infer<typeof adminDashboardSchema>;
export type AdminTopProduct = AdminDashboard["top_products"][number];
export type AdminTopSeller = AdminDashboard["top_sellers"][number];
export type AdminMonthlySale = AdminDashboard["monthly_sales"][number];
export type SellerDashboard = z.infer<typeof sellerDashboardSchema>;
export type SellerTopProduct = SellerDashboard["top_products"][number];
export type SellerMonthlySale = SellerDashboard["monthly_sales"][number];
