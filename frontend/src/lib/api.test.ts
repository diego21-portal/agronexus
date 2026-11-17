import { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { beforeEach, expect, test, vi } from "vitest";
import { api, authApi } from "./api";
import {
  AuthSessionChangedError, clearTokens, getAccessToken, getAuthSession,
  getRefreshToken, rotateSessionTokens, saveTokens,
} from "./tokenStorage";
import { login, logout } from "../services/authService";
import { deferred } from "../test/asyncFixtures";

function response(config: InternalAxiosRequestConfig, data: unknown = {}): AxiosResponse {
  return { data, status: 200, statusText: "OK", headers: {}, config };
}

function unauthorized(config: InternalAxiosRequestConfig): never {
  throw new AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, undefined, {
    ...response(config), status: 401,
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  clearTokens();
  delete api.defaults.headers.common.Authorization;
  delete authApi.defaults.headers.common.Authorization;
  Object.defineProperty(navigator, "locks", { configurable: true, value: undefined });
  api.defaults.adapter = async (config) => response(config);
  authApi.defaults.adapter = async (config) => response(config);
});

test("cada petición usa las credenciales actuales y elimina incluso un header anterior al cerrar sesión", async () => {
  saveTokens("access-A", "refresh-A");
  const adapter = vi.fn<AxiosAdapter>(async (config) => response(config));
  api.defaults.adapter = adapter;
  await api.get("/private/");
  expect(adapter.mock.calls[0][0].headers.get("Authorization")).toBe("Bearer access-A");
  clearTokens();
  api.defaults.headers.common.Authorization = "Bearer obsolete-default";
  await api.get("/products/", { headers: { Authorization: "Bearer obsolete-request" } });
  expect(adapter.mock.calls[1][0].headers.has("Authorization")).toBe(false);
});

test("un refresh en vuelo no restaura credenciales después del logout y revoca su par descartado", async () => {
  saveTokens("expired-A", "refresh-A");
  const pending = deferred<AxiosResponse>();
  let refreshConfig: InternalAxiosRequestConfig;
  const adapter = vi.fn<AxiosAdapter>(async (config) => {
    if (config.url === "/auth/refresh/") {
      refreshConfig = config;
      return pending.promise;
    }
    return response(config);
  });
  authApi.defaults.adapter = adapter;
  api.defaults.adapter = async (config) => unauthorized(config);
  const outcome = api.get("/users/me/").catch((error: unknown) => error);
  await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(1));
  const closing = logout();
  expect(getAccessToken()).toBeNull();
  expect(getRefreshToken()).toBeNull();
  await closing;
  pending.resolve(response(refreshConfig!, { access: "late-access-A", refresh: "late-refresh-A" }));
  expect(await outcome).toBeInstanceOf(AuthSessionChangedError);
  expect(getAccessToken()).toBeNull();
  await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(3));
  expect(adapter.mock.calls.filter(([config]) => config.url === "/auth/logout/")
    .map(([config]) => JSON.parse(config.data).refresh)).toEqual(["refresh-A", "late-refresh-A"]);
  expect(api.defaults.headers.common.Authorization).toBeUndefined();
});

test("un login que termina después de logout se descarta y revoca sin recuperar la cuenta", async () => {
  const pending = deferred<AxiosResponse>();
  let loginConfig: InternalAxiosRequestConfig;
  const adapter = vi.fn<AxiosAdapter>(async (config) => {
    if (config.url === "/auth/login/") {
      loginConfig = config;
      return pending.promise;
    }
    return response(config);
  });
  authApi.defaults.adapter = adapter;
  const outcome = login({ email: "a@example.invalid", password: "example" }).catch((error: unknown) => error);
  await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(1));
  await logout();
  pending.resolve(response(loginConfig!, { access: "late-access", refresh: "late-refresh" }));
  expect(await outcome).toBeInstanceOf(AuthSessionChangedError);
  expect(getAccessToken()).toBeNull();
  await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(2));
  expect(JSON.parse(adapter.mock.calls[1][0].data)).toEqual({ refresh: "late-refresh" });
});

