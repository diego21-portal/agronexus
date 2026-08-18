export interface ProductQuestion {
  id: number;
  product?: number;
  product_name?: string;
  product_slug?: string;
  user_name: string;
  question: string;
  answer: string;
  answered_by_name?: string | null;
  answered_at?: string | null;
  status: "PENDING" | "ANSWERED" | "HIDDEN";
  is_public: boolean;
  created_at: string;
  updated_at?: string;
}

export interface CreateQuestionRequest {
  question: string;
}

export interface ProductReview {
  id: number;
  product?: number;
  product_name?: string;
  user_name: string;
  rating: number;
  comment: string;
  is_public: boolean;
  created_at: string;
  updated_at?: string;
}

export interface CreateReviewRequest {
  order_item_id: number;
  rating: number;
  comment: string;
}

export interface FavoriteStatus {
  product_id: number;
  product_slug: string;
  is_favorite: boolean;
  favorite_id: number | null;
}