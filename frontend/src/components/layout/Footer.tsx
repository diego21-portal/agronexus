import { Link } from "react-router";

export function Footer() {
  return (
    <footer className="mt-10 bg-agro-deep text-agro-footer sm:mt-16">
      <div className="mx-auto flex max-w-7xl flex-wrap gap-x-6 gap-y-7 px-4 py-10 sm:px-6 md:gap-10">
        <div className="min-w-0 basis-full md:flex-[2_1_14rem]">
          <Link to="/" className="inline-flex max-w-full items-center gap-2 rounded-md text-2xl font-bold tracking-tight text-white">
            <img src="/agronexus.png" width={32} height={32} alt="" className="shrink-0" />
            <span className="min-w-0 wrap-anywhere">AgroNexus</span>
          </Link>
          <p className="mt-3 max-w-xs text-sm leading-relaxed">
            Marketplace de maquinaria, repuestos e insumos para el sector agrícola.
          </p>
        </div>

        <nav aria-label="Comprar" className="min-w-0 flex-[1_1_8rem] space-y-3 text-sm wrap-anywhere">
          <h2 className="font-semibold text-white">Comprar</h2>
          <Link to="/products" className="block rounded-sm hover:underline">Productos</Link>
          <Link to="/account/favorites" className="block rounded-sm hover:underline">Favoritos</Link>
          <Link to="/cart" className="block rounded-sm hover:underline">Carrito</Link>
        </nav>

        <nav aria-label="Enlaces de mi cuenta" className="min-w-0 flex-[1_1_8rem] space-y-3 text-sm wrap-anywhere">
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
