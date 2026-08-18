import { Link } from "react-router";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-gray-200 bg-gray-900 text-gray-300">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <Link
            to="/"
            className="text-2xl font-bold text-white"
          >
            Agro
            <span className="text-green-500">
              Nexus
            </span>
          </Link>

          <p className="mt-4 text-sm leading-6 text-gray-400">
            Marketplace especializado
            en maquinaria, repuestos e
            insumos para el sector
            agrícola y agroindustrial.
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-white">
            Comprar
          </h3>

          <div className="mt-4 space-y-3 text-sm">
            <Link
              to="/products"
              className="block hover:text-white"
            >
              Productos
            </Link>

            <Link
              to="/account/favorites"
              className="block hover:text-white"
            >
              Favoritos
            </Link>

            <Link
              to="/cart"
              className="block hover:text-white"
            >
              Carrito
            </Link>
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-white">
            Mi cuenta
          </h3>

          <div className="mt-4 space-y-3 text-sm">
            <Link
              to="/account"
              className="block hover:text-white"
            >
              Resumen
            </Link>

            <Link
              to="/account/orders"
              className="block hover:text-white"
            >
              Pedidos
            </Link>

            <Link
              to="/notifications"
              className="block hover:text-white"
            >
              Notificaciones
            </Link>
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-white">
            AgroNexus
          </h3>

          <div className="mt-4 space-y-3 text-sm text-gray-400">
            <p>
              Marketplace agroindustrial
            </p>

            <p>
              Compra segura simulada
            </p>

            <p>
              Seguimiento de pedidos
            </p>

            <p>
              Vendedores especializados
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-800">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            © 2026 AgroNexus.
            Proyecto fullstack para
            portfolio.
          </p>

          <p>
            Django REST + React +
            PostgreSQL
          </p>
        </div>
      </div>
    </footer>
  );
}