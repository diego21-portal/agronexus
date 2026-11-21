import { afterEach, expect, test } from "vitest";
import { api } from "../lib/api";
import { getMediaUrl } from "./mediaUrl";

const originalBaseURL = api.defaults.baseURL;
afterEach(() => { api.defaults.baseURL = originalBaseURL; });

test("los archivos relativos usan el origen y puerto de la API, sin añadir api/v1", () => {
  api.defaults.baseURL = "http://127.0.0.1:8002/api/v1";
  expect(getMediaUrl("/media/products/images/filtro.png")).toBe("http://127.0.0.1:8002/media/products/images/filtro.png");
  expect(getMediaUrl("media/products/documents/ficha.pdf")).toBe("http://127.0.0.1:8002/media/products/documents/ficha.pdf");
});

test("una API relativa en producción utiliza el origen de la aplicación", () => {
  api.defaults.baseURL = "/api/v1";
  expect(getMediaUrl("/media/products/images/filtro.png")).toBe(`${window.location.origin}/media/products/images/filtro.png`);
});

test("sin base configurada los archivos relativos siguen en el origen de la aplicación", () => {
  api.defaults.baseURL = undefined;
  expect(getMediaUrl("/media/products/documents/ficha.pdf")).toBe(`${window.location.origin}/media/products/documents/ficha.pdf`);
});

test("las URLs absolutas HTTPS se conservan, incluidas sus rutas codificadas", () => {
  api.defaults.baseURL = "/api/v1";
  expect(getMediaUrl("  https://cdn.example.invalid/productos/filtro%20principal.png?v=2  "))
    .toBe("https://cdn.example.invalid/productos/filtro%20principal.png?v=2");
});

test.each([null, undefined, "", "   ", "javascript:alert(1)", "data:image/svg+xml,<svg/>", "file:///tmp/ficha.pdf", "http://["])(
  "un archivo vacío, protocolo no admitido o URL inválida no genera un enlace (%s)",
  (url) => {
    api.defaults.baseURL = "/api/v1";
    expect(getMediaUrl(url)).toBeUndefined();
  },
);
