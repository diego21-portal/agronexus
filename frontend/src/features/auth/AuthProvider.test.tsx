import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { AuthProvider } from "./AuthProvider";
import { useAuth } from "./AuthContext";
import { getAccessToken, getCurrentUser, login, logout } from "../../services/authService";
import { deferred, testUser } from "../../test/asyncFixtures";
import type { User } from "../../types/auth";

vi.mock("../../services/authService", () => ({
  getAccessToken: vi.fn(), getCurrentUser: vi.fn(),
  login: vi.fn(), logout: vi.fn(), register: vi.fn(),
}));
beforeEach(() => { vi.resetAllMocks(); vi.mocked(getAccessToken).mockReturnValue(null); });

test("sin token termina la carga sin pedir el usuario", async () => {
  const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.authenticated).toBe(false);
  expect(getCurrentUser).not.toHaveBeenCalled();
});

test("restaura la sesión y conserva las funciones al volver a renderizar", async () => {
  vi.mocked(getAccessToken).mockReturnValue("token-de-prueba");
  vi.mocked(getCurrentUser).mockResolvedValue(testUser);
  const { result, rerender } = renderHook(() => useAuth(), { wrapper: AuthProvider });
  await waitFor(() => expect(result.current.authenticated).toBe(true));
  const loginUser = result.current.loginUser;
  rerender();
  expect(result.current.loginUser).toBe(loginUser);
  expect(result.current.hasRole(["SELLER"])).toBe(true);
  expect(getCurrentUser).toHaveBeenCalledTimes(1);
});

test("una respuesta de inicio tardía no restaura una sesión cerrada", async () => {
  const pending = deferred<User>();
  vi.mocked(getAccessToken).mockReturnValue("token-de-prueba");
  vi.mocked(getCurrentUser).mockReturnValue(pending.promise);
  const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
  act(() => result.current.logoutUser());
  await act(async () => { pending.resolve(testUser); });
  expect(result.current.user).toBeNull();
  expect(result.current.loading).toBe(false);
  expect(logout).toHaveBeenCalledTimes(1);
});

test("iniciar sesión actualiza el usuario y la comprobación de roles", async () => {
  vi.mocked(login).mockResolvedValue({ access: "a", refresh: "r" });
  vi.mocked(getCurrentUser).mockResolvedValue(testUser);
  const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => { await result.current.loginUser({ email: testUser.email, password: "prueba" }); });
  expect(result.current.hasRole(["SELLER"])).toBe(true);
  expect(result.current.hasRole(["ADMIN"])).toBe(false);
});
