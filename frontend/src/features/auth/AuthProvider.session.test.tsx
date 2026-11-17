import { act, renderHook, waitFor } from "@testing-library/react";
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { beforeEach, expect, test, vi } from "vitest";
import { api, authApi } from "../../lib/api";
import { AUTH_SESSION_STORAGE_KEY, clearTokens, getAccessToken, saveTokens } from "../../lib/tokenStorage";
import { deferred, testUser } from "../../test/asyncFixtures";
import { AuthProvider } from "./AuthProvider";
import { useAuth } from "./AuthContext";

function response(config: InternalAxiosRequestConfig, data: unknown): AxiosResponse {
  return { data, status: 200, statusText: "OK", headers: {}, config };
}

function externalMarker(generation: string): void {
  localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify({ generation }));
  window.dispatchEvent(new StorageEvent("storage", { key: AUTH_SESSION_STORAGE_KEY, storageArea: localStorage }));
}

function externalCredentials(generation: string, access: string): void {
  const key = `${AUTH_SESSION_STORAGE_KEY}:${generation}`;
  localStorage.setItem(key, JSON.stringify({ generation, accessToken: access, refreshToken: `refresh-${access}` }));
  window.dispatchEvent(new StorageEvent("storage", { key, storageArea: localStorage }));
}

beforeEach(() => {
  vi.restoreAllMocks();
  clearTokens();
  Object.defineProperty(navigator, "locks", { configurable: true, value: undefined });
  api.defaults.adapter = async (config) => response(config, testUser);
  authApi.defaults.adapter = async (config) => response(config, {});
});

test("otra pestaña completa un login después de publicar el marcador vacío; una rotación no recarga su usuario", async () => {
  const adapter = vi.fn<AxiosAdapter>(async (config) => response(config, testUser));
  api.defaults.adapter = adapter;
  const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
  await waitFor(() => expect(result.current.loading).toBe(false));
  act(() => externalMarker("remote-login"));
  expect(result.current.user).toBeNull();
  expect(adapter).not.toHaveBeenCalled();
  act(() => externalCredentials("remote-login", "remote-access"));
  await waitFor(() => expect(result.current.user?.id).toBe(testUser.id));
  expect(adapter).toHaveBeenCalledTimes(1);
  expect(adapter.mock.calls[0][0].headers.get("Authorization")).toBe("Bearer remote-access");
  act(() => externalCredentials("remote-login", "rotated-access"));
  expect(result.current.authenticated).toBe(true);
  expect(adapter).toHaveBeenCalledTimes(1);
  act(() => externalMarker("remote-logout"));
  expect(result.current.user).toBeNull();
  expect(result.current.authenticated).toBe(false);
});

test("la respuesta inicial de A no reemplaza al usuario B después de cambiar de cuenta en otra pestaña", async () => {
  saveTokens("access-A", "refresh-A");
  const pending = deferred<AxiosResponse>();
  let firstConfig: InternalAxiosRequestConfig;
  api.defaults.adapter = async (config) => {
    if (config.headers.get("Authorization") === "Bearer access-A") {
      firstConfig = config;
      return pending.promise;
    }
    return response(config, { ...testUser, id: 22, email: "b@example.invalid" });
  };
  const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
  act(() => {
    externalMarker("account-B");
    externalCredentials("account-B", "access-B");
  });
  await waitFor(() => expect(result.current.user?.id).toBe(22));
  await act(async () => {
    pending.resolve(response(firstConfig!, testUser));
  });
  expect(result.current.user?.email).toBe("b@example.invalid");
  expect(getAccessToken()).toBe("access-B");
});

test("logout limpia React y credenciales antes de la red y avisa si el servidor no confirma la revocación", async () => {
  saveTokens("access", "refresh");
  const pending = deferred<AxiosResponse>();
  const logoutAdapter = vi.fn<AxiosAdapter>(async () => pending.promise);
  authApi.defaults.adapter = logoutAdapter;
  const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
  await waitFor(() => expect(result.current.authenticated).toBe(true));
  act(() => result.current.logoutUser());
  expect(result.current.authenticated).toBe(false);
  expect(getAccessToken()).toBeNull();
  await waitFor(() => expect(logoutAdapter).toHaveBeenCalledTimes(1));
  expect(logoutAdapter.mock.calls[0][0].headers.has("Authorization")).toBe(false);
  await act(async () => { pending.reject(new Error("offline")); });
  expect(result.current.logoutWarning).toMatch(/no pudimos confirmar/);
  expect(result.current.user).toBeNull();
  expect(getAccessToken()).toBeNull();
});
