import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "../lib/api";
import { clearTokens, saveTokens } from "../lib/tokenStorage";
import {
  deleteProductImage, deleteTechnicalSheet, updateProductImage,
  uploadProductImage, uploadTechnicalSheet,
} from "./productMediaService";

const originalAdapter = api.defaults.adapter;

function response(config: InternalAxiosRequestConfig, data: unknown, status = 200): AxiosResponse {
  return { config, data, status, statusText: "OK", headers: {} };
}

beforeEach(() => {
  clearTokens();
  saveTokens("seller-access", "seller-refresh");
});
afterEach(() => {
  api.defaults.adapter = originalAdapter;
  clearTokens();
});

test("la imagen viaja como FormData autenticado sin el Content-Type JSON ni un boundary inventado", async () => {
  const image = new File([new Uint8Array([137, 80, 78, 71])], "repuesto.png", { type: "image/png" });
  const saved = { id: 17, image: "https://api.example.invalid/media/products/images/uuid.png", alt_text: "Filtro frontal", is_main: true, order: 0 };
  const adapter = vi.fn<AxiosAdapter>(async (config) => response(config, saved, 201));
  api.defaults.adapter = adapter;

  expect(await uploadProductImage(9, image, "  Filtro frontal  ")).toEqual(saved);

  expect(adapter).toHaveBeenCalledTimes(1);
  const config = adapter.mock.calls[0][0];
  expect(config.method).toBe("post");
  expect(config.url).toBe("/seller/products/9/images/");
  expect(config.headers.get("Authorization")).toBe("Bearer seller-access");
  expect(config.data).toBeInstanceOf(FormData);
  expect(config.data.get("image")).toBe(image);
  expect(config.data.get("alt_text")).toBe("Filtro frontal");
  // Axios' browser adapter owns the multipart boundary. False disables the
  // instance's application/json default without writing a manual header.
  expect(config.headers.getContentType()).toBe(false);
  expect(config.headers.toJSON()).not.toHaveProperty("Content-Type");
});

test("la ficha PDF utiliza el campo file multipart y devuelve el producto confirmado", async () => {
  const pdf = new File(["%PDF-1.4\nfixture"], "ficha.pdf", { type: "application/pdf" });
  const saved = { id: 9, images: [], technical_sheet: "https://api.example.invalid/media/products/documents/uuid.pdf" };
  const adapter = vi.fn<AxiosAdapter>(async (config) => response(config, saved));
  api.defaults.adapter = adapter;

  expect(await uploadTechnicalSheet(9, pdf)).toEqual(saved);

  const config = adapter.mock.calls[0][0];
  expect(config.url).toBe("/seller/products/9/technical-sheet/");
  expect(config.method).toBe("post");
  expect(config.headers.get("Authorization")).toBe("Bearer seller-access");
  expect(config.data).toBeInstanceOf(FormData);
  expect(config.data.get("file")).toBe(pdf);
  expect([...config.data.keys()]).toEqual(["file"]);
  expect(config.headers.getContentType()).toBe(false);
});

test("editar metadatos conserva JSON y los borrados usan sus recursos dedicados", async () => {
  const saved = { id: 17, alt_text: "Vista lateral", is_main: true, order: 2 };
  const adapter = vi.fn<AxiosAdapter>(async (config) => response(config, config.method === "patch" ? saved : undefined, config.method === "patch" ? 200 : 204));
  api.defaults.adapter = adapter;

  expect(await updateProductImage(9, 17, { alt_text: "Vista lateral", is_main: true, order: 2 })).toEqual(saved);
  await deleteProductImage(9, 17);
  await deleteTechnicalSheet(9);

  expect(adapter.mock.calls.map(([config]) => [config.method, config.url])).toEqual([
    ["patch", "/seller/products/9/images/17/"],
    ["delete", "/seller/products/9/images/17/"],
    ["delete", "/seller/products/9/technical-sheet/"],
  ]);
  const metadata = adapter.mock.calls[0][0];
  expect(metadata.headers.getContentType()).toBe("application/json");
  expect(JSON.parse(metadata.data)).toEqual({ alt_text: "Vista lateral", is_main: true, order: 2 });
  for (const [config] of adapter.mock.calls) {
    expect(config.headers.get("Authorization")).toBe("Bearer seller-access");
  }
});
