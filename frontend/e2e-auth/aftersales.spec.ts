import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const backend = process.env.AUTH_E2E_API_BASE_URL || "http://127.0.0.1:8001/api/v1";
const password = "PosventaPrueba1234!";
const auth = (access: string) => ({ Authorization: `Bearer ${access}` });
const rows = <T,>(body: T[] | { results: T[] }): T[] => Array.isArray(body) ? body : body.results;

type Account = { id: number; email: string; access: string };
type Seller = Account & { profileId: number; businessName: string };
type Product = { id: number; slug: string; name: string; sku: string; stock: number };
type Shipment = { id: number; seller: number; status: string; events: { id: number; status: string }[] };
type Order = {
  id: number; order_number: string; total: string; refunded_amount: string; net_total: string;
  items: { id: number; product: number; quantity: number; total_price: string }[];
  shipments: Shipment[];
  payment: { id: number; amount: string; status: string; refunded_amount: string; refunds: { id: number; amount: string; order_item: number; kind: string }[] };
};
type Cancellation = {
  id: number; status: string; is_pre_dispatch: boolean; refunded_amount: string;
  events: { id: number; action: string }[];
  inspections: { order_item: number; expected_quantity: number; received_quantity: number; restocked_quantity: number; defective_quantity: number; quarantined_quantity: number }[];
};
type Movement = { id: number; product: number; movement_type: string; quantity: number; previous_stock: number; new_stock: number };

async function register(request: APIRequestContext, label: string, suffix: string) {
  const email = `${label}-${suffix}@example.invalid`;
  const response = await request.post(`${backend}/auth/register/`, {
    data: { email, username: `${label}-${suffix}`, password, password_confirm: password },
  });
  expect(response.status()).toBe(201);
  return { id: (await response.json()).id as number, email };
}

async function apiLogin(request: APIRequestContext, email: string, pass = password): Promise<string> {
  const response = await request.post(`${backend}/auth/login/`, { data: { email, password: pass } });
  expect(response.status()).toBe(200);
  return (await response.json()).access as string;
}

async function browserLogin(page: Page, email: string, pass = password) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(pass);
  const loggedIn = page.waitForResponse((response) => response.url() === `${backend}/auth/login/`);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  expect((await loggedIn).status()).toBe(200);
  await expect(page.getByRole("button", { name: "Cerrar sesión", exact: true }).first()).toBeVisible();
}

async function getOrder(request: APIRequestContext, buyer: Account, id: number): Promise<Order> {
  const response = await request.get(`${backend}/orders/${id}/`, { headers: auth(buyer.access) });
  expect(response.status()).toBe(200);
  return response.json();
}

async function stock(request: APIRequestContext, seller: Seller, product: Product): Promise<number> {
  const response = await request.get(`${backend}/seller/products/${product.id}/`, { headers: auth(seller.access) });
  expect(response.status()).toBe(200);
  return (await response.json()).stock as number;
}

async function getCase(request: APIRequestContext, seller: Seller, id: number): Promise<Cancellation> {
  const response = await request.get(`${backend}/seller/cancellations/`, { headers: auth(seller.access) });
  expect(response.status()).toBe(200);
  const result = rows<Cancellation>(await response.json()).find((entry) => entry.id === id);
  expect(result).toBeDefined();
  return result!;
}

