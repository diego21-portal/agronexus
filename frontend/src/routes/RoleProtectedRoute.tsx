import {
  Navigate,
  Outlet,
} from "react-router";

import {
  useAuth,
} from "../features/auth/AuthContext";

import type {
  UserRole,
} from "../types/auth";

interface RoleProtectedRouteProps {
  allowedRoles: UserRole[];
}

export function RoleProtectedRoute({
  allowedRoles,
}: RoleProtectedRouteProps) {
  const {
    authenticated,
    loading,
    hasRole,
  } = useAuth();

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl p-8">
        <div className="h-40 animate-pulse rounded-2xl bg-gray-200" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  if (!hasRole(allowedRoles)) {
    return (
      <Navigate
        to="/403"
        replace
      />
    );
  }

  return <Outlet />;
}