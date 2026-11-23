import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

const backend = process.env.AUTH_E2E_API_BASE_URL || "http://127.0.0.1:8001/api/v1";
const headers = (access: string) => ({ Authorization: `Bearer ${access}` });
const rows = <T,>(body: T[] | { results: T[] }): T[] => Array.isArray(body) ? body : body.results;
type Product = { id: number; slug: string; category: number; region: number; brand: number | null; name: string };
const money = (value: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(value);
const imageBytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGNkaGBgYGBgYmBgYGBgAAAGKgCE5tEtPAAAAABJRU5ErkJggg==", "base64");

function technicalSheet() {
  let document = "%PDF-1.4\n";
  const offsets = [0];
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Count 0 /Kids [] >>"];
  for (const [index, body] of objects.entries()) {
    offsets.push(Buffer.byteLength(document));
    document += `${index + 1} 0 obj\n${body}\nendobj\n`;
  }
  const crossReference = Buffer.byteLength(document);
  document += "xref\n0 3\n0000000000 65535 f \n";
  document += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  document += `trailer\n<< /Size 3 /Root 1 0 R >>\nstartxref\n${crossReference}\n%%EOF\n`;
  return Buffer.from(document);
}

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill("Demo123456");
  const response = page.waitForResponse((item) => item.url() === `${backend}/auth/login/`);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  const result = await response;
  expect(result.status()).toBe(200);
  await expect(page.getByRole("button", { name: "Cerrar sesión", exact: true }).first()).toBeVisible();
  return (await result.json()).access as string;
}