test("cancelación en tránsito entre dos vendedores recibe e inspecciona antes de reembolsar, sin duplicados tras perder respuestas", async ({ browser, request }) => {
  test.setTimeout(120000);
  const suffix = randomUUID().slice(0, 12);
  const adminAccess = await apiLogin(request, "admin@agronexus.com", "Demo123456");
  const createdBuyer = await register(request, "posventa-cliente", suffix);
  const buyer: Account = { ...createdBuyer, access: await apiLogin(request, createdBuyer.email) };

  async function prepareSeller(label: string): Promise<Seller> {
    const account = await register(request, label, suffix);
    const businessName = `${label} ${suffix}`;
    const promoted = await request.patch(`${backend}/admin/users/${account.id}/`, {
      headers: auth(adminAccess), data: { role: "SELLER", seller_profile: { business_name: businessName } },
    });
    expect(promoted.status()).toBe(200);
    const profile = (await promoted.json()).seller_profile;
    expect(profile).toMatchObject({ business_name: businessName, is_active: true });
    return { ...account, access: await apiLogin(request, account.email), profileId: profile.id as number, businessName };
  }

  const seller = await prepareSeller("posventa-vendedor-a");
  const otherSeller = await prepareSeller("posventa-vendedor-b");
  const categoryResponse = await request.get(`${backend}/categories/`);
  const regionResponse = await request.get(`${backend}/regions/`);
  expect(categoryResponse.status()).toBe(200);
  expect(regionResponse.status()).toBe(200);
  const category = rows<{ id: number }>(await categoryResponse.json())[0].id;
  const region = rows<{ id: number }>(await regionResponse.json())[0].id;

  async function prepareProduct(owner: Seller, name: string, price: string): Promise<Product> {
    const created = await request.post(`${backend}/seller/products/`, {
      headers: auth(owner.access),
      data: { category, region, brand: null, name: `${name} ${suffix}`, sku: `${name}-${suffix}`,
        short_description: "Producto exclusivo para probar posventa", description: "Producto de la base efímera de pruebas de navegador.",
        price, stock: 5, condition: "NEW", status: "PUBLISHED", unit: "unidad" },
    });
    expect(created.status()).toBe(201);
    return created.json();
  }
  const product = await prepareProduct(seller, "Retorno", "100.00");
  const otherProduct = await prepareProduct(otherSeller, "Conservado", "50.00");
  const addressResponse = await request.post(`${backend}/users/me/addresses/`, {
    headers: auth(buyer.access),
    data: { region, street: `Entrega posventa ${suffix}`, number: "123", city: "Mendoza", province: "Mendoza", postal_code: "5507", is_default: true },
  });
  expect(addressResponse.status()).toBe(201);

  // Contexts created directly from Browser do not inherit the page fixture's
  // baseURL. Keep the three authenticated roles isolated on the same preview.
  const baseURL = test.info().project.use.baseURL;
  expect(baseURL).toBeTruthy();
  const buyerContext = await browser.newContext({ baseURL });
  const sellerContext = await browser.newContext({ baseURL });
  const adminContext = await browser.newContext({ baseURL });
  try {
    const buyerPage = await buyerContext.newPage();
    const sellerPage = await sellerContext.newPage();
    const adminPage = await adminContext.newPage();
    await browserLogin(buyerPage, buyer.email);
    for (const [entry, quantity] of [[product, 2], [otherProduct, 1]] as const) {
      await buyerPage.goto(`/products/${entry.slug}`);
      await buyerPage.getByRole("spinbutton").first().fill(String(quantity));
      const added = buyerPage.waitForResponse((response) => response.url() === `${backend}/cart/items/` && response.request().method() === "POST");
      await buyerPage.getByRole("button", { name: "Agregar al carrito", exact: true }).click();
      expect((await added).status()).toBe(201);
    }
    await buyerPage.goto("/cart");
    await buyerPage.getByRole("link", { name: "Continuar compra", exact: true }).click();
    await expect(buyerPage.getByText(`Entrega posventa ${suffix}`, { exact: false })).toBeVisible();
    const quoted = buyerPage.waitForResponse((response) => response.url() === `${backend}/checkout/quote/`);
    await buyerPage.getByRole("button", { name: "Revisar compra", exact: true }).click();
    expect((await quoted).status()).toBe(200);
    const purchased = buyerPage.waitForResponse((response) => response.url() === `${backend}/checkout/`);
    await buyerPage.getByRole("button", { name: "Confirmar compra", exact: true }).click();
    const confirmed = await purchased;
    expect(confirmed.status()).toBe(201);
    const order: Order = await confirmed.json();
    expect(order.total).toBe("250.00");
    expect(order.shipments).toHaveLength(2);
    const shipment = order.shipments.find((entry) => entry.seller === seller.profileId)!;
    const untouchedShipment = order.shipments.find((entry) => entry.seller === otherSeller.profileId)!;
    expect(shipment).toBeDefined();
    expect(untouchedShipment).toBeDefined();
    expect(await stock(request, seller, product)).toBe(3);
    expect(await stock(request, otherSeller, otherProduct)).toBe(4);

    await browserLogin(sellerPage, seller.email);
    await sellerPage.goto(`/seller/orders/${order.id}`);
    for (const status of ["PREPARING", "DISPATCHED", "IN_TRANSIT"]) {
      await sellerPage.getByRole("combobox", { name: "Estado del envío" }).selectOption(status);
      await sellerPage.getByPlaceholder("Descripción del evento").fill(`Avance de prueba ${status}`);
      const advanced = sellerPage.waitForResponse((response) => response.url() === `${backend}/seller/shipments/${shipment.id}/status/` && response.request().method() === "PATCH");
      await sellerPage.getByRole("button", { name: "Actualizar seguimiento", exact: true }).click();
      expect((await advanced).status()).toBe(200);
      await expect(sellerPage.getByRole("combobox", { name: "Estado del envío" })).toHaveValue(status);
      await expect(sellerPage.getByRole("button", { name: "Actualizar seguimiento", exact: true })).toBeEnabled();
    }

    await buyerPage.goto(`/account/orders/${order.id}`);
    const customerShipment = buyerPage.getByRole("article", { name: `Envío de ${seller.businessName}`, exact: true });
    await customerShipment.getByRole("button", { name: "Solicitar cancelación de este envío", exact: true }).click();
    await customerShipment.getByRole("textbox", { name: "Motivo de cancelación" }).fill("Necesito devolver este envío antes de la entrega final.");
    const requested = buyerPage.waitForResponse((response) => response.url() === `${backend}/shipments/${shipment.id}/cancellation/`);
    await customerShipment.getByRole("button", { name: "Confirmar solicitud", exact: true }).click();
    const requestedResponse = await requested;
    expect(requestedResponse.status()).toBe(201);
    const cancellation: Cancellation = await requestedResponse.json();
    expect(cancellation.is_pre_dispatch).toBe(false);
    await expect(customerShipment.getByRole("status")).toContainText("Cancelación solicitada");
    expect(await stock(request, seller, product)).toBe(3);
    expect((await getOrder(request, buyer, order.id)).payment.refunds).toHaveLength(0);

    await sellerPage.goto("/seller/cancellations");
    const sellerCard = sellerPage.getByRole("article", { name: `Cancelación ${order.order_number} de ${seller.businessName}`, exact: true });
    const sellerAction = `${backend}/seller/cancellations/${cancellation.id}/action/`;
    const returning = sellerPage.waitForResponse((response) => response.url() === sellerAction);
    await sellerCard.getByRole("button", { name: "Confirmar retorno en camino", exact: true }).click();
    expect((await returning).status()).toBe(200);
    await expect(sellerCard.getByText("Retorno en camino", { exact: true })).toBeVisible();
    await sellerCard.getByRole("spinbutton", { name: `Recibidas de ${product.name}`, exact: true }).fill("2");
    const received = sellerPage.waitForResponse((response) => response.url() === sellerAction);
    await sellerCard.getByRole("button", { name: "Registrar recepción", exact: true }).click();
    expect((await received).status()).toBe(200);
    await expect(sellerCard.getByText("Productos recibidos", { exact: true })).toBeVisible();
    expect(await stock(request, seller, product)).toBe(3);
    expect((await getCase(request, seller, cancellation.id)).inspections[0]).toMatchObject({ received_quantity: 2, quarantined_quantity: 2, restocked_quantity: 0, defective_quantity: 0 });
    expect((await getOrder(request, buyer, order.id)).payment.refunds).toHaveLength(0);

    // Django commits the inspection; only its first response is lost. Retrying
    // through the same visible form must not restock the healthy unit twice.
    let interruptedInspection = false;
    const inspectionPayloads: unknown[] = [];
    await sellerPage.route(sellerAction, async (route) => {
      const payload = route.request().postDataJSON();
      if (payload.action !== "inspect") { await route.continue(); return; }
      inspectionPayloads.push(payload);
      if (!interruptedInspection) {
        interruptedInspection = true;
        const response = await route.fetch();
        expect(response.status()).toBe(200);
        await route.abort("failed");
      } else await route.continue();
    });
    await sellerCard.getByRole("spinbutton", { name: `Aptas de ${product.name}`, exact: true }).fill("1");
    await sellerCard.getByRole("spinbutton", { name: `Defectuosas de ${product.name}`, exact: true }).fill("1");
    await sellerCard.getByRole("textbox", { name: "Resultado de la revisión", exact: true }).fill("Una unidad está apta y la segunda presenta daños y queda fuera de venta.");
    await sellerCard.getByRole("button", { name: "Guardar inspección", exact: true }).click();
    await expect(sellerCard.getByRole("alert")).toBeVisible();
    const firstInspection = await getCase(request, seller, cancellation.id);
    expect(firstInspection.status).toBe("INSPECTED");
    expect(firstInspection.inspections[0]).toMatchObject({ received_quantity: 2, restocked_quantity: 1, defective_quantity: 1, quarantined_quantity: 0 });
    expect(await stock(request, seller, product)).toBe(4);
    const inspectedRetry = sellerPage.waitForResponse((response) => response.url() === sellerAction);
    await sellerCard.getByRole("button", { name: "Guardar inspección", exact: true }).click();
    expect((await inspectedRetry).status()).toBe(200);
    await expect(sellerCard.getByText("Inspección completada", { exact: true })).toBeVisible();
    expect(inspectionPayloads).toHaveLength(2);
    expect(inspectionPayloads[1]).toEqual(inspectionPayloads[0]);
    expect((await getCase(request, seller, cancellation.id)).events).toEqual(firstInspection.events);
    expect(await stock(request, seller, product)).toBe(4);
    expect((await getOrder(request, buyer, order.id)).payment.refunds).toHaveLength(0);

    await browserLogin(adminPage, "admin@agronexus.com", "Demo123456");
    await adminPage.goto("/admin/cancellations");
    const adminCard = adminPage.getByRole("article", { name: `Cancelación ${order.order_number} de ${seller.businessName}`, exact: true });
    const adminAction = `${backend}/admin/cancellations/${cancellation.id}/action/`;
    let interruptedRefund = false;
    const completePayloads: unknown[] = [];
    await adminPage.route(adminAction, async (route) => {
      const payload = route.request().postDataJSON();
      if (payload.action !== "complete") { await route.continue(); return; }
      completePayloads.push(payload);
      if (!interruptedRefund) {
        interruptedRefund = true;
        const response = await route.fetch();
        expect(response.status()).toBe(200);
        await route.abort("failed");
      } else await route.continue();
    });
    await adminCard.getByRole("button", { name: "Completar cancelación y registrar reembolso", exact: true }).click();
    await expect(adminCard.getByRole("alert")).toBeVisible();
    const firstRefund = await getOrder(request, buyer, order.id);
    expect(firstRefund.payment.refunded_amount).toBe("200.00");
    expect(firstRefund.payment.refunds).toHaveLength(1);
    const firstCompleted = await getCase(request, seller, cancellation.id);
    const completedRetry = adminPage.waitForResponse((response) => response.url() === adminAction);
    await adminCard.getByRole("button", { name: "Completar cancelación y registrar reembolso", exact: true }).click();
    expect((await completedRetry).status()).toBe(200);
    await expect(adminCard.getByText("Cancelación completada", { exact: true })).toBeVisible();
    expect(completePayloads).toHaveLength(2);
    expect(completePayloads[1]).toEqual(completePayloads[0]);

    const finalOrder = await getOrder(request, buyer, order.id);
    expect(finalOrder).toMatchObject({ total: "250.00", refunded_amount: "200.00", net_total: "50.00" });
    expect(finalOrder.payment).toMatchObject({ amount: "250.00", refunded_amount: "200.00", status: "PARTIALLY_REFUNDED" });
    expect(finalOrder.payment.refunds).toEqual(firstRefund.payment.refunds);
    expect(finalOrder.payment.refunds[0]).toMatchObject({ amount: "200.00", kind: "PRODUCT", order_item: order.items.find((item) => item.product === product.id)!.id });
    expect(finalOrder.shipments.find((entry) => entry.id === shipment.id)?.status).toBe("CANCELLED");
    expect(finalOrder.shipments.find((entry) => entry.id === untouchedShipment.id)).toEqual(untouchedShipment);
    expect((await getCase(request, seller, cancellation.id)).events).toEqual(firstCompleted.events);
    expect(await stock(request, seller, product)).toBe(4);
    expect(await stock(request, otherSeller, otherProduct)).toBe(4);
    const movementResponse = await request.get(`${backend}/seller/stock/movements/`, { headers: auth(seller.access) });
    expect(movementResponse.status()).toBe(200);
    const movements = rows<Movement>(await movementResponse.json()).filter((entry) => entry.product === product.id);
    expect(movements.filter((entry) => entry.movement_type === "SALE")).toMatchObject([{ quantity: -2, previous_stock: 5, new_stock: 3 }]);
    expect(movements.filter((entry) => entry.movement_type === "RETURN")).toMatchObject([{ quantity: 1, previous_stock: 3, new_stock: 4 }]);

    await buyerPage.goto("/account/cancellations");
    const buyerCard = buyerPage.getByRole("article", { name: `Cancelación ${order.order_number} de ${seller.businessName}`, exact: true });
    await expect(buyerCard.getByText("Cancelación completada", { exact: true })).toBeVisible();
    await expect(buyerCard.getByText(/Reembolso registrado:/)).toContainText(/200,00/);
    await expect(buyerCard.getByText(/Aptas: 1 · Defectuosas: 1/)).toBeVisible();
    await buyerPage.goto(`/account/orders/${order.id}`);
    await expect(buyerPage.getByText("Importe original", { exact: true }).locator("..")).toContainText(/250,00/);
    await expect(buyerPage.getByText("Reembolso registrado", { exact: true }).locator("..")).toContainText(/200,00/);
    await expect(buyerPage.getByText("Importe neto", { exact: true }).locator("..")).toContainText(/50,00/);
  } finally {
    await buyerContext.close();
    await sellerContext.close();
    await adminContext.close();
  }
});
