import { randomUUID } from "node:crypto";
import { expect, test as base, type APIRequestContext, type Page } from "@playwright/test";

const backend = process.env.AUTH_E2E_API_BASE_URL || "http://127.0.0.1:8001/api/v1";
const password = "CompraPrueba1234!";
type Product = { id: number; slug: string; name: string; stock: number; category: number; region: number; brand: number | null };
type Address = { id: number; street: string };
type Order = { id: number; total: string; items: { quantity: number }[]; payment: { amount: string; payment_method: string }; shipping_address_snapshot: Address; shipping_address_snapshot_source: string };
type Seller = { access: string; template: Product };
type Buyer = { email: string; access: string; product: Product; address: Address };

const headers = (access: string) => ({ Authorization: `Bearer ${access}` });
const rows = <T,>(body: T[] | { results: T[] }): T[] => Array.isArray(body) ? body : body.results;

const test = base.extend<{ buyer: Buyer }, { seller: Seller }>({
  seller: [async ({ playwright }, use) => {
    const request = await playwright.request.newContext();
    const login = await request.post(`${backend}/auth/login/`, {
      data: { email: "vendedor@agronexus.com", password: "Demo123456" },
    });
    expect(login.status()).toBe(200);
    const { access } = await login.json();
    const result = await request.get(`${backend}/seller/products/`, { headers: headers(access) });
    expect(result.status()).toBe(200);
    const template = rows<Product>(await result.json())[0];
    await use({ access, template });
    await request.dispose();
  }, { scope: "worker" }],
  buyer: async ({ request, seller }, use) => {
    const suffix = randomUUID().slice(0, 12);
    const email = `compra-${suffix}@example.invalid`;
    const registered = await request.post(`${backend}/auth/register/`, {
      data: { email, username: `compra-${suffix}`, password, password_confirm: password },
    });
    expect(registered.status()).toBe(201);
    const loggedIn = await request.post(`${backend}/auth/login/`, { data: { email, password } });
    expect(loggedIn.status()).toBe(200);
    const { access } = await loggedIn.json();
    const addressResult = await request.post(`${backend}/users/me/addresses/`, {
      headers: headers(access),
      data: { region: seller.template.region, street: `Entrega original ${suffix}`, number: "123", city: "Mendoza", province: "Mendoza", postal_code: "5507", reference: "Portón verde", is_default: true },
    });
    expect(addressResult.status()).toBe(201);
    const created = await request.post(`${backend}/seller/products/`, {
      headers: headers(seller.access),
      data: { category: seller.template.category, region: seller.template.region, brand: seller.template.brand,
        name: `Compra integral ${suffix}`, sku: `E2E-${suffix}`, short_description: "Producto para una compra de prueba",
        description: "Producto creado en la base efímera de pruebas de navegador.", price: "100.00", stock: 5, status: "PUBLISHED", condition: "NEW", unit: "unidad" },
    });
    expect(created.status()).toBe(201);
    await use({ email, access, product: await created.json(), address: await addressResult.json() });
  },
});

async function preparePurchase(page: Page, buyer: Buyer, mobile = false) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(buyer.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Cerrar sesión", exact: true }).first()).toBeVisible();
  if (mobile) await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/products");
  await page.locator(`a[href="/products/${buyer.product.slug}"]`).first().click();
  await page.getByRole("spinbutton", { name: "Cantidad" }).fill("2");
  const added = page.waitForResponse((result) => result.url() === `${backend}/cart/items/` && result.request().method() === "POST");
  await page.getByRole("button", { name: "Agregar al carrito", exact: true }).click();
  expect((await added).status()).toBe(201);
  await page.getByRole("link", { name: /Carrito/ }).first().click();
  await expect(page.getByRole("spinbutton", { name: "Cantidad" })).toHaveValue("2");
  if (mobile) {
    const { scrollWidth, clientWidth } = await page.locator("html").evaluate((element) => ({
      scrollWidth: element.scrollWidth, clientWidth: element.clientWidth,
    }));
    expect(scrollWidth).toBe(clientWidth);
  }
  await page.getByRole("link", { name: "Continuar compra", exact: true }).click();
  await expect(page.getByText(buyer.address.street, { exact: false })).toBeVisible();
}

async function review(page: Page, byKeyboard = false) {
  const ready = page.waitForResponse((result) => result.url() === `${backend}/checkout/quote/` && result.request().method() === "POST");
  const action = page.getByRole("button", { name: "Revisar compra", exact: true });
  if (byKeyboard) await action.press("Enter");
  else await action.click();
  const result = await ready;
  expect(result.status()).toBe(200);
  await expect(page.getByRole("button", { name: "Confirmar compra", exact: true })).toBeEnabled();
  return result.json();
}

async function orders(request: APIRequestContext, buyer: Buyer): Promise<Order[]> {
  const result = await request.get(`${backend}/orders/`, { headers: headers(buyer.access) });
  expect(result.status()).toBe(200);
  return rows<Order>(await result.json());
}

async function stock(request: APIRequestContext, seller: Seller, product: Product) {
  const result = await request.get(`${backend}/seller/products/${product.id}/`, { headers: headers(seller.access) });
  expect(result.status()).toBe(200);
  return (await result.json()).stock;
}

