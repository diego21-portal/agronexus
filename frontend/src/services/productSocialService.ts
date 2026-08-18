import { api } from "../lib/api";
import type { ListResponse } from "../types/api";
import { extractResults } from "../types/api";
import type {
  CreateQuestionRequest,
  CreateReviewRequest,
  ProductQuestion,
  ProductReview,
} from "../types/productSocial";

export async function getProductQuestions(
  slug: string
): Promise<ProductQuestion[]> {
  const response = await api.get<ListResponse<ProductQuestion>>(
    `/products/${slug}/questions/`
  );

  return extractResults(response.data);
}

export async function createProductQuestion(
  slug: string,
  data: CreateQuestionRequest
): Promise<ProductQuestion> {
  const response = await api.post<ProductQuestion>(
    `/products/${slug}/questions/`,
    data
  );

  return response.data;
}

export async function getProductReviews(
  slug: string
): Promise<ProductReview[]> {
  const response = await api.get<ListResponse<ProductReview>>(
    `/products/${slug}/reviews/`
  );

  return extractResults(response.data);
}

export async function createProductReview(
  slug: string,
  data: CreateReviewRequest
): Promise<ProductReview> {
  const response = await api.post<ProductReview>(
    `/products/${slug}/reviews/`,
    data
  );

  return response.data;
}