test("un login anterior no reemplaza una cuenta nueva ni la limpia al fallar", async () => {
  const pending = deferred<AxiosResponse>();
  let firstConfig: InternalAxiosRequestConfig;
  let loginCount = 0;
  authApi.defaults.adapter = async (config) => {
    if (config.url === "/auth/login/" && ++loginCount === 1) {
      firstConfig = config;
      return pending.promise;
    }
    return response(config, { access: "access-B", refresh: "refresh-B" });
  };
  const first = login({ email: "a@example.invalid", password: "example" }).catch((error: unknown) => error);
  await vi.waitFor(() => expect(loginCount).toBe(1));
  await login({ email: "b@example.invalid", password: "example" });
  pending.resolve(response(firstConfig!, { access: "access-A", refresh: "refresh-A" }));
  expect(await first).toBeInstanceOf(AuthSessionChangedError);
  expect(getAccessToken()).toBe("access-B");
  expect(getRefreshToken()).toBe("refresh-B");
});

test("una respuesta privada de la cuenta anterior no se entrega a la cuenta nueva", async () => {
  saveTokens("access-A", "refresh-A");
  const pending = deferred<AxiosResponse>();
  let requestConfig: InternalAxiosRequestConfig;
  api.defaults.adapter = async (config) => {
    requestConfig = config;
    return pending.promise;
  };
  const outcome = api.get("/users/me/").catch((error: unknown) => error);
  saveTokens("access-B", "refresh-B");
  pending.resolve(response(requestConfig!, { email: "a@example.invalid" }));
  expect(await outcome).toBeInstanceOf(AuthSessionChangedError);
  expect(getAccessToken()).toBe("access-B");
});

test("varios 401 comparten un refresh y cada petición se reintenta con el par rotado", async () => {
  saveTokens("expired", "refresh");
  const pending = deferred<AxiosResponse>();
  let refreshConfig: InternalAxiosRequestConfig;
  const refreshAdapter = vi.fn<AxiosAdapter>(async (config) => {
    refreshConfig = config;
    return pending.promise;
  });
  const adapter = vi.fn<AxiosAdapter>(async (config) => {
    if (config.headers.get("Authorization") === "Bearer expired") unauthorized(config);
    return response(config);
  });
  authApi.defaults.adapter = refreshAdapter;
  api.defaults.adapter = adapter;
  const results = Promise.all([api.get("/one/"), api.get("/two/")]);
  await vi.waitFor(() => expect(refreshAdapter).toHaveBeenCalledTimes(1));
  pending.resolve(response(refreshConfig!, { access: "rotated-access", refresh: "rotated-refresh" }));
  expect(await results).toHaveLength(2);
  expect(adapter).toHaveBeenCalledTimes(4);
  expect(refreshAdapter).toHaveBeenCalledTimes(1);
  expect(getRefreshToken()).toBe("rotated-refresh");
  expect(api.defaults.headers.common.Authorization).toBeUndefined();
});

test("un 401 que llega tarde reutiliza la rotación ya realizada sin volver a gastar el refresh", async () => {
  saveTokens("expired", "refresh");
  const pending = deferred<AxiosResponse>();
  let lateConfig: InternalAxiosRequestConfig;
  let firstLateRequest = true;
  const refreshAdapter = vi.fn<AxiosAdapter>(async (config) => response(config, {
    access: "rotated", refresh: "rotated-refresh",
  }));
  authApi.defaults.adapter = refreshAdapter;
  api.defaults.adapter = async (config) => {
    if (config.url === "/late/" && firstLateRequest) {
      firstLateRequest = false;
      lateConfig = config;
      return pending.promise;
    }
    if (config.headers.get("Authorization") === "Bearer expired") unauthorized(config);
    return response(config);
  };
  const late = api.get("/late/");
  await api.get("/early/");
  pending.reject(new AxiosError("Unauthorized", "ERR_BAD_REQUEST", lateConfig!, undefined, {
    ...response(lateConfig!), status: 401,
  }));
  await late;
  expect(refreshAdapter).toHaveBeenCalledTimes(1);
});

test("los reintentos encolados tienen un límite de uno aunque todos sigan respondiendo 401", async () => {
  saveTokens("expired", "refresh");
  const refreshAdapter = vi.fn<AxiosAdapter>(async (config) => response(config, {
    access: "rotated", refresh: "rotated-refresh",
  }));
  const adapter = vi.fn<AxiosAdapter>(async (config) => unauthorized(config));
  authApi.defaults.adapter = refreshAdapter;
  api.defaults.adapter = adapter;
  const results = await Promise.allSettled([api.get("/one/"), api.get("/two/")]);
  expect(results.every((result) => result.status === "rejected")).toBe(true);
  expect(refreshAdapter).toHaveBeenCalledTimes(1);
  expect(adapter).toHaveBeenCalledTimes(4);
  expect(getAccessToken()).toBeNull();
});

