import { Outlet } from "react-router";
import { PanelNavigation } from "./PanelNavigation";

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
    to: "/profile",
    label: "Mi perfil",
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
  { to: "/account/cancellations", label: "Cancelaciones" },
];

export function AccountLayout() {
  return (
    <div>
      <header className="mb-5 sm:mb-7">
        <h1 className="font-display text-4xl leading-tight text-agro-forest sm:text-5xl">Mi cuenta</h1>
        <p className="mt-1 text-agro-muted">Tus compras, direcciones y actividad.</p>
      </header>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[220px_minmax(0,1fr)] xl:gap-6">
        <PanelNavigation label="Menú de mi cuenta" links={links} />
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
