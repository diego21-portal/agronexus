export interface ProductImage {
  id: number;
  image: string;
  alt_text?: string;
  is_main?: boolean;
  created_at?: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string;
  is_active?: boolean;
}

export interface Brand {
  id: number;
  name: string;
  slug: string;
  description?: string;
  is_active?: boolean;
}

export interface Region {
  id: number;
  name: string;
  slug?: string;
  province?: string;
  country?: string;
  is_active?: boolean;
}

export interface SellerSummary {
  id: number;
  business_name: string;
  rating_average?: string;
  is_verified?: boolean;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  sku: string;

  short_description: string;
  description: string;
  technical_description?: string;

  price: string;
  discount_price?: string | null;
  current_price?: string;

  unit: string;
  stock: number;
  minimum_stock: number;

  condition: string;
  status: string;
  warranty?: string;

  shipping_available: boolean;

  average_rating: string;
  total_reviews: number;

  is_active?: boolean;
  is_featured: boolean;

  category?: Category;
  category_name?: string;

  brand?: Brand | null;
  brand_name?: string | null;

  region?: Region;
  region_name?: string;

  seller?: SellerSummary;
  seller_name?: string;

  images?: ProductImage[];

  created_at: string;
  updated_at: string;
}

export interface ProductFilters {
  search?: string;
  category?: string;
  brand?: string;
  region?: string;
  min_price?: string;
  max_price?: string;
  in_stock?: boolean;
  ordering?: string;
}

export interface CatalogProduct {
  id: number;
  name: string;
  slug: string;
  sku: string;

  seller: string;
  brand?: string | null;
  category: string;
  region: string;

  price: string;
  discount_price: string | null;
  current_price: string;
  
  stock: number;
  condition: string;
  status: string;
  shipping_available: boolean;

  average_rating: string;
  total_reviews: number;
  is_featured: boolean;

  main_image: string | null;
}

export interface CatalogProductDetail extends Omit<CatalogProduct, "main_image"> {
  short_description: string;
  description: string;
  technical_description: string;

  unit: string;
  minimum_stock: number;
  warranty: string;
  images: ProductImage[];

  created_at: string;
  updated_at: string;
}