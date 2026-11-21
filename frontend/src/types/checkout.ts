import type { DeliveryAddressSnapshot, Order } from "./order";

export type PaymentMethod =
  | "SIMULATED_CARD"
  | "SIMULATED_BANK_TRANSFER"
  | "CASH_ON_DELIVERY"
  | "BUSINESS_ACCOUNT"
  | "SIMULATED_MERCADO_PAGO";

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  SIMULATED_CARD: "Tarjeta simulada",
  SIMULATED_BANK_TRANSFER: "Transferencia simulada",
  CASH_ON_DELIVERY: "Efectivo simulado",
  BUSINESS_ACCOUNT: "Cuenta empresarial simulada",
  SIMULATED_MERCADO_PAGO: "Mercado Pago simulado",
};

export interface CheckoutQuoteRequest {
  address_id: number;
  payment_method: PaymentMethod;
}

export interface CheckoutQuoteItem {
  cart_item_id: number;
  product_id: number;
  product_name: string;
  sku: string;
  seller_id: number;
  seller_name: string;
  quantity: number;
  unit_price: string;
  total_price: string;
}

export interface CheckoutQuote {
  quote_token: string;
  expires_at: string;
  cart_id: number;
  items: CheckoutQuoteItem[];
  subtotal: string;
  discount_total: string;
  shipping_cost: string;
  total: string;
  currency: "ARS";
  shipping_address_snapshot: DeliveryAddressSnapshot;
  price_changed: boolean;
}

export interface CheckoutRequest extends CheckoutQuoteRequest {
  quote_token: string;
  idempotency_key: string;
}

export type CheckoutResponse = Order;

export interface CheckoutApiError {
  code?: string;
  detail?: string;
  quote?: CheckoutQuote | null;
}
