import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getAccessToken,
  getCurrentUser,
  login,
  logout,
  register,
} from "../../services/authService";
import type {
  LoginRequest,
  RegisterRequest,
  User,
  UserRole,
} from "../../types/auth";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  authenticated: boolean;
  loginUser: (data: LoginRequest) => Promise<User>;
  registerUser: (data: RegisterRequest) => Promise<User>;
  logoutUser: () => void;
  hasRole: (roles: UserRole[]) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshUser() {
    const currentUser = await getCurrentUser();
    setUser(currentUser);
  }

  async function loadSession() {
    try {
      const token = getAccessToken();

      if (!token) {
        setUser(null);
        return;
      }

      await refreshUser();
    } catch {
      logout();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function loginUser(data: LoginRequest) {
    await login(data);
    const currentUser = await getCurrentUser();
    setUser(currentUser);
    return currentUser;
  }

  async function registerUser(data: RegisterRequest) {
    const createdUser = await register(data);
    return createdUser;
  }

  function logoutUser() {
    logout();
    setUser(null);
  }

  function hasRole(roles: UserRole[]) {
    if (!user) return false;
    return roles.includes(user.role);
  }

  useEffect(() => {
    loadSession();
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      authenticated: Boolean(user),
      loginUser,
      registerUser,
      logoutUser,
      hasRole,
      refreshUser,
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider.");
  }

  return context;
}