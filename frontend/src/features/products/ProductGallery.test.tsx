import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { ProductGallery } from "./ProductGallery";
import type { ProductImage } from "../../types/product";

const images: ProductImage[] = [
  { id: 1, image: "/media/frente.jpg", alt_text: "Frente", is_main: true },
  { id: 2, image: "/media/costado.jpg", alt_text: "Costado", is_main: false },
];

test("seleccionar una miniatura se conserva con un nuevo arreglo de las mismas imágenes", async () => {
  const { rerender } = render(<ProductGallery productName="Filtro" images={images} />);
  await userEvent.setup().click(screen.getByRole("button", { name: "Ver imagen 2 de Filtro" }));
  rerender(<ProductGallery productName="Filtro" images={[...images]} />);
  expect(screen.getByRole("img", { name: "Filtro" })).toHaveAttribute("src", "http://127.0.0.1:8000/media/costado.jpg");
});

test("al cambiar de producto usa su imagen principal y permite una galería vacía", () => {
  const { rerender } = render(<ProductGallery productName="Filtro" images={images} />);
  rerender(<ProductGallery productName="Bomba" images={[{ ...images[0], id: 9, image: "/media/bomba.jpg" }]} />);
  expect(screen.getByRole("img", { name: "Bomba" })).toHaveAttribute("src", "http://127.0.0.1:8000/media/bomba.jpg");
  rerender(<ProductGallery productName="Bomba" />);
  expect(screen.getByText("Producto sin imágenes")).toBeInTheDocument();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});
