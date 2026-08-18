import type { Order, Payment, Shipment } from "./order";

export type PaymentMethod =
  | "SIMULATED_CARD"
  | "BANK_TRANSFER"
  | "CASH_ON_DELIVERY"
  | "CURRENT_ACCOUNT"
  | "MERCADO_PAGO_SIMULATED";

export interface CheckoutRequest {
  shipping_address_id: number;
  payment_method: PaymentMethod;
}

export interface CheckoutResponse {
  message?: string;
  order: Order;
  payment?: Payment;
  shipment?: Shipment;
}