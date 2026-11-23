import { Link } from "react-router";

export function Footer() {
  return (
    <footer className="mt-10 bg-agro-deep text-agro-footer sm:mt-16">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-7 px-4 py-10 sm:px-6 md:grid-cols-[2fr_1fr_1fr] md:gap-10">
        <div className="col-span-2 md:col-span-1">
          <Link to="/" className="inline-flex items-center gap-2 rounded-md text-2xl font-bold tracking-tight text-white">
            <img src="/agronexus.png" width={32} height={32} alt="" />
            AgroNexus
          </Link>
          <p className="mt-3 max-w-xs text-sm leading-relaxed">
            Marketplace de maquinaria, repuestos e insumos para el sector agrícola.
          </p>
        </div>

        <nav aria-label="Comprar" className="space-y-3 text-sm">
          <h2 className="font-semibold text-white">Comprar</h2>
          <Link to="/products" className="block rounded-sm hover:underline">Productos</Link>
          <Link to="/account/favorites" className="block rounded-sm hover:underline">Favoritos</Link>
          <Link to="/cart" className="block rounded-sm hover:underline">Carrito</Link>
        </nav>

        <nav aria-label="Enlaces de mi cuenta" className="space-y-3 text-sm">
          <h2 className="font-semibold text-white">Mi cuenta</h2>
          <Link to="/account" className="block rounded-sm hover:underline">Resumen</Link>
          <Link to="/account/orders" className="block rounded-sm hover:underline">Pedidos</Link>
          <Link to="/notifications" className="block rounded-sm hover:underline">Notificaciones</Link>
        </nav>
      </div>

      <div className="border-t border-white/20">
        <p className="mx-auto max-w-7xl px-4 py-4 text-sm sm:px-6">AgroNexus · Proyecto de portafolio con pagos y envíos simulados</p>
      </div>
    </footer>
  );
}
