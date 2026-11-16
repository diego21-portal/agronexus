import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import {
  assertAuthSession,
  AuthSessionChangedError,
  clearTokens,
  getAuthSession,
  rotateSessionTokens,
  type AuthSessionSnapshot,
} from "./tokenStorage";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api/v1";

interface SessionRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
  _sessionGeneration?: string;
  _sessionAccessToken?: string | null;
}

interface RefreshResponse {
  access: string;
  refresh: string;
}

const options = { baseURL: API_BASE_URL, headers: { "Content-Type": "application/json" } };
export const api = axios.create(options);
// Authentication endpoints never inherit a bearer or the refresh interceptor.
export const authApi = axios.create({ ...options, timeout: 15000 });
authApi.interceptors.request.use((config) => {
  config.headers.delete("Authorization");
  return config;
});

const refreshFlights = new Map<string, Promise<AuthSessionSnapshot>>();

function isAuthEndpoint(url?: string): boolean {
  return /(?:^|\/)auth\/(?:login|register|refresh|logout)\/?(?:\?|$)/.test(url || "");
}

async function performRefresh(generation: string, failedAccess: string | null): Promise<AuthSessionSnapshot> {
  const current = assertAuthSession(generation);
  // Another request/tab may have finished the same refresh while we waited.
  if (current.accessToken && current.accessToken !== failedAccess) return current;
  if (!current.refreshToken) throw new Error("La sesión ya no tiene credenciales para renovarse.");

  let receivedRefresh: string | undefined;
  try {
    const { data } = await authApi.post<RefreshResponse>("/auth/refresh/", { refresh: current.refreshToken });
    receivedRefresh = data.refresh;
    assertAuthSession(generation);
    if (!data.access || !data.refresh) throw new Error("La renovación de sesión no devolvió credenciales válidas.");
    return rotateSessionTokens(current, data.access, data.refresh);
  } catch (error) {
    if (error instanceof AuthSessionChangedError) {
      if (receivedRefresh) void authApi.post("/auth/logout/", { refresh: receivedRefresh }).catch(() => undefined);
      throw error;
    }
    const latest = assertAuthSession(generation);
    // Without Web Locks a peer can win a single-use refresh. Reuse its result
    // only if it has already published a new pair for this same session.
    if (latest.accessToken && latest.refreshToken !== current.refreshToken) return latest;
    throw error;
  }
}

function refreshSession(generation: string, failedAccess: string | null): Promise<AuthSessionSnapshot> {
  const existing = refreshFlights.get(generation);
  if (existing) return existing;
  const refresh = () => performRefresh(generation, failedAccess);
  const flight = navigator.locks?.request
    ? navigator.locks.request("agronexus-auth-refresh", refresh)
    : refresh();
  refreshFlights.set(generation, flight);
  const cleanup = () => {
    if (refreshFlights.get(generation) === flight) refreshFlights.delete(generation);
  };
  void flight.then(cleanup, cleanup);
  return flight;
}

api.interceptors.request.use((config: SessionRequestConfig) => {
  if (isAuthEndpoint(config.url)) {
    config.headers.delete("Authorization");
    return config;
  }
  const snapshot = config._sessionGeneration
    ? assertAuthSession(config._sessionGeneration)
    : getAuthSession();
  config._sessionGeneration = snapshot.generation;
  config._sessionAccessToken = snapshot.accessToken;
  if (snapshot.accessToken) config.headers.set("Authorization", `Bearer ${snapshot.accessToken}`);
  else config.headers.delete("Authorization");
  return config;
}, (error: unknown) => { throw error; }, { synchronous: true });

api.interceptors.response.use(
  (response) => {
    const config = response.config as SessionRequestConfig;
    if (config._sessionGeneration) assertAuthSession(config._sessionGeneration);
    return response;
  },
  async (error: AxiosError) => {
    const original = error.config as SessionRequestConfig | undefined;
    if (original?._sessionGeneration) assertAuthSession(original._sessionGeneration);
    if (error.response?.status !== 401 || !original || isAuthEndpoint(original.url)) {
      return Promise.reject(error);
    }
    if (original._retry) {
      clearTokens(original._sessionGeneration);
      return Promise.reject(error);
    }
    const snapshot = getAuthSession();
    if (!snapshot.refreshToken) {
      if (snapshot.accessToken) clearTokens(snapshot.generation);
      return Promise.reject(error);
    }
    // Set the flag on every waiter before joining: a rejected queued retry
    // cannot start another refresh.
    original._retry = true;
    try {
      await refreshSession(snapshot.generation, original._sessionAccessToken ?? null);
      assertAuthSession(snapshot.generation);
      return api(original);
    } catch (refreshError) {
      if (!(refreshError instanceof AuthSessionChangedError)) clearTokens(snapshot.generation);
      return Promise.reject(refreshError);
    }
  },
);
