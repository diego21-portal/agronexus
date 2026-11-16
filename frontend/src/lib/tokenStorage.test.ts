import { beforeEach, expect, test, vi } from "vitest";
import {
  AUTH_SESSION_STORAGE_KEY, AuthSessionChangedError, beginAuthSession, clearTokens,
  completeAuthSession, getAccessToken, getAuthSession, getRefreshToken, rotateSessionTokens, saveTokens,
} from "./tokenStorage";

beforeEach(() => { vi.restoreAllMocks(); clearTokens(); });

test("logout elimina los pares anteriores y un marcador existente nunca recupera las claves legacy", () => {
  saveTokens("access-secret", "refresh-secret");
  clearTokens();
  expect(Object.values(localStorage).join()).not.toContain("access-secret");
  expect(Object.values(localStorage).join()).not.toContain("refresh-secret");
  localStorage.setItem("agronexus_access_token", "obsolete-legacy");
  expect(getAccessToken()).toBeNull();
});

test("publicar A mientras otra pestaña inicia B no sustituye ni elimina las credenciales B", () => {
  const first = beginAuthSession();
  const original = Storage.prototype.setItem;
  let replaced = false;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    original.call(this, key, value);
    if (key === `${AUTH_SESSION_STORAGE_KEY}:${first}` && !replaced) {
      replaced = true;
      saveTokens("access-B", "refresh-B");
    }
  });
  expect(() => completeAuthSession(first, "access-A", "refresh-A")).toThrow(AuthSessionChangedError);
  expect(getAccessToken()).toBe("access-B");
  expect(getRefreshToken()).toBe("refresh-B");
  expect(Object.values(localStorage).join()).not.toContain("access-A");
});

test("la limpieza tardía de A durante un login B solo cierra la generación A", () => {
  saveTokens("access-A", "refresh-A");
  const first = getAuthSession().generation;
  const original = Storage.prototype.setItem;
  let replaced = false;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (key === `${AUTH_SESSION_STORAGE_KEY}:closed:${first}` && !replaced) {
      replaced = true;
      saveTokens("access-B", "refresh-B");
    }
    original.call(this, key, value);
  });
  clearTokens(first);
  expect(getAccessToken()).toBe("access-B");
  expect(getRefreshToken()).toBe("refresh-B");
});

test("cerrar A entre la comprobación y escritura del refresh no permite reabrir esa generación", () => {
  saveTokens("access-A", "refresh-A");
  const first = getAuthSession();
  const original = Storage.prototype.setItem;
  let closed = false;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (key === `${AUTH_SESSION_STORAGE_KEY}:${first.generation}` && !closed) {
      closed = true;
      clearTokens(first.generation);
    }
    original.call(this, key, value);
  });
  expect(() => rotateSessionTokens(first, "late-access", "late-refresh")).toThrow(AuthSessionChangedError);
  expect(getAccessToken()).toBeNull();
  expect(getRefreshToken()).toBeNull();
  expect(Object.values(localStorage).join()).not.toContain("late-access");
});
