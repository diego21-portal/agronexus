import { act, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router";
import { ProductDetailPage } from "./ProductDetailPage";
import { AuthContext } from "../features/auth/AuthContext";
import { getProductBySlug } from "../services/productService";
import { getFavoriteStatus } from "../services/favoriteService";
import { authValue, deferred } from "../test/asyncFixtures";
import type { CatalogProductDetail } from "../types/product";

vi.mock("../services/productService", () => ({ getProductBySlug: vi.fn() }));
vi.mock("../services/favoriteService", () => ({
  getFavoriteStatus: vi.fn(), addFavorite: vi.fn(), removeFavorite: vi.fn(),
}));
vi.mock("../features/cart/CartContext", () => ({ useCart: () => ({ addItem: vi.fn() }) }));
vi.mock("../features/products/ProductQuestionsSection", () => ({ ProductQuestionsSection: () => null }));
vi.mock("../features/products/ProductReviewsSection", () => ({ ProductReviewsSection: () => null }));
beforeEach(() => vi.resetAllMocks());

function product(slug: string): CatalogProductDetail {
  return {
    id: slug === "filtro" ? 1 : 2, name: slug === "filtro" ? "Filtro" : "Bomba", slug, sku: slug,
    seller: "Vendedor de prueba", category: "Repuestos", brand: "Marca de prueba", region: "Mendoza",
    price: "100.00", discount_price: null, current_price: "100.00", stock: 3,
    condition: "NEW", status: "PUBLISHED", shipping_available: true,
    average_rating: "0.00", total_reviews: 0, is_featured: false,
    short_description: "Descripción breve", description: "Descripción del producto",
    technical_description: "", unit: "UNIT", minimum_stock: 1, warranty: "", images: [], technical_sheet: null,
    created_at: "2026-11-01T12:00:00Z", updated_at: "2026-11-01T12:00:00Z",
  };
}
function mount(authenticated = false) {
  const router = createMemoryRouter([{ path: "/products/:slug", element: <ProductDetailPage /> }], { initialEntries: ["/products/filtro"] });
  render(<AuthContext.Provider value={authValue(authenticated ? undefined : null)}><RouterProvider router={router} /></AuthContext.Provider>);
  return router;
}

test("un producto anterior que responde tarde no reemplaza el detalle actual", async () => {
  const old = deferred<CatalogProductDetail>();
  vi.mocked(getProductBySlug).mockReturnValueOnce(old.promise).mockResolvedValueOnce(product("bomba"));
  const router = mount();
  await act(async () => { await router.navigate("/products/bomba"); });
  expect(await screen.findByRole("heading", { name: "Bomba" })).toBeInTheDocument();
  await act(async () => { old.resolve(product("filtro")); });
  expect(screen.queryByRole("heading", { name: "Filtro" })).not.toBeInTheDocument();
});

test("si el nuevo producto falla no conserva la tarjeta anterior", async () => {
  vi.mocked(getProductBySlug).mockResolvedValueOnce(product("filtro")).mockRejectedValueOnce(new Error("No encontrado"));
  const router = mount();
  await screen.findByRole("heading", { name: "Filtro" });
  await act(async () => { await router.navigate("/products/bomba"); });
  expect(await screen.findByText("No se pudo cargar el producto.")).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Filtro" })).not.toBeInTheDocument();
});

test("el favorito del producto anterior no cambia el botón del producto actual", async () => {
  const old = deferred<Awaited<ReturnType<typeof getFavoriteStatus>>>();
  vi.mocked(getProductBySlug).mockImplementation(async (slug) => product(slug));
  vi.mocked(getFavoriteStatus).mockReturnValueOnce(old.promise).mockResolvedValueOnce({ product_id: 2, product_slug: "bomba", is_favorite: false, favorite_id: null });
  const router = mount(true);
  await act(async () => {});
  await act(async () => { await router.navigate("/products/bomba"); });
  expect(await screen.findByRole("button", { name: /Agregar a favoritos/ })).toBeInTheDocument();
  await act(async () => { old.resolve({ product_id: 1, product_slug: "filtro", is_favorite: true, favorite_id: 4 }); });
  expect(screen.getByRole("button", { name: /Agregar a favoritos/ })).toBeInTheDocument();
});

test("el catálogo ofrece la ficha PDF confirmada por la API como descarga", async () => {
  const sheet = "https://api.example.invalid/media/products/documents/ficha.pdf";
  vi.mocked(getProductBySlug).mockResolvedValue({ ...product("filtro"), technical_sheet: sheet });
  mount();
  expect(await screen.findByRole("link", { name: "Descargar ficha técnica PDF" })).toHaveAttribute("href", sheet);
  expect(screen.getByRole("link", { name: "Descargar ficha técnica PDF" })).toHaveAttribute("download");
});

test("un enlace de ficha con protocolo no permitido no se convierte en descarga ejecutable", async () => {
  vi.mocked(getProductBySlug).mockResolvedValue({ ...product("filtro"), technical_sheet: "javascript:alert(1)" });
  mount();
  await screen.findByRole("heading", { name: "Filtro" });
  expect(screen.queryByRole("link", { name: "Descargar ficha técnica PDF" })).not.toBeInTheDocument();
});
