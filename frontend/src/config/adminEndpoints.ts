export const adminEndpoints = {
  dashboard: "/admin/dashboard/",

  users: "/admin/users/",

  user: (userId: number) =>
    `/admin/users/${userId}/`,

  sellers: "/admin/sellers/",

  seller: (sellerId: number) =>
    `/admin/sellers/${sellerId}/`,

  verifySeller: (sellerId: number) =>
    `/admin/sellers/${sellerId}/verify/`,

  products: "/admin/products/",

  product: (productId: number) =>
    `/admin/products/${productId}/`,

  orders: "/admin/orders/",

  order: (orderId: number) =>
    `/admin/orders/${orderId}/`,

  payments: "/admin/payments/",

  shipments: "/admin/shipments/",

  complaints: "/admin/complaints/",

  complaintStatus: (complaintId: number) =>
    `/admin/complaints/${complaintId}/status/`,

  returns: "/admin/returns/",

  returnStatus: (returnId: number) =>
    `/admin/returns/${returnId}/status/`,
};