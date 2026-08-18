import {
  useEffect,
  useState,
} from "react";

import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router";

import { useAuth } from "../../features/auth/AuthContext";

import { useCart } from "../../features/cart/CartContext";

import { useNotifications } from "../../features/notifications/NotificationContext";

import { GlobalSearchBar } from "../ui/GlobalSearchBar";

import { ScrollToTop } from "../ui/ScrollToTop";

import { Footer } from "./Footer";

export function MainLayout() {
  const navigate = useNavigate();

  const location =
    useLocation();

  const {
    authenticated,
    user,
    logoutUser,
  } = useAuth();

  const {
    itemCount,
  } = useCart();

  const {
    unreadCount,
  } = useNotifications();

  const [
    mobileOpen,
    setMobileOpen,
  ] = useState(false);

  const isSeller =
    user?.role === "SELLER";

  const isAdmin =
    user?.role === "ADMIN" ||
    user?.role ===
      "SUPERADMIN";

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  function handleLogout() {
    logoutUser();

    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <ScrollToTop />
      <a
        href="#main-content"
        className="sr-only z-[100] rounded-lg bg-green-700 px-4 py-3 font-medium text-white focus:fixed focus:left-4 focus:top-4 focus:not-sr-only"
      >
        Saltar al contenido
      </a>     

      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex h-16 items-center gap-4">
            <Link
              to="/"
              className="shrink-0 text-xl font-black tracking-tight sm:text-2xl"
            >
              Agro
              <span className="text-green-700">
                Nexus
              </span>
            </Link>

            <div className="hidden flex-1 lg:block">
              <GlobalSearchBar />
            </div>

            <div className="ml-auto hidden items-center gap-2 md:flex">
              {authenticated ? (
                <>
                  <Link
                    to="/notifications"
                    className="relative rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                  >
                    Notificaciones

                    {unreadCount >
                      0 && (
                      <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                        {unreadCount >
                        99
                          ? "99+"
                          : unreadCount}
                      </span>
                    )}
                  </Link>

                  <Link
                    to="/cart"
                    className="relative rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                  >
                    Carrito

                    {itemCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-green-700 px-1 text-[10px] font-bold text-white">
                        {itemCount >
                        99
                          ? "99+"
                          : itemCount}
                      </span>
                    )}
                  </Link>

                  <Link
                    to="/account"
                    className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-gray-100"
                  >
                    Mi cuenta
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="rounded-lg px-3 py-2 text-sm font-medium"
                  >
                    Ingresar
                  </Link>

                  <Link
                    to="/register"
                    className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800"
                  >
                    Crear cuenta
                  </Link>
                </>
              )}
            </div>

            <button
              type="button"
              aria-label="Abrir menú"
              aria-expanded={
                mobileOpen
              }
              onClick={() =>
                setMobileOpen(
                  (current) =>
                    !current
                )
              }
              className="ml-auto rounded-lg border border-gray-200 p-2 md:hidden"
            >
              <span className="block w-6 text-xl">
                {mobileOpen
                  ? "×"
                  : "☰"}
              </span>
            </button>
          </div>

          <div className="pb-3 lg:hidden">
            <GlobalSearchBar />
          </div>
        </div>

        <div className="hidden border-t border-gray-100 md:block">
          <nav className="mx-auto flex h-11 max-w-7xl items-center gap-7 px-6 text-sm font-medium text-gray-600">
            <HeaderLink
              to="/"
              end
            >
              Inicio
            </HeaderLink>

            <HeaderLink to="/products">
              Productos
            </HeaderLink>

            {authenticated && (
              <HeaderLink to="/account/orders">
                Mis pedidos
              </HeaderLink>
            )}

            {isSeller && (
              <HeaderLink to="/seller">
                Portal vendedor
              </HeaderLink>
            )}

            {isAdmin && (
              <HeaderLink to="/admin">
                Administración
              </HeaderLink>
            )}

            {authenticated && (
              <button
                type="button"
                onClick={
                  handleLogout
                }
                className="ml-auto text-gray-500 hover:text-red-700"
              >
                Cerrar sesión
              </button>
            )}
          </nav>
        </div>

        {mobileOpen && (
          <div className="border-t border-gray-200 bg-white px-4 py-4 shadow-lg md:hidden">
            <nav className="space-y-1">
              <MobileLink to="/">
                Inicio
              </MobileLink>

              <MobileLink to="/products">
                Productos
              </MobileLink>

              {authenticated && (
                <>
                  <MobileLink to="/account">
                    Mi cuenta
                  </MobileLink>

                  <MobileLink to="/account/orders">
                    Mis pedidos
                  </MobileLink>

                  <MobileLink to="/cart">
                    Carrito (
                    {itemCount})
                  </MobileLink>

                  <MobileLink to="/notifications">
                    Notificaciones (
                    {unreadCount})
                  </MobileLink>
                </>
              )}

              {isSeller && (
                <MobileLink to="/seller">
                  Portal vendedor
                </MobileLink>
              )}

              {isAdmin && (
                <MobileLink to="/admin">
                  Administración
                </MobileLink>
              )}

              {!authenticated ? (
                <div className="grid grid-cols-2 gap-2 pt-4">
                  <Link
                    to="/login"
                    className="rounded-lg border px-4 py-2 text-center text-sm font-medium"
                  >
                    Ingresar
                  </Link>

                  <Link
                    to="/register"
                    className="rounded-lg bg-green-700 px-4 py-2 text-center text-sm font-medium text-white"
                  >
                    Crear cuenta
                  </Link>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={
                    handleLogout
                  }
                  className="mt-4 w-full rounded-lg border border-red-200 px-4 py-2 text-left text-sm font-medium text-red-700"
                >
                  Cerrar sesión
                </button>
              )}
            </nav>
          </div>
        )}
      </header>

      <main id="main-content" className="mx-auto min-h-[70vh] max-w-7xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}

function HeaderLink({
  to,
  end = false,
  children,
}: {
  to: string;
  end?: boolean;
  children:
    React.ReactNode;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({
        isActive,
      }) =>
        isActive
          ? "text-green-700"
          : "hover:text-green-700"
      }
    >
      {children}
    </NavLink>
  );
}

function MobileLink({
  to,
  children,
}: {
  to: string;
  children:
    React.ReactNode;
}) {
  return (
    <NavLink
      to={to}
      className={({
        isActive,
      }) =>
        isActive
          ? "block rounded-lg bg-green-50 px-4 py-3 font-medium text-green-700"
          : "block rounded-lg px-4 py-3 font-medium text-gray-700 hover:bg-gray-50"
      }
    >
      {children}
    </NavLink>
  );
}