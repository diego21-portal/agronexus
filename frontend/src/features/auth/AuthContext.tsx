import { createContext, useContext } from "react";
import type { LoginRequest, RegisterRequest, User, UserRole } from "../../types/auth";

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  authenticated: boolean;
  loginUser: (data: LoginRequest) => Promise<User>;
  registerUser: (data: RegisterRequest) => Promise<User>;
  logoutUser: () => void;
  hasRole: (roles: UserRole[]) => boolean;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider.");
  return context;
}
