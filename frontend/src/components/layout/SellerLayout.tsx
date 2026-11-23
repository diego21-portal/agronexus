import { Outlet } from "react-router";
import { PanelNavigation } from "./PanelNavigation";

const navigation = [
  {
    to: "/seller",
    label: "Resumen",
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
    label: "Reclamos",
  },
  { to: "/seller/returns", label: "Devoluciones" },
  { to: "/seller/cancellations", label: "Cancelaciones y retornos" },
];

export function SellerLayout() {
  return (
    <div>
      <header className="mb-5 sm:mb-7">
        <h1 className="font-display text-4xl leading-tight text-agro-forest sm:text-5xl">Portal del vendedor</h1>
        <p className="mt-1 text-agro-muted">Gestioná productos, ventas, stock y atención al cliente.</p>
      </header>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[220px_minmax(0,1fr)] xl:gap-6">
        <PanelNavigation label="Menú del vendedor" links={navigation} />
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
