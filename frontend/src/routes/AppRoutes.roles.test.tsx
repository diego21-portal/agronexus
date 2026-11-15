import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, expect, test, vi } from "vitest";
import { useAuth } from "../features/auth/AuthContext";
import { testUser } from "../test/asyncFixtures";
import type { UserRole } from "../types/auth";
import { AppRoutes } from "./AppRoutes";

vi.mock("../features/auth/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../features/cart/CartContext", () => ({
  useCart: () => ({ itemCount: 0 }),
}));
vi.mock("../features/notifications/NotificationContext", () => ({
  useNotifications: () => ({ unreadCount: 0 }),
}));
vi.mock("../pages/AdminDashboardPage", () => ({
  AdminDashboardPage: () => <h1>Panel autorizado</h1>,
}));
vi.mock("../pages/ForbiddenPage", () => ({
  ForbiddenPage: () => <h1>Acceso denegado</h1>,
}));
vi.mock("../pages/LoginPage", () => ({
  LoginPage: () => <h1>Ingreso</h1>,
}));

beforeEach(() => vi.clearAllMocks());

function renderAdminRoute(role: UserRole | null) {
  const user = role === null ? null : { ...testUser, role };
  vi.mocked(useAuth).mockReturnValue({
    user,
    authenticated: user !== null,
    loading: false,
    hasRole: (allowedRoles) => user !== null && allowedRoles.includes(user.role),
    loginUser: vi.fn(),
    registerUser: vi.fn(),
    logoutUser: vi.fn(),
    refreshUser: vi.fn(),
  });
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <AppRoutes />
    </MemoryRouter>
  );
}

test.each<UserRole>(["ADMIN", "SUPER_ADMIN"])(
  "%s puede abrir administración y ve el enlace del menú",
  async (role) => {
    renderAdminRoute(role);

    expect(await screen.findByRole("heading", { name: "Panel autorizado" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Administración" })).toBeVisible();
  }
);

test.each<UserRole>(["CUSTOMER", "LOGISTICS_OPERATOR"])(
  "%s no puede abrir administración ni ve su enlace",
  async (role) => {
    renderAdminRoute(role);

    expect(await screen.findByRole("heading", { name: "Acceso denegado" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Administración" })).toBeNull();
  }
);

test("un visitante es enviado al inicio de sesión", async () => {
  renderAdminRoute(null);

  expect(await screen.findByRole("heading", { name: "Ingreso" })).toBeVisible();
});
