import { NavLink, Outlet } from "react-router";

const navigation = [
  {
    to: "/seller",
    label: "Dashboard",
    end: true,
  },
  {
    to: "/seller/products",
    label: "Productos",
  },
  {
    to: "/seller/stock",
    label: "Stock",
  },
  {
    to: "/seller/orders",
    label: "Pedidos",
  },
  {
    to: "/seller/questions",
    label: "Preguntas",
  },
  {
    to: "/seller/issues",
    label: "Reclamos y devoluciones",
  },
];

export function SellerLayout() {
  return (
    <div>
      <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-green-700">
            AgroNexus Seller
          </p>

          <h1 className="text-3xl font-bold">
            Portal del vendedor
          </h1>

          <p className="mt-2 text-gray-600">
            Gestioná productos, ventas, stock y atención al cliente.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[250px_1fr]">
        <aside className="h-fit rounded-2xl bg-white p-4 shadow-sm xl:sticky xl:top-6">
          <nav className="space-y-1">
            {navigation.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  isActive
                    ? "block rounded-xl bg-green-700 px-4 py-3 text-sm font-semibold text-white"
                    : "block rounded-xl px-4 py-3 text-sm font-medium text-gray-700 hover:bg-green-50 hover:text-green-700"
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