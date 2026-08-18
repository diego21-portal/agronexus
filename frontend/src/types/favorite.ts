import type { Product } from "./product";

export interface Favorite {
  id: number;

  product: Product;

  created_at?: string;
}