test("compra móvil desde catálogo confirma transferencia, conserva dirección y tolera fallo posterior del carrito", async ({ page, request, buyer, seller }) => {
  await preparePurchase(page, buyer, true);
  await page.getByRole("radio", { name: /Transferencia simulada/ }).check();
  const quote = await review(page, true);
  await expect(page.getByRole("heading", { name: "Revisión de tu compra" })).toBeFocused();
  expect(quote.total).toBe("200.00");
  const root = page.locator("html");
  await root.evaluate((element) => { element.style.fontSize = "200%"; });
  await expect.poll(() => root.evaluate((element) => element.scrollWidth === element.clientWidth)).toBe(true);
  const steps = page.getByRole("list", { name: "Etapas de la compra" }).getByRole("listitem");
  await expect(steps).toHaveCount(3);
  expect(await steps.evaluateAll((elements) => elements.every((element) => element.scrollWidth <= element.clientWidth))).toBe(true);
  await root.evaluate((element) => { element.style.fontSize = ""; });
  expect(await orders(request, buyer)).toHaveLength(0);
  let committed = false;
  page.on("response", (response) => {
    if (response.url() === `${backend}/checkout/` && response.status() === 201) committed = true;
  });
  await page.route(`${backend}/cart/`, async (route) => {
    if (committed) await route.fulfill({ status: 503, contentType: "application/json", body: '{"detail":"temporary cart error"}' });
    else await route.continue();
  });
  const confirmed = page.waitForResponse((result) => result.url() === `${backend}/checkout/`);
  await page.getByRole("button", { name: "Confirmar compra", exact: true }).click();
  const result = await confirmed;
  expect(result.status()).toBe(201);
  const order: Order = await result.json();
  await expect(page.getByRole("heading", { name: "¡Gracias por tu compra!", exact: true })).toBeVisible();
  expect(order.payment.payment_method).toBe("SIMULATED_BANK_TRANSFER");
  expect(order.total).toBe("200.00");
  expect(order.items[0].quantity).toBe(2);
  expect(await stock(request, seller, buyer.product)).toBe(3);
  const replay = await request.post(`${backend}/checkout/`, {
    headers: headers(buyer.access), data: result.request().postDataJSON(),
  });
  expect(replay.status()).toBe(200);
  expect((await replay.json()).id).toBe(order.id);
  expect(await orders(request, buyer)).toHaveLength(1);
  expect(await stock(request, seller, buyer.product)).toBe(3);

  const edited = await request.patch(`${backend}/users/me/addresses/${buyer.address.id}/`, {
    headers: headers(buyer.access), data: { street: "Dirección nueva de la libreta" },
  });
  expect(edited.status()).toBe(200);
  const historical = (await orders(request, buyer))[0];
  expect(historical.shipping_address_snapshot.street).toBe(buyer.address.street);
  expect(historical.shipping_address_snapshot_source).toBe("CHECKOUT");
  await page.goto(`/account/orders/${order.id}`);
  await expect(page.getByText(buyer.address.street, { exact: false })).toBeVisible();
  await expect(page.getByText("Dirección nueva de la libreta", { exact: false })).toHaveCount(0);
});

test("un precio nuevo exige revisar y confirmar otra vez antes de crear el pedido", async ({ page, request, buyer, seller }) => {
  await preparePurchase(page, buyer);
  expect((await review(page)).total).toBe("200.00");
  const changed = await request.patch(`${backend}/seller/products/${buyer.product.id}/`, {
    headers: headers(seller.access), data: { price: "150.00" },
  });
  expect(changed.status()).toBe(200);
  const rejected = page.waitForResponse((result) => result.url() === `${backend}/checkout/`);
  await page.getByRole("button", { name: "Confirmar compra", exact: true }).click();
  expect((await rejected).status()).toBe(409);
  expect(await orders(request, buyer)).toHaveLength(0);
  expect(await stock(request, seller, buyer.product)).toBe(5);
  await expect(page.getByRole("alert").first()).toContainText(/cambi|revis/i);
  await expect(page.getByRole("button", { name: "Confirmar compra", exact: true })).toBeEnabled();
  const confirmed = page.waitForResponse((result) => result.url() === `${backend}/checkout/`);
  await page.getByRole("button", { name: "Confirmar compra", exact: true }).click();
  const response = await confirmed;
  expect(response.status()).toBe(201);
  expect((await response.json()).total).toBe("300.00");
  expect(await orders(request, buyer)).toHaveLength(1);
});

for (const outcome of ["perdida", "incompleta"] as const) {
  test(`una confirmación ${outcome} se recupera tras recargar con la misma referencia y sin otra compra`, async ({ page, request, buyer, seller }) => {
    await preparePurchase(page, buyer);
    await review(page);
    const payloads: unknown[] = [];
    let committedOrder: Order | undefined;
    await page.route(`${backend}/checkout/`, async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      payloads.push(route.request().postDataJSON());
      if (payloads.length > 1) return route.continue();
      const response = await route.fetch();
      expect(response.status()).toBe(201);
      const order: Order = await response.json();
      committedOrder = order;
      if (outcome === "perdida") await route.abort("failed");
      else await route.fulfill({ response, json: { total: order.total } });
    });
    await page.getByRole("button", { name: "Confirmar compra", exact: true }).click();
    const recover = page.getByRole("button", { name: /Recuperar confirmación/i });
    await expect(recover).toBeVisible();
    expect(await orders(request, buyer)).toHaveLength(1);
    await expect(page.getByText(/El servidor no realizó ningún cobro/)).toHaveCount(0);
    await page.reload();
    await expect(recover).toBeVisible();
    const replay = page.waitForResponse((result) => result.url() === `${backend}/checkout/` && result.request().method() === "POST");
    await recover.click();
    const response = await replay;
    expect(response.status()).toBe(200);
    expect((await response.json()).id).toBe(committedOrder!.id);
    expect(payloads).toHaveLength(2);
    expect(payloads[1]).toEqual(payloads[0]);
    await expect(page.getByRole("heading", { name: "¡Gracias por tu compra!", exact: true })).toBeVisible();
    expect(await orders(request, buyer)).toHaveLength(1);
    expect(await stock(request, seller, buyer.product)).toBe(3);
  });
}
