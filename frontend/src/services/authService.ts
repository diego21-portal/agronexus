import { api, authApi } from "../lib/api";
import {
  assertAuthSession,
  AuthSessionChangedError,
  beginAuthSession,
  clearTokens,
  completeAuthSession,
  getAccessToken,
  getAuthSession,
  getRefreshToken,
} from "../lib/tokenStorage";
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  User,
} from "../types/auth";

export async function login(
  data: LoginRequest
): Promise<LoginResponse> {
  const generation = beginAuthSession();
  try {
    const response = await authApi.post<LoginResponse>("/auth/login/", data);
    try {
      assertAuthSession(generation);
      if (!response.data.access || !response.data.refresh) throw new Error("El servidor no devolvió una sesión válida.");
      completeAuthSession(generation, response.data.access, response.data.refresh);
    } catch (error) {
      if (error instanceof AuthSessionChangedError && response.data.refresh) {
        void authApi.post("/auth/logout/", { refresh: response.data.refresh }).catch(() => undefined);
      }
      throw error;
    }
    return response.data;
  } catch (error) {
    clearTokens(generation);
    throw error;
  }
}

export async function register(
  data: RegisterRequest
): Promise<User> {
  const response = await authApi.post<User>(
    "/auth/register/",
    data
  );

  return response.data;
}

export async function getCurrentUser(): Promise<User> {
  const response = await api.get<User>("/users/me/");
  return response.data;
}

export async function logout(): Promise<void> {
  const snapshot = getAuthSession();
  clearTokens();
  if (snapshot.refreshToken) {
    await authApi.post("/auth/logout/", { refresh: snapshot.refreshToken });
  } else if (snapshot.accessToken) {
    throw new Error("No se pudo confirmar el cierre de la sesión en el servidor.");
  }
}

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken());
}

export { getAccessToken, getRefreshToken };
