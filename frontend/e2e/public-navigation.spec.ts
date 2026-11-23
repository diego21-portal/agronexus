import { expect, test } from "@playwright/test";

test("el inicio de AgroNexus tiene un acceso al catálogo y un buscador", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Maquinaria y repuestos para el campo." })).toBeVisible();
  await expect(page.getByRole("search")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Ver catálogo", exact: true })).toBeVisible();
});

test("permite navegar al catálogo", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Ver catálogo", exact: true }).click();

  await expect(page).toHaveURL(/\/products$/);
  await expect(page.getByRole("heading", { name: "Productos", exact: true })).toBeVisible();
});

test("muestra página 404", async ({ page }) => {
  await page.goto("/ruta-que-no-existe");
  await expect(page.getByRole("heading", { name: "Página no encontrada" })).toBeVisible();
  await expect(page.getByText("404")).toBeVisible();
});

test("a 320 px se puede saltar al contenido, abrir el menú y desplegar filtros", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chrome", "Recorrido de navegación móvil.");
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Saltar al contenido" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  const noHorizontalOverflow = () => page.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth);
  expect(await noHorizontalOverflow()).toBe(true);
  await expect(page.getByRole("button", { name: "Buscar", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Abrir menú" }).click();
  const navigation = page.getByRole("navigation", { name: "Navegación principal" });
  await navigation.getByRole("link", { name: "Productos", exact: true }).click();
  await expect(page.getByRole("button", { name: "Abrir menú" })).toHaveAttribute("aria-expanded", "false");

  const toggle = page.getByRole("button", { name: "Filtros", exact: true });
  const category = page.getByRole("combobox", { name: "Categoría" });
  await expect(category).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(category).toBeVisible();
  expect(await noHorizontalOverflow()).toBe(true);
  await toggle.click();
  await expect(category).toBeHidden();
});
