import { afterEach, expect, test, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";

import { FavoritesPage } from "./FavoritesPage";
import {
  deleteFavoriteById,
  getFavorites,
} from "../../services/favoriteService";
import type { Favorite } from "../../types/favorite";

vi.mock("../../services/favoriteService", () => ({
  getFavorites: vi.fn(),
  deleteFavoriteById: vi.fn(),
}));

const favorite: Favorite = {
  id: 7,
  product_id: 99,
  product_name: "Filtro hidráulico",
  product_slug: "filtro-hidraulico",
  product_sku: "AUDIT-99",
  product_price: "100.00",
  product_discount_price: "80.00",
  product_current_price: "80.00",
  product_stock: 3,
  product_status: "PUBLISHED",
  product_average_rating: "4.50",
  product_total_reviews: 2,
  main_image: "https://example.invalid/filtro.png",
  created_at: "2026-11-01T12:00:00Z",
};

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

test("muestra el favorito y permite quitarlo por su ID", async () => {
  vi.mocked(getFavorites).mockResolvedValue([favorite]);
  vi.mocked(deleteFavoriteById).mockResolvedValue(undefined);

  render(
    <MemoryRouter>
      <FavoritesPage />
    </MemoryRouter>
  );

  expect(
    await screen.findByRole("heading", {
      name: "Filtro hidráulico",
    })
  ).toBeInTheDocument();

  expect(screen.getByRole("img")).toHaveAttribute(
    "src",
    favorite.main_image
  );

  expect(
    screen.getByRole("link", { name: "Ver producto" })
  ).toHaveAttribute("href", "/products/filtro-hidraulico");

  const user = userEvent.setup();

  await user.click(
    screen.getByRole("button", {
      name: "Quitar de favoritos Filtro hidráulico",
    })
  );

  await waitFor(() => {
    expect(deleteFavoriteById).toHaveBeenCalledWith(7);
  });

  expect(
    await screen.findByText("No guardaste productos todavía.")
  ).toBeInTheDocument();
});

test("muestra un error y permite reintentar si falla la carga", async () => {
  vi.mocked(getFavorites).mockRejectedValue(
    new Error("Sin conexión")
  );

  render(
    <MemoryRouter>
      <FavoritesPage />
    </MemoryRouter>
  );

  expect(
    await screen.findByRole("alert")
  ).toHaveTextContent("No se pudieron cargar los favoritos.");

  expect(
    screen.queryByText("No guardaste productos todavía.")
  ).not.toBeInTheDocument();

  expect(
    screen.getByRole("button", { name: "Reintentar" })
  ).toBeInTheDocument();
});

test("permite quitar un producto archivado sin ofrecer su detalle", async () => {
  vi.mocked(getFavorites).mockResolvedValue([
    {
      ...favorite,
      product_status: "ARCHIVED",
      product_stock: 0,
    },
  ]);

  render(
    <MemoryRouter>
      <FavoritesPage />
    </MemoryRouter>
  );

  expect(
    await screen.findByText("No disponible actualmente")
  ).toBeInTheDocument();

  expect(
    screen.queryByRole("link", { name: "Ver producto" })
  ).not.toBeInTheDocument();

  expect(
    screen.getByRole("button", {
      name: "Quitar de favoritos Filtro hidráulico",
    })
  ).toBeEnabled();
});