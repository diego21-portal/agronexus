import {
  Navigate,
  Outlet,
  useLocation,
} from "react-router";

import {
  useAuth,
} from "../features/auth/AuthContext";

export function ProtectedRoute() {
  const location =
    useLocation();

  const {
    authenticated,
    loading,
  } = useAuth();

  if (loading) {
    return (
      <div className="h-48 animate-pulse rounded-2xl bg-gray-200" />
    );
  }

  if (!authenticated) {
    return (
      <Navigate
        to="/login"
        state={{
          from: location,
        }}
        replace
      />
    );
  }

  return <Outlet />;
}