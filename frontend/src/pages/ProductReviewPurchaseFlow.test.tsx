import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, expect, test, vi } from "vitest";
import { AuthContext } from "../features/auth/AuthContext";
import { getFavoriteStatus } from "../services/favoriteService";
import { getProductBySlug } from "../services/productService";
import { createProductReview, getProductReviews } from "../services/productSocialService";
import { authValue, deferred } from "../test/asyncFixtures";
import type { CatalogProductDetail } from "../types/product";
import type { ProductReview } from "../types/productSocial";
import { ProductDetailPage } from "./ProductDetailPage";

vi.mock("../services/productService", () => ({ getProductBySlug: vi.fn() }));
vi.mock("../services/favoriteService", () => ({
  getFavoriteStatus: vi.fn(), addFavorite: vi.fn(), removeFavorite: vi.fn(),
}));
vi.mock("../services/productSocialService", () => ({
  getProductReviews: vi.fn(), createProductReview: vi.fn(),
}));
vi.mock("../features/cart/CartContext", () => ({ useCart: () => ({ addItem: vi.fn() }) }));
vi.mock("../features/products/ProductQuestionsSection", () => ({ ProductQuestionsSection: () => null }));

function product(slug: string): CatalogProductDetail {
  return {
    id: slug === "filtro" ? 1 : 2, name: slug === "filtro" ? "Filtro" : "Bomba", slug, sku: slug,
    seller: "Vendedor de prueba", category: "Repuestos", brand: "Marca de prueba", region: "Mendoza",
    price: "100.00", discount_price: null, current_price: "100.00", stock: 3,
    condition: "NEW", status: "PUBLISHED", shipping_available: true,
    average_rating: "0.00", total_reviews: 0, is_featured: false,
    short_description: "Descripción breve", description: "Descripción del producto",
    technical_description: "", unit: "UNIT", minimum_stock: 1, warranty: "", images: [],
    created_at: "2026-11-01T12:00:00Z", updated_at: "2026-11-01T12:00:00Z",
  };
}
const review: ProductReview = {
  id: 1, product: 1, user_name: "Comprador", rating: 4, comment: "Filtro de buena calidad.",
  is_public: true, created_at: "2026-11-01T12:00:00Z",
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getProductBySlug).mockImplementation(async (slug) => product(slug));
  vi.mocked(getFavoriteStatus).mockResolvedValue({ product_id: 1, product_slug: "filtro", is_favorite: false, favorite_id: null });
  vi.mocked(getProductReviews).mockResolvedValue([]);
  vi.mocked(createProductReview).mockResolvedValue(review);
});

function mount(path = "/products/filtro?order_item=101#reviews") {
  const router = createMemoryRouter(
    [{ path: "/products/:slug", element: <ProductDetailPage /> }],
    { initialEntries: [path] },
  );
  render(<AuthContext.Provider value={authValue()}><RouterProvider router={router} /></AuthContext.Provider>);
  return router;
}

test("Calificar usa la compra vinculada al producto sin pedir identificadores técnicos", async () => {
  mount();
  const user = userEvent.setup();
  const comment = await screen.findByLabelText("Comentario");
  expect(screen.getByText("Vas a calificar Filtro de la compra seleccionada desde Mis pedidos.")).toBeVisible();
  expect(screen.queryByText("ID del ítem comprado")).not.toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText("Calificación"), "4");
  await user.type(comment, "Filtro de buena calidad.");
  await user.click(screen.getByRole("button", { name: "Publicar reseña" }));

  expect(createProductReview).toHaveBeenCalledWith("filtro", {
    order_item_id: 101, rating: 4, comment: "Filtro de buena calidad.",
  });
  expect(await screen.findByText("Reseña publicada correctamente.")).toBeVisible();
});

test.each(["", "?order_item=0", "?order_item=-1", "?order_item=1.5", "?order_item=abc"])(
  "sin una compra válida (%s) permite elegirla desde Mis pedidos", async (query) => {
    mount("/products/filtro" + query);
    expect(await screen.findByRole("link", { name: "Elegir compra para reseñar" })).toHaveAttribute("href", "/account/orders");
    expect(screen.queryByRole("button", { name: "Publicar reseña" })).not.toBeInTheDocument();
    expect(createProductReview).not.toHaveBeenCalled();
  },
);

test("al cambiar de producto descarta la compra y el comentario anteriores", async () => {
  const router = mount();
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("Comentario"), "Comentario del filtro.");
  await user.selectOptions(screen.getByLabelText("Calificación"), "2");
  await act(async () => { await router.navigate("/products/bomba"); });
  expect(await screen.findByRole("heading", { name: "Bomba" })).toBeVisible();
  expect(screen.getByRole("link", { name: "Elegir compra para reseñar" })).toBeVisible();
  expect(screen.queryByLabelText("Comentario")).not.toBeInTheDocument();

  await act(async () => { await router.navigate("/products/bomba?order_item=202#reviews"); });
  expect(await screen.findByLabelText("Comentario")).toHaveValue("");
  expect(screen.getByLabelText("Calificación")).toHaveValue("5");
  await user.type(screen.getByLabelText("Comentario"), "Comentario de la bomba.");
  await user.click(screen.getByRole("button", { name: "Publicar reseña" }));
  expect(createProductReview).toHaveBeenCalledExactlyOnceWith("bomba", {
    order_item_id: 202, rating: 5, comment: "Comentario de la bomba.",
  });
});

test("cambiar la compra del mismo producto descarta la respuesta pendiente y reinicia el formulario", async () => {
  const previous = deferred<ProductReview>();
  vi.mocked(createProductReview).mockReturnValueOnce(previous.promise).mockResolvedValueOnce(review);
  const router = mount();
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("Comentario"), "Compra anterior.");
  await user.click(screen.getByRole("button", { name: "Publicar reseña" }));
  expect(screen.getByRole("button", { name: "Publicando..." })).toBeDisabled();
  await act(async () => { await router.navigate("/products/filtro?order_item=102#reviews"); });
  expect(screen.getByLabelText("Comentario")).toHaveValue("");
  expect(screen.getByRole("button", { name: "Publicar reseña" })).toBeEnabled();

  await act(async () => { previous.resolve(review); });
  expect(screen.queryByText("Reseña publicada correctamente.")).not.toBeInTheDocument();
  await user.type(screen.getByLabelText("Comentario"), "Compra actual.");
  await user.click(screen.getByRole("button", { name: "Publicar reseña" }));
  expect(createProductReview).toHaveBeenLastCalledWith("filtro", {
    order_item_id: 102, rating: 5, comment: "Compra actual.",
  });
});
