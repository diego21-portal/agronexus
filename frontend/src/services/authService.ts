import { api } from "../lib/api";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveTokens,
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
  const response = await api.post<LoginResponse>(
    "/auth/login/",
    data
  );

  saveTokens(response.data.access, response.data.refresh);

  return response.data;
}

export async function register(
  data: RegisterRequest
): Promise<User> {
  const response = await api.post<User>(
    "/auth/register/",
    data
  );

  return response.data;
}

export async function getCurrentUser(): Promise<User> {
  const response = await api.get<User>("/users/me/");
  return response.data;
}

export function logout(): void {
  clearTokens();
}

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken());
}

export { getAccessToken, getRefreshToken };