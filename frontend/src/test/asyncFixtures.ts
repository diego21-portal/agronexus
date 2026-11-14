import { vi } from "vitest";
import type { AuthContextValue } from "../features/auth/AuthContext";
import type { User } from "../types/auth";

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

export const testUser: User = {
  id: 1, email: "vendedor@example.invalid", username: "vendedor",
  first_name: "Usuario", last_name: "Prueba", role: "SELLER",
};

export function authValue(user: User | null = testUser): AuthContextValue {
  return {
    user, loading: false, authenticated: Boolean(user),
    loginUser: vi.fn().mockResolvedValue(testUser),
    registerUser: vi.fn().mockResolvedValue(testUser),
    logoutUser: vi.fn(), hasRole: (roles) => !!user && roles.includes(user.role),
    refreshUser: vi.fn().mockResolvedValue(undefined),
  };
}
