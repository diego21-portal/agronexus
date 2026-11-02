export const sellerEndpoints = {
  dashboard: "/seller/dashboard/",

  products: "/seller/products/",

  product: (productId: number) =>
    `/seller/products/${productId}/`,

  stockMovements: "/seller/stock/movements/",

  orders: "/seller/orders/",

  order: (orderId: number) =>
    `/seller/orders/${orderId}/`,

  questions: "/seller/questions/",

  answerQuestion: (questionId: number) =>
    `/seller/questions/${questionId}/answer/`,

  complaints: "/seller/complaints/",

  returns: "/seller/returns/",

  shipmentStatus: (shipmentId: number) =>
    `/seller/shipments/${shipmentId}/status/`,
};