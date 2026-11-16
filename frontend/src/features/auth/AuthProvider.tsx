import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getAccessToken, getCurrentUser, login, logout, register } from "../../services/authService";
import type { LoginRequest, RegisterRequest, User, UserRole } from "../../types/auth";
import { AuthContext, type AuthContextValue } from "./AuthContext";
import { clearTokens, getAuthSession, subscribeAuthSession } from "../../lib/tokenStorage";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [logoutWarning, setLogoutWarning] = useState("");
  const sessionVersion = useRef(0);
  const loadedGeneration = useRef<string | null>(null);

  const refreshUser = useCallback(async () => {
    const version = ++sessionVersion.current;
    const currentUser = await getCurrentUser();
    if (version === sessionVersion.current) {
      setUser(currentUser);
      loadedGeneration.current = getAuthSession().generation;
      setLoading(false);
    }
  }, []);

  const loginUser = useCallback(async (data: LoginRequest) => {
    // login invalidates credentials synchronously, before its HTTP request.
    const pendingLogin = login(data);
    const version = ++sessionVersion.current;
    setUser(null);
    setLoading(true);
    setLogoutWarning("");
    try {
      await pendingLogin;
      const currentUser = await getCurrentUser();
      if (version === sessionVersion.current) {
        setUser(currentUser);
        loadedGeneration.current = getAuthSession().generation;
      }
      return currentUser;
    } finally {
      if (version === sessionVersion.current) setLoading(false);
    }
  }, []);

  const registerUser = useCallback((data: RegisterRequest) => register(data), []);

  const logoutUser = useCallback(() => {
    // Clear locally immediately; network confirmation must not delay logout.
    const pendingLogout = logout();
    const version = ++sessionVersion.current;
    setUser(null);
    setLoading(false);
    setLogoutWarning("");
    void Promise.resolve(pendingLogout).catch(() => {
      if (version === sessionVersion.current) {
        setLogoutWarning("Se cerró la sesión en este navegador, pero no pudimos confirmar el cierre en el servidor.");
      }
    });
  }, []);

  const hasRole = useCallback((roles: UserRole[]) => {
    return user !== null && roles.includes(user.role);
  }, [user]);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      const version = ++sessionVersion.current;
      const generation = getAuthSession().generation;
      const isCurrent = () => active && version === sessionVersion.current;
      try {
        if (!getAccessToken()) {
          if (isCurrent()) setUser(null);
          return;
        }
        const currentUser = await getCurrentUser();
        if (isCurrent()) {
          setUser(currentUser);
          loadedGeneration.current = generation;
        }
      } catch {
        if (isCurrent()) {
          clearTokens(generation);
          setUser(null);
        }
      } finally {
        if (isCurrent()) setLoading(false);
      }
    }

    const unsubscribe = subscribeAuthSession((change) => {
      if (!active) return;
      if (change.identityChanged) {
        sessionVersion.current += 1;
        loadedGeneration.current = null;
        setUser(null);
        setLoading(false);
      }
      // Rotation by another tab preserves the identity and does not reload the
      // user. An actual account switch must discard old data and load its user.
      if (change.external && change.snapshot.accessToken
        && loadedGeneration.current !== change.snapshot.generation) {
        setLogoutWarning("");
        setLoading(true);
        void loadSession();
      }
    });
    void loadSession();
    return () => {
      active = false;
      unsubscribe();
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
    logoutWarning,
  }), [user, loading, loginUser, registerUser, logoutUser, hasRole, refreshUser, logoutWarning]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