test("un fallo del refresh rechaza toda la cola y elimina las credenciales de esa sesión", async () => {
  saveTokens("expired", "refresh");
  const refreshAdapter = vi.fn<AxiosAdapter>(async (config) => unauthorized(config));
  authApi.defaults.adapter = refreshAdapter;
  api.defaults.adapter = async (config) => unauthorized(config);
  const results = await Promise.allSettled([api.get("/one/"), api.get("/two/")]);
  expect(results.every((result) => result.status === "rejected")).toBe(true);
  expect(refreshAdapter).toHaveBeenCalledTimes(1);
  expect(getAccessToken()).toBeNull();
  expect(getRefreshToken()).toBeNull();
});

test("el fallo tardío de un refresh no borra la cuenta que inició sesión después", async () => {
  saveTokens("expired-A", "refresh-A");
  const pending = deferred<AxiosResponse>();
  let refreshConfig: InternalAxiosRequestConfig;
  const refreshAdapter = vi.fn<AxiosAdapter>(async (config) => {
    refreshConfig = config;
    return pending.promise;
  });
  authApi.defaults.adapter = refreshAdapter;
  api.defaults.adapter = async (config) => unauthorized(config);
  const outcome = api.get("/private/").catch((error: unknown) => error);
  await vi.waitFor(() => expect(refreshAdapter).toHaveBeenCalledTimes(1));
  saveTokens("access-B", "refresh-B");
  pending.reject(new AxiosError("Unauthorized", "ERR_BAD_REQUEST", refreshConfig!, undefined, {
    ...response(refreshConfig!), status: 401,
  }));
  expect(await outcome).toBeInstanceOf(AuthSessionChangedError);
  expect(getAccessToken()).toBe("access-B");
});

test.each(["login", "register", "refresh", "logout"])(
  "auth/%s no envía bearer ni dispara renovación ante 401",
  async (endpoint) => {
    saveTokens("old-access", "old-refresh");
    const authAdapter = vi.fn<AxiosAdapter>(async (config) => unauthorized(config));
    authApi.defaults.adapter = authAdapter;
    await expect(authApi.post(`/auth/${endpoint}/`, {}, {
      headers: { Authorization: "Bearer obsolete" },
    })).rejects.toBeInstanceOf(AxiosError);
    expect(authAdapter).toHaveBeenCalledTimes(1);
    expect(authAdapter.mock.calls[0][0].headers.has("Authorization")).toBe(false);
    expect(getAccessToken()).toBe("old-access");
  },
);

test("incluso una llamada de autenticación hecha con api excluye bearer y refresh automático", async () => {
  saveTokens("old-access", "old-refresh");
  const adapter = vi.fn<AxiosAdapter>(async (config) => unauthorized(config));
  const authAdapter = vi.fn<AxiosAdapter>(async (config) => response(config));
  api.defaults.adapter = adapter;
  authApi.defaults.adapter = authAdapter;
  await expect(api.post("/auth/login/", {})).rejects.toBeInstanceOf(AxiosError);
  expect(adapter.mock.calls[0][0].headers.has("Authorization")).toBe(false);
  expect(authAdapter).not.toHaveBeenCalled();
});

test("Web Locks relee la rotación de otra pestaña antes de enviar un refresh de un solo uso", async () => {
  saveTokens("expired", "refresh");
  const snapshot = getAuthSession();
  const lock = vi.fn(async (_name: string, callback: () => Promise<unknown>) => {
    rotateSessionTokens(snapshot, "peer-access", "peer-refresh");
    return callback();
  });
  Object.defineProperty(navigator, "locks", { configurable: true, value: { request: lock } });
  const authAdapter = vi.fn<AxiosAdapter>(async (config) => response(config));
  authApi.defaults.adapter = authAdapter;
  api.defaults.adapter = async (config) => {
    if (config.headers.get("Authorization") === "Bearer expired") unauthorized(config);
    return response(config);
  };
  await api.get("/private/");
  expect(lock).toHaveBeenCalledTimes(1);
  expect(authAdapter).not.toHaveBeenCalled();
  expect(getAccessToken()).toBe("peer-access");
});

test("un fallo de red al revocar no restaura las credenciales locales", async () => {
  saveTokens("access", "refresh");
  authApi.defaults.adapter = async () => { throw new Error("offline"); };
  const closing = logout();
  expect(getAccessToken()).toBeNull();
  await expect(closing).rejects.toThrow("offline");
  expect(getRefreshToken()).toBeNull();
});
