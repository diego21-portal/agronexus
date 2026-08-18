export interface CartProduct {
  id: number;
  name: string;
  slug: string;
  sku: string;
  stock: number;
  price?: string;
  discount_price?: string | null;
  current_price?: string;
  main_image?: string | null;
}

export interface CartItem {
  id: number;

  product?: CartProduct | number;
  product_id?: number;

  product_name?: string;
  product_slug?: string;
  product_sku?: string;
  available_stock?: number;

  quantity: number;
  unit_price: string;

  subtotal?: string;
  total_price?: string;
  line_total?: string;
}

export interface Cart {
  id: number;
  status: "ACTIVE" | "ORDERED" | "ABANDONED";
  items: CartItem[];
  items_count?: number;
  subtotal: string;
  total?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AddCartItemRequest {
  product_id: number;
  quantity: number;
}

export interface UpdateCartItemRequest {
  quantity: number;
}