test("vendedor edita relaciones y estado; administrador gestiona acceso y visibilidad y consulta operaciones reales", async ({ page, request }) => {
  test.setTimeout(90000);
  const suffix = randomUUID().slice(0, 12);
  const email = `administracion-${suffix}@example.invalid`;
  const registered = await request.post(`${backend}/auth/register/`, {
    data: { email, username: `admin-test-${suffix}`, password: "ClientePrueba1234!", password_confirm: "ClientePrueba1234!" },
  });
  expect(registered.status()).toBe(201);
  const registeredId: number = (await registered.json()).id;
  const sellerLogin = await request.post(`${backend}/auth/login/`, {
    data: { email: "vendedor@agronexus.com", password: "Demo123456" },
  });
  expect(sellerLogin.status()).toBe(200);
  const sellerAccess: string = (await sellerLogin.json()).access;
  const sellerProducts = await request.get(`${backend}/seller/products/`, { headers: headers(sellerAccess) });
  expect(sellerProducts.status()).toBe(200);
  const template = rows<Product>(await sellerProducts.json())[0];
  const sku = `ADMIN-E2E-${suffix}`;
  const created = await request.post(`${backend}/seller/products/`, {
    headers: headers(sellerAccess),
    data: { category: template.category, region: template.region, brand: template.brand,
      name: `Producto administrativo ${suffix}`, sku, short_description: "Producto de prueba de administración",
      description: "Producto exclusivo de la base efímera de Playwright.", price: "1210.50", stock: 5,
      status: "PAUSED", condition: "NEW", unit: "unidad" },
  });
  expect(created.status()).toBe(201);
  const product: Product = await created.json();

  await login(page, "vendedor@agronexus.com");
  const sellerDashboardResponse = await request.get(`${backend}/seller/dashboard/`, { headers: headers(sellerAccess) });
  expect(sellerDashboardResponse.status()).toBe(200);
  const sellerDashboard = await sellerDashboardResponse.json();
  expect(sellerDashboard.products.total_products).toBeGreaterThan(0);
  await page.goto("/seller");
  await expect(page.getByRole("article", { name: "Productos", exact: true }).getByText(String(sellerDashboard.products.total_products), { exact: true })).toBeVisible();
  await expect(page.getByRole("article", { name: "Ingresos netos simulados", exact: true })).toContainText(money(sellerDashboard.sales.total_revenue));
  await page.goto(`/seller/products/${product.id}/edit`);
  await expect(page.getByRole("combobox", { name: "Categoría", exact: true })).toHaveValue(String(template.category));
  await expect(page.getByRole("combobox", { name: "Región", exact: true })).toHaveValue(String(template.region));
  await expect(page.getByRole("combobox", { name: "Marca", exact: true })).toHaveValue(template.brand ? String(template.brand) : "");
  await expect(page.getByRole("combobox", { name: "Estado", exact: true })).toHaveValue("PAUSED");
  await expect(page.getByRole("spinbutton", { name: "Stock", exact: true })).toHaveValue("5");
  const stockAdjusted = await request.patch(`${backend}/seller/products/${product.id}/stock/`, {
    headers: headers(sellerAccess), data: { stock: 4, reason: "Ajuste desde otra sesión durante la edición" },
  });
  expect(stockAdjusted.status()).toBe(200);
  const updatedName = `Producto editado ${suffix}`;
  await page.getByLabel("Nombre", { exact: true }).fill(`  ${updatedName}  `);
  const saved = page.waitForResponse((response) => response.url() === `${backend}/seller/products/${product.id}/` && response.request().method() === "PATCH");
  await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  const updated = await saved;
  expect(updated.status()).toBe(200);
  expect(await updated.json()).toMatchObject({ name: updatedName, status: "PAUSED", category: template.category, region: template.region, brand: template.brand, stock: 4 });
  await expect(page).toHaveURL(/\/seller\/products$/);
  await page.goto(`/seller/products/${product.id}/edit`);
  const media = page.getByRole("region", { name: "Archivos del producto", exact: true });
  const imageUploaded = page.waitForResponse((response) => response.url() === `${backend}/seller/products/${product.id}/images/` && response.request().method() === "POST");
  await media.getByLabel("Imagen JPEG, PNG o WebP (máximo 5 MiB)").setInputFiles({ name: "producto.png", mimeType: "image/png", buffer: imageBytes });
  await media.getByLabel("Descripción de la nueva imagen").fill(`Imagen del producto ${suffix}`);
  await media.getByRole("button", { name: "Subir imagen", exact: true }).click();
  expect((await imageUploaded).status()).toBe(201);
  await expect(media.getByRole("img", { name: `Imagen del producto ${suffix}`, exact: true })).toBeVisible();
  await expect(media.getByText("Imagen principal", { exact: true })).toBeVisible();
  const pdfBytes = technicalSheet();
  const sheetUploaded = page.waitForResponse((response) => response.url() === `${backend}/seller/products/${product.id}/technical-sheet/` && response.request().method() === "POST");
  await media.getByLabel("Ficha PDF (máximo 10 MiB)").setInputFiles({ name: "ficha.pdf", mimeType: "application/pdf", buffer: pdfBytes });
  await media.getByRole("button", { name: "Subir ficha PDF", exact: true }).click();
  expect((await sheetUploaded).status()).toBe(200);
  await expect(media.getByRole("link", { name: "Descargar ficha PDF actual", exact: true })).toBeVisible();
  const published = await request.patch(`${backend}/seller/products/${product.id}/`, {
    headers: headers(sellerAccess), data: { status: "PUBLISHED" },
  });
  expect(published.status()).toBe(200);
  expect((await request.get(`${backend}/products/${product.slug}/`)).status()).toBe(200);
  await page.goto(`/products/${product.slug}`);
  await expect(page.getByRole("img", { name: `Imagen del producto ${suffix}`, exact: true }).first()).toBeVisible();
  const sheetLink = page.getByRole("link", { name: "Descargar ficha técnica PDF", exact: true });
  await expect(sheetLink).toBeVisible();
  const documentResponse = await request.get((await sheetLink.getAttribute("href"))!);
  expect(documentResponse.status()).toBe(200);
  expect(documentResponse.headers()["content-disposition"]).toContain("attachment");
  expect(documentResponse.headers()["x-content-type-options"]).toBe("nosniff");
  expect(await documentResponse.body()).toEqual(pdfBytes);
  await page.reload();
  await expect(sheetLink).toBeVisible();
  const loggedOut = page.waitForResponse((response) => response.url() === `${backend}/auth/logout/`);
  await page.getByRole("button", { name: "Cerrar sesión", exact: true }).first().click();
  expect((await loggedOut).status()).toBe(204);

  const adminAccess = await login(page, "admin@agronexus.com");
  const adminDashboardResponse = await request.get(`${backend}/admin/dashboard/`, { headers: headers(adminAccess) });
  expect(adminDashboardResponse.status()).toBe(200);
  const adminDashboard = await adminDashboardResponse.json();
  expect(adminDashboard.users.total_users).toBeGreaterThan(0);
  await page.goto("/admin");
  await expect(page.getByRole("article", { name: "Usuarios", exact: true }).getByText(String(adminDashboard.users.total_users), { exact: true })).toBeVisible();
  await expect(page.getByRole("article", { name: "Vendedores", exact: true }).getByText(String(adminDashboard.sellers.total_sellers), { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Ingresos netos simulados", exact: true })).toContainText(money(adminDashboard.sales.total_revenue));
  await page.goto("/admin/users");
  await page.getByRole("textbox", { name: "Buscar usuario" }).fill(email);
  const accountRow = page.getByRole("row").filter({ hasText: email });
  await expect(accountRow).toBeVisible();
  await page.getByRole("combobox", { name: `Rol de ${email}` }).selectOption("SELLER");
  const commercialRegistration = page.getByRole("form", { name: "Alta comercial del vendedor", exact: true });
  await expect(commercialRegistration).toBeVisible();
  await expect(page.getByRole("combobox", { name: `Rol de ${email}` })).toHaveValue("CUSTOMER");
  await commercialRegistration.getByLabel("Nombre comercial", { exact: true }).fill(`Comercio ${suffix}`);
  const onboarded = page.waitForResponse((response) => response.url() === `${backend}/admin/users/${registeredId}/` && response.request().method() === "PATCH");
  await commercialRegistration.getByRole("button", { name: "Guardar alta y habilitar vendedor", exact: true }).click();
  const onboardingResponse = await onboarded;
  expect(onboardingResponse.status()).toBe(200);
  expect((await onboardingResponse.json()).seller_profile).toMatchObject({ business_name: `Comercio ${suffix}`, is_active: true });
  await expect(page.getByRole("combobox", { name: `Rol de ${email}` })).toHaveValue("SELLER");
  const newSellerLogin = await request.post(`${backend}/auth/login/`, { data: { email, password: "ClientePrueba1234!" } });
  expect(newSellerLogin.status()).toBe(200);
  const newSellerSession: { access: string; refresh: string } = await newSellerLogin.json();
  expect((await request.get(`${backend}/seller/dashboard/`, { headers: headers(newSellerSession.access) })).status()).toBe(200);
  expect((await request.get(`${backend}/seller/products/${product.id}/images/`, { headers: headers(newSellerSession.access) })).status()).toBe(404);
  expect((await request.post(`${backend}/auth/logout/`, { data: { refresh: newSellerSession.refresh } })).status()).toBe(204);
  const roleChanged = page.waitForResponse((response) => response.url().includes("/admin/users/") && response.request().method() === "PATCH");
  await page.getByRole("combobox", { name: `Rol de ${email}` }).selectOption("LOGISTICS_OPERATOR");
  expect((await roleChanged).status()).toBe(200);
  await expect(page.getByRole("combobox", { name: `Rol de ${email}` })).toHaveValue("LOGISTICS_OPERATOR");
  const blocked = page.waitForResponse((response) => response.url().includes("/admin/users/") && response.request().method() === "PATCH");
  await accountRow.getByRole("button", { name: "Bloquear", exact: true }).click();
  expect((await blocked).status()).toBe(200);
  await expect(accountRow).toContainText("Bloqueado");

  await page.goto("/admin/products");
  await page.getByPlaceholder("Buscar producto, SKU o vendedor...").fill(sku);
  const productRow = page.getByRole("row").filter({ hasText: sku });
  await expect(productRow).toContainText(updatedName);
  for (const [button, publicStatus] of [["Desactivar", 404], ["Activar", 200]] as const) {
    const changed = page.waitForResponse((response) => response.url() === `${backend}/admin/products/${product.id}/` && response.request().method() === "PATCH");
    await productRow.getByRole("button", { name: button, exact: true }).click();
    expect((await changed).status()).toBe(200);
    await expect(productRow.getByRole("button", { name: button === "Activar" ? "Desactivar" : "Activar", exact: true })).toBeEnabled();
    expect((await request.get(`${backend}/products/${product.slug}/`)).status()).toBe(publicStatus);
  }

  await page.goto("/admin/sellers");
  await expect(page.getByRole("article").first()).toBeVisible();
  const sellerCard = page.getByRole("article").first();
  const originalButton = await sellerCard.getByRole("button").innerText();
  const verified = page.waitForResponse((response) => response.url().includes("/verify/") && response.request().method() === "PATCH");
  await sellerCard.getByRole("button", { name: originalButton, exact: true }).click();
  expect((await verified).status()).toBe(200);
  await expect(sellerCard.getByRole("button")).not.toHaveText(originalButton);
  await sellerCard.getByRole("button").click();
  await expect(sellerCard.getByRole("button")).toHaveText(originalButton);

  for (const [resource, heading] of [["orders", "Órdenes"], ["payments", "Pagos"], ["shipments", "Envíos"]]) {
    const loaded = page.waitForResponse((response) => response.url() === `${backend}/admin/${resource}/`);
    await page.goto(`/admin/${resource}`);
    expect((await loaded).status()).toBe(200);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
  }
  const orders = await request.get(`${backend}/admin/orders/`, { headers: headers(adminAccess) });
  expect(orders.status()).toBe(200);
  const firstOrder = rows<{ id: number; order_number: string; shipping_address_snapshot_source: string }>(await orders.json()).find((order) => order.shipping_address_snapshot_source === "LEGACY_UNKNOWN")!;
  expect(firstOrder).toBeDefined();
  await page.goto(`/admin/orders/${firstOrder.id}`);
  await expect(page.getByRole("heading", { name: firstOrder.order_number, exact: true })).toBeVisible();
  await expect(page.getByText(/no conserva una copia verificable/)).toBeVisible();
  expect((await request.get(`${backend}/admin/users/`, { headers: headers(sellerAccess) })).status()).toBe(403);
});
