export interface Favorite {
  id: number;
  product_id: number;
  product_name: string;
  product_slug: string;
  product_sku: string;

  product_price: string;
  product_discount_price: string | null;
  product_current_price: string;

  product_stock: number;
  product_status: string;

  product_average_rating: string;
  product_total_reviews: number;

  main_image: string | null;
  created_at: string;
}