import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { useAuth } from "../../features/auth/AuthContext";
import { useCart } from "../../features/cart/CartContext";
import { useNotifications } from "../../features/notifications/NotificationContext";
import { GlobalSearchBar } from "../ui/GlobalSearchBar";
import { ScrollToTop } from "../ui/ScrollToTop";
import { Footer } from "./Footer";

export function MainLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { authenticated, user, logoutUser, logoutWarning } = useAuth();
  const { itemCount } = useCart();
  const { unreadCount } = useNotifications();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function handleLogout() {
    logoutUser();
    navigate("/login");
  }

  const signInLinks = (
    <>
      <Link to="/login" className="inline-flex min-h-11 items-center justify-center rounded-lg px-3 py-2 text-center text-sm font-semibold text-agro-forest hover:bg-agro-mist">
        Ingresar
      </Link>
      <Link to="/register" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-agro-forest px-3 py-2 text-center text-sm font-semibold text-white hover:bg-agro-deep">
        Crear cuenta
      </Link>
    </>
  );

  return (
    <div className="min-h-screen bg-agro-paper text-agro-ink">
      <ScrollToTop />
      <a
        href="#main-content"
        className="sr-only z-[100] rounded-lg bg-agro-forest px-4 py-3 font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Saltar al contenido
      </a>

      <header className="border-b border-agro-line bg-white md:sticky md:top-0 md:z-50">
        <div className="mx-auto grid max-w-7xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:gap-x-5 sm:px-6 md:py-3">
          <Link to="/" className="flex items-center gap-2 rounded-md text-xl font-bold tracking-tight text-agro-forest sm:text-2xl">
            <img src="/agronexus.png" width={34} height={34} className="shrink-0" alt="" />
            AgroNexus
          </Link>

          <div className="col-span-3 row-start-2 min-w-0 md:col-span-1 md:col-start-2 md:row-start-1">
            <GlobalSearchBar />
          </div>

          <div className="col-start-3 row-start-1 hidden items-center gap-1 md:flex">
            {authenticated ? (
              <>
                <HeaderAction to="/notifications" count={unreadCount}>Notificaciones</HeaderAction>
                <HeaderAction to="/cart" count={itemCount}>Carrito</HeaderAction>
                <HeaderAction to="/account">Mi cuenta</HeaderAction>
              </>
            ) : signInLinks}
          </div>

          <div className="col-start-3 row-start-1 flex items-center gap-1 md:hidden">
            {authenticated && (
              <Link to="/cart" className="inline-flex min-h-11 items-center rounded-lg px-1.5 text-sm font-semibold text-agro-forest hover:bg-agro-mist">
                Carrito
                {itemCount > 0 && <span className="sr-only">, {itemCount} productos</span>}
              </Link>
            )}
            <button
              type="button"
              aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={mobileOpen}
              aria-controls="site-navigation"
              onClick={() => setMobileOpen((open) => !open)}
              className="inline-grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-agro-line text-xl text-agro-forest hover:bg-agro-mist"
            >
              <span aria-hidden="true">{mobileOpen ? "×" : "☰"}</span>
            </button>
          </div>
        </div>

        <nav
          id="site-navigation"
          aria-label="Navegación principal"
          className={`border-t border-agro-line ${mobileOpen ? "block" : "hidden"} md:block`}
        >
          <div className="mx-auto flex max-h-[60dvh] max-w-7xl flex-col gap-1 overflow-y-auto px-4 py-2 sm:px-6 md:max-h-none md:flex-row md:flex-wrap md:items-center md:gap-x-4 md:overflow-visible md:py-0">
            <HeaderLink to="/" end>Inicio</HeaderLink>
            <HeaderLink to="/products">Productos</HeaderLink>
            {authenticated && <HeaderLink to="/account/orders">Mis pedidos</HeaderLink>}
            {user?.role === "SELLER" && <HeaderLink to="/seller">Portal vendedor</HeaderLink>}
            {isAdmin && <HeaderLink to="/admin">Administración</HeaderLink>}
            {authenticated && (
              <>
                <div className="grid gap-1 md:hidden">
                  <HeaderLink to="/account" end>Mi cuenta</HeaderLink>
                  <HeaderLink to="/notifications">Notificaciones{unreadCount > 0 ? ` (${unreadCount})` : ""}</HeaderLink>
                </div>
                <button type="button" onClick={handleLogout} className="min-h-11 rounded-lg px-2 text-left text-sm font-semibold text-agro-muted hover:bg-agro-mist hover:text-agro-forest md:ml-auto">
                  Cerrar sesión
                </button>
              </>
            )}
            {!authenticated && <div className="grid grid-cols-2 gap-2 py-2 md:hidden">{signInLinks}</div>}
          </div>
        </nav>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto min-h-[70vh] min-w-0 max-w-7xl px-4 py-6 sm:px-6 md:scroll-mt-32 sm:py-8"
      >
        {logoutWarning && <div role="alert" className="mb-5 rounded-xl bg-amber-50 p-4 text-amber-900">{logoutWarning}</div>}
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}

function HeaderLink({ to, end, children }: { to: string; end?: boolean; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold ${isActive
          ? "bg-agro-mist text-agro-forest md:bg-transparent md:underline md:decoration-2 md:underline-offset-4"
          : "text-agro-muted hover:bg-agro-mist hover:text-agro-forest"}`
      }
    >
      {children}
    </NavLink>
  );
}

function HeaderAction({ to, count = 0, children }: { to: string; count?: number; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-agro-forest hover:bg-agro-mist">
      {children}
      {count > 0 && <span className="rounded-full bg-agro-mist px-1.5 text-xs tabular-nums">{count > 99 ? "99+" : count}</span>}
    </Link>
  );
}
