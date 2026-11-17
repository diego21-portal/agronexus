import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const backend = process.env.AUTH_E2E_API_BASE_URL || "http://127.0.0.1:8001/api/v1";
type Tokens = { access: string; refresh: string };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

async function login(page: Page, email: string): Promise<Tokens> {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill("Demo123456");
  const response = page.waitForResponse((item) => item.url() === `${backend}/auth/login/`);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  const result = await response;
  expect(result.status()).toBe(200);
  await expect(page.getByRole("button", { name: "Cerrar sesión", exact: true }).first()).toBeVisible();
  return result.json();
}

async function privateStatus(request: APIRequestContext, access: string) {
  const response = await request.get(`${backend}/users/me/`, {
    headers: { Authorization: `Bearer ${access}` },
  });
  return response.status();
}

test("login, renovación y cierre revocan ambos tokens y conservan otro dispositivo", async ({ page, request }) => {
  const original = await login(page, "cliente@agronexus.com");
  const otherLogin = await request.post(`${backend}/auth/login/`, {
    data: { email: "cliente@agronexus.com", password: "Demo123456" },
  });
  expect(otherLogin.status()).toBe(200);
  const other: Tokens = await otherLogin.json();

  let expired = false;
  await page.route(`${backend}/users/me/`, async (route) => {
    if (!expired) {
      expired = true;
      await route.fulfill({ status: 401, contentType: "application/json", body: '{"detail":"expired"}' });
    } else {
      await route.continue();
    }
  });
  const refreshResponse = page.waitForResponse((item) => item.url() === `${backend}/auth/refresh/`);
  await page.reload();
  const refreshed = await refreshResponse;
  expect(refreshed.status()).toBe(200);
  const current: Tokens = await refreshed.json();
  await expect(page.getByRole("button", { name: "Cerrar sesión", exact: true }).first()).toBeVisible();
  expect((await request.post(`${backend}/auth/refresh/`, { data: { refresh: original.refresh } })).status()).toBe(401);

  const logoutResponse = page.waitForResponse((item) => item.url() === `${backend}/auth/logout/`);
  await page.getByRole("button", { name: "Cerrar sesión", exact: true }).first().click();
  expect((await logoutResponse).status()).toBe(204);
  expect(await privateStatus(request, current.access)).toBe(401);
  expect((await request.post(`${backend}/auth/refresh/`, { data: { refresh: current.refresh } })).status()).toBe(401);
  expect(await privateStatus(request, other.access)).toBe(200);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Iniciar sesión", exact: true })).toBeVisible();
});

test("un refresh que termina después del logout no restaura la sesión", async ({ page, request }) => {
  await login(page, "cliente2@agronexus.com");
  const started = deferred<Tokens>();
  const release = deferred<void>();
  const finished = deferred<void>();
  await page.route(`${backend}/auth/refresh/`, async (route) => {
    try {
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      started.resolve(await response.json());
      await release.promise;
      await route.fulfill({ response });
    } catch {
      // Closing a session may abort the browser request while Django finishes.
    } finally {
      finished.resolve();
    }
  });
  let expired = false;
  await page.route(`${backend}/orders/`, async (route) => {
    if (!expired) {
      expired = true;
      await route.fulfill({ status: 401, contentType: "application/json", body: '{"detail":"expired"}' });
    } else {
      await route.continue();
    }
  });
  await page.goto("/account/orders");
  const rotated = await started.promise;
  try {
    const loggedOut = page.waitForResponse((item) => item.url() === `${backend}/auth/logout/`);
    await page.getByRole("button", { name: "Cerrar sesión", exact: true }).first().click();
    expect((await loggedOut).status()).toBe(204);
  } finally {
    release.resolve();
  }
  await finished.promise;
  expect(await privateStatus(request, rotated.access)).toBe(401);
  expect((await request.post(`${backend}/auth/refresh/`, { data: { refresh: rotated.refresh } })).status()).toBe(401);
  await page.goto("/account/orders");
  await expect(page.getByRole("heading", { name: "Iniciar sesión", exact: true })).toBeVisible();
});

test("dos pestañas coordinan la renovación y comparten el cierre de sesión", async ({ page, context }) => {
  await page.goto("/");
  const second = await context.newPage();
  await second.goto("/");
  await login(page, "vendedor@agronexus.com");
  await expect(second.getByRole("button", { name: "Cerrar sesión", exact: true }).first()).toBeVisible();
  const barrier = deferred<void>();
  let intercepted = 0;
  let refreshCount = 0;
  context.on("request", (request) => {
    if (request.url() === `${backend}/auth/refresh/`) refreshCount += 1;
  });
  for (const tab of [page, second]) {
    let expired = false;
    await tab.route(`${backend}/users/me/`, async (route) => {
      if (!expired) {
        expired = true;
        intercepted += 1;
        if (intercepted === 2) barrier.resolve();
        await barrier.promise;
        await route.fulfill({ status: 401, contentType: "application/json", body: '{"detail":"expired"}' });
      } else {
        await route.continue();
      }
    });
  }
  await Promise.all([page.reload(), second.reload()]);
  for (const tab of [page, second]) {
    await expect(tab.getByRole("button", { name: "Cerrar sesión", exact: true }).first()).toBeVisible();
  }
  expect(refreshCount).toBe(1);
  const loggedOut = page.waitForResponse((item) => item.url() === `${backend}/auth/logout/`);
  await page.getByRole("button", { name: "Cerrar sesión", exact: true }).first().click();
  expect((await loggedOut).status()).toBe(204);
  await expect(second.getByRole("button", { name: "Cerrar sesión", exact: true })).toHaveCount(0);
  await second.goto("/profile");
  await expect(second.getByRole("heading", { name: "Iniciar sesión", exact: true })).toBeVisible();
});

test("un fallo de red al cerrar informa que falta confirmar la revocación", async ({ page, request }) => {
  const pair = await login(page, "admin@agronexus.com");
  await page.route(`${backend}/auth/logout/`, (route) => route.abort("failed"));
  await page.getByRole("button", { name: "Cerrar sesión", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Iniciar sesión", exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("no pudimos confirmar el cierre en el servidor");
  // Local cleanup alone cannot promise server revocation while offline.
  expect(await privateStatus(request, pair.access)).toBe(200);
  expect((await request.post(`${backend}/auth/logout/`, { data: { refresh: pair.refresh } })).status()).toBe(204);
  expect(await privateStatus(request, pair.access)).toBe(401);
});
