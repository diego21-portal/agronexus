import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getAccessToken, getCurrentUser, login, logout, register } from "../../services/authService";
import type { LoginRequest, RegisterRequest, User, UserRole } from "../../types/auth";
import { AuthContext, type AuthContextValue } from "./AuthContext";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionVersion = useRef(0);

  const refreshUser = useCallback(async () => {
    const version = ++sessionVersion.current;
    const currentUser = await getCurrentUser();
    if (version === sessionVersion.current) {
      setUser(currentUser);
      setLoading(false);
    }
  }, []);

  const loginUser = useCallback(async (data: LoginRequest) => {
    const version = ++sessionVersion.current;
    try {
      await login(data);
      const currentUser = await getCurrentUser();
      if (version === sessionVersion.current) setUser(currentUser);
      return currentUser;
    } finally {
      if (version === sessionVersion.current) setLoading(false);
    }
  }, []);

  const registerUser = useCallback((data: RegisterRequest) => register(data), []);

  const logoutUser = useCallback(() => {
    sessionVersion.current += 1;
    logout();
    setUser(null);
    setLoading(false);
  }, []);

  const hasRole = useCallback((roles: UserRole[]) => {
    return user !== null && roles.includes(user.role);
  }, [user]);

  useEffect(() => {
    let active = true;
    const version = ++sessionVersion.current;
    const isCurrent = () => active && version === sessionVersion.current;

    async function loadSession() {
      try {
        if (!getAccessToken()) {
          if (isCurrent()) setUser(null);
          return;
        }
        const currentUser = await getCurrentUser();
        if (isCurrent()) setUser(currentUser);
      } catch {
        if (isCurrent()) {
          logout();
          setUser(null);
        }
      } finally {
        if (isCurrent()) setLoading(false);
      }
    }

    void loadSession();
    return () => {
      active = false;
      sessionVersion.current += 1;
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    authenticated: Boolean(user),
    loginUser,
    registerUser,
    logoutUser,
    hasRole,
    refreshUser,
  }), [user, loading, loginUser, registerUser, logoutUser, hasRole, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
