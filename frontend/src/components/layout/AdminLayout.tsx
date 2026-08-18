import { NavLink, Outlet } from "react-router";

const navigation = [
  {
    to: "/admin",
    label: "Dashboard",
    end: true,
  },
  {
    to: "/admin/users",
    label: "Usuarios",
  },
  {
    to: "/admin/sellers",
    label: "Vendedores",
  },
  {
    to: "/admin/products",
    label: "Productos",
  },
  {
    to: "/admin/orders",
    label: "Órdenes",
  },
  {
    to: "/admin/payments",
    label: "Pagos",
  },
  {
    to: "/admin/shipments",
    label: "Envíos",
  },
  {
    to: "/admin/complaints",
    label: "Reclamos",
  },
  {
    to: "/admin/returns",
    label: "Devoluciones",
  },
];

export function AdminLayout() {
  return (
    <div>
      <header className="mb-7">
        <p className="text-sm font-semibold uppercase tracking-wide text-green-700">
          AgroNexus Control Center
        </p>

        <h1 className="text-3xl font-bold">
          Administración
        </h1>

        <p className="mt-2 text-gray-600">
          Supervisión general del marketplace.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[260px_1fr]">
        <aside className="h-fit rounded-2xl bg-gray-900 p-4 text-white shadow-sm xl:sticky xl:top-6">
          <p className="mb-4 px-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Control
          </p>

          <nav className="space-y-1">
            {navigation.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  isActive
                    ? "block rounded-xl bg-green-700 px-4 py-3 text-sm font-semibold text-white"
                    : "block rounded-xl px-4 py-3 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white"
                }
              >
                {item.label}
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