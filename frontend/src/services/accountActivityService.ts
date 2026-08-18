import { api } from "../lib/api";
import {
  extractResults,
  type ListResponse,
} from "../types/api";
import type {
  ProductQuestion,
  ProductReview,
} from "../types/productSocial";

const MY_QUESTIONS_ENDPOINT =
  "/users/me/questions/";

const MY_REVIEWS_ENDPOINT =
  "/users/me/reviews/";

export async function getMyQuestions(): Promise<
  ProductQuestion[]
> {
  const response =
    await api.get<ListResponse<ProductQuestion>>(
      MY_QUESTIONS_ENDPOINT
    );

  return extractResults(response.data);
}

export async function getMyReviews(): Promise<
  ProductReview[]
> {
  const response =
    await api.get<ListResponse<ProductReview>>(
      MY_REVIEWS_ENDPOINT
    );

  return extractResults(response.data);
}