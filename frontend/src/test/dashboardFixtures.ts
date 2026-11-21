// Dictionaries use the nested fields emitted by Django dashboard views.
export function adminDashboardData() {
  return {
    users: { total_users: 17 }, sellers: { total_sellers: 5 },
    products: { total_products: 23, published_products: 19, low_stock_products: 3, out_of_stock_products: 2 },
    orders: { total_orders: 11 },
    sales: { total_orders: 7, total_units_sold: 13, total_revenue: 54321.99, gross_revenue: 60000, refunded_amount: 5678.01, average_order_value: 7760.28 },
    stock: { out_of_stock_count: 4 }, complaints: { open_complaints: 6 }, returns: { requested_returns: 2 },
    top_products: [{ product_id: 9, product_name: "Filtro real del catálogo", sku: "F-9", seller: "Agro del Sur", units_sold: 8, revenue: 32100 }],
    top_sellers: [{ seller_id: 5, seller: "Agro del Sur", orders_count: 4, units_sold: 8, revenue: 32100 }],
    recent_orders: [{ id: 2, order_number: "AGX-ADMIN", status: "PAID", total: 60000, created_at: "2026-11-01T12:00:00Z" }],
    monthly_sales: [{ month: "2026-11", orders_count: 7, revenue: 54321.99 }],
  };
}

export function sellerDashboardData() {
  return {
    products: { total_products: 13, published_products: 9, low_stock_products: 2, out_of_stock_products: 4 },
    orders: { total_orders: 5 },
    sales: { total_orders: 4, total_units_sold: 8, total_revenue: 72000, gross_revenue: 85000, refunded_amount: 13000, average_order_value: 18000 },
    stock: { out_of_stock_count: 1 }, questions: { pending_questions: 3 },
    top_products: [{ product_id: 9, product_name: "Filtro vendido propio", sku: "F-9", units_sold: 8, revenue: 72000 }],
    recent_orders: [{ id: 1, order_number: "AGX-PARCIAL", status: "DELIVERED", order_status: "PREPARING", seller_subtotal: "85000.00", created_at: "2026-11-01T12:00:00Z" }],
    monthly_sales: [{ month: "2026-11", orders_count: 4, units_sold: 8, revenue: 72000 }],
  };
}
