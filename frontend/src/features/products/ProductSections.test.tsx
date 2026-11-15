import { act, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { AuthContext } from "../auth/AuthContext";
import { ProductQuestionsSection } from "./ProductQuestionsSection";
import { ProductReviewsSection } from "./ProductReviewsSection";
import { getProductQuestions, getProductReviews } from "../../services/productSocialService";
import { authValue, deferred } from "../../test/asyncFixtures";
import type { ProductQuestion, ProductReview } from "../../types/productSocial";

vi.mock("../../services/productSocialService", () => ({
  getProductQuestions: vi.fn(), getProductReviews: vi.fn(),
  createProductQuestion: vi.fn(), createProductReview: vi.fn(),
}));
beforeEach(() => vi.resetAllMocks());
const question: ProductQuestion = {
  id: 1, user_name: "Comprador", question: "¿Tiene garantía?", answer: "Sí.",
  status: "ANSWERED", is_public: true, created_at: "2026-11-01T12:00:00Z",
};
const review: ProductReview = {
  id: 1, user_name: "Comprador", comment: "Buen producto", rating: 5,
  is_public: true, created_at: "2026-11-01T12:00:00Z",
};

test("las preguntas del producto anterior no reemplazan las del producto actual", async () => {
  const old = deferred<ProductQuestion[]>();
  vi.mocked(getProductQuestions).mockReturnValueOnce(old.promise).mockResolvedValueOnce([{ ...question, id: 2, question: "¿Hacen envíos?" }]);
  const view = (slug: string) => <AuthContext.Provider value={authValue(null)}><ProductQuestionsSection slug={slug} /></AuthContext.Provider>;
  const { rerender } = render(view("filtro"));
  rerender(view("bomba"));
  expect(await screen.findByText("¿Hacen envíos?")).toBeInTheDocument();
  await act(async () => { old.resolve([question]); });
  expect(screen.queryByText("¿Tiene garantía?")).not.toBeInTheDocument();
  expect(screen.getByText("¿Hacen envíos?")).toBeInTheDocument();
});

test("las reseñas tardías de otro producto se descartan", async () => {
  const old = deferred<ProductReview[]>();
  vi.mocked(getProductReviews).mockReturnValueOnce(old.promise).mockResolvedValueOnce([{ ...review, id: 2, comment: "Compra nueva" }]);
  const view = (slug: string) => <AuthContext.Provider value={authValue(null)}><ProductReviewsSection slug={slug} /></AuthContext.Provider>;
  const { rerender } = render(view("filtro"));
  rerender(view("bomba"));
  expect(await screen.findByText("Compra nueva")).toBeInTheDocument();
  await act(async () => { old.resolve([review]); });
  expect(screen.queryByText("Buen producto")).not.toBeInTheDocument();
  expect(screen.getByText("Compra nueva")).toBeInTheDocument();
});
