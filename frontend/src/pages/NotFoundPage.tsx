import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <section className="mx-auto max-w-xl py-16 text-center">
      <p className="text-7xl font-black text-green-700">
        404
      </p>

      <h1 className="mt-5 text-3xl font-bold">
        Página no encontrada
      </h1>

      <p className="mt-3 text-gray-600">
        La dirección que intentaste
        visitar no existe o fue
        movida.
      </p>

      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link
          to="/"
          className="rounded-lg bg-green-700 px-5 py-3 font-medium text-white"
        >
          Inicio
        </Link>

        <Link
          to="/products"
          className="rounded-lg border px-5 py-3 font-medium"
        >
          Ver productos
        </Link>
      </div>
    </section>
  );
}