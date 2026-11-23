import { Outlet } from "react-router";
import { PanelNavigation } from "./PanelNavigation";

const navigation = [
  {
    to: "/admin",
    label: "Resumen",
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
  { to: "/admin/cancellations", label: "Cancelaciones y retornos" },
];

export function AdminLayout() {
  return (
    <div>
      <header className="mb-5 sm:mb-7">
        <h1 className="font-display text-4xl leading-tight text-agro-forest sm:text-5xl">Administración</h1>
        <p className="mt-1 text-agro-muted">Supervisá usuarios, catálogo y operaciones.</p>
      </header>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[220px_minmax(0,1fr)] xl:gap-6">
        <PanelNavigation label="Menú de administración" links={navigation} />
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
