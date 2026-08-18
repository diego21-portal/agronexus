import { NavLink, Outlet } from "react-router";

const links = [
  {
    to: "/account",
    label: "Resumen",
    end: true,
  },
  {
    to: "/account/orders",
    label: "Mis pedidos",
  },
  {
    to: "/account/favorites",
    label: "Favoritos",
  },
  {
    to: "/account/addresses",
    label: "Direcciones",
  },
  {
    to: "/account/questions",
    label: "Preguntas",
  },
  {
    to: "/account/reviews",
    label: "Reseñas",
  },
  {
    to: "/account/complaints",
    label: "Reclamos",
  },
  {
    to: "/account/returns",
    label: "Devoluciones",
  },
];

export function AccountLayout() {
  return (
    <div>
      <div className="mb-7">
        <p className="text-sm font-semibold uppercase tracking-wide text-green-700">
          AgroNexus
        </p>

        <h1 className="text-3xl font-bold">Mi cuenta</h1>

        <p className="mt-2 text-gray-600">
          Gestioná tus compras, direcciones, favoritos y actividad.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="h-fit rounded-2xl bg-white p-4 shadow-sm lg:sticky lg:top-6">
          <nav className="space-y-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  isActive
                    ? "block rounded-lg bg-green-700 px-4 py-3 text-sm font-medium text-white"
                    : "block rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-green-50 hover:text-green-700"
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}