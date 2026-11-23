import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, expect, test, vi } from "vitest";

import { getCategories, getFeaturedProducts } from "../services/productService";
import type { CatalogProduct } from "../types/product";
import { HomePage } from "./HomePage";

vi.mock("../services/productService", () => ({ getCategories: vi.fn(), getFeaturedProducts: vi.fn() }));

const categories = [{ id: 1, name: "Repuestos", slug: "repuestos" }];
const products: CatalogProduct[] = [{
  id: 1, name: "Filtro hidráulico", sku: "FILTRO-1", slug: "filtro-hidraulico",
  seller: "Agro Prueba", category: "Repuestos", region: "Mendoza",
  price: "100.00", discount_price: null, current_price: "100.00", stock: 5,
  condition: "NEW", status: "PUBLISHED", shipping_available: true,
  average_rating: "0.00", total_reviews: 0, is_featured: true, main_image: null,
}];

beforeEach(() => vi.resetAllMocks());

test("una API de destacados caída permite reintentar sin recargar las categorías", async () => {
  vi.mocked(getCategories).mockResolvedValue(categories);
  vi.mocked(getFeaturedProducts).mockRejectedValueOnce(new Error("Sin conexión")).mockResolvedValueOnce(products);
  render(<MemoryRouter><HomePage /></MemoryRouter>);

  const featured = within(screen.getByRole("region", { name: "Productos destacados" }));
  expect(await featured.findByRole("alert")).toHaveTextContent("No pudimos cargar los productos destacados");
  expect(featured.queryByText(/Todavía no hay productos/)).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Repuestos/ })).toHaveAttribute("href", "/products?category=repuestos");

  await userEvent.click(featured.getByRole("button", { name: "Reintentar" }));
  expect(await featured.findByRole("link", { name: /Filtro hidráulico/ })).toHaveAttribute("href", "/products/filtro-hidraulico");
  expect(featured.queryByRole("alert")).not.toBeInTheDocument();
  expect(getCategories).toHaveBeenCalledTimes(1);
});

test("un resultado vacío de destacados se distingue de un error de categorías", async () => {
  vi.mocked(getCategories).mockRejectedValueOnce(new Error("Servicio no disponible")).mockResolvedValueOnce(categories);
  vi.mocked(getFeaturedProducts).mockResolvedValue([]);
  render(<MemoryRouter><HomePage /></MemoryRouter>);

  const section = within(screen.getByRole("region", { name: "Categorías" }));
  expect(await section.findByRole("alert")).toHaveTextContent("No pudimos cargar las categorías");
  expect(await screen.findByText(/Todavía no hay productos destacados/)).toBeVisible();
  await userEvent.click(section.getByRole("button", { name: "Reintentar" }));
  expect(await section.findByRole("link", { name: /Repuestos/ })).toBeVisible();
  expect(getFeaturedProducts).toHaveBeenCalledTimes(1);
});
