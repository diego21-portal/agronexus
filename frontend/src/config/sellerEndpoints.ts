export const sellerEndpoints = {
  dashboard: "/seller/dashboard/",

  products: "/seller/products/",

  product: (productId: number) =>
    `/seller/products/${productId}/`,

  stock: (productId: number) =>
    `/seller/products/${productId}/stock/`,

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