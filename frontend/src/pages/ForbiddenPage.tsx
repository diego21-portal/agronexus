import { Link } from "react-router";

export function ForbiddenPage() {
  return (
    <section className="mx-auto max-w-xl py-16 text-center">
      <p className="text-7xl font-black text-green-700">
        403
      </p>

      <h1 className="mt-5 text-3xl font-bold">
        No tenés acceso
      </h1>

      <p className="mt-3 text-gray-600">
        Tu cuenta no tiene permisos
        suficientes para acceder a
        esta sección.
      </p>

      <div className="mt-7 flex justify-center gap-3">
        <Link
          to="/"
          className="rounded-lg bg-green-700 px-5 py-3 font-medium text-white"
        >
          Ir al inicio
        </Link>

        <Link
          to="/account"
          className="rounded-lg border px-5 py-3 font-medium"
        >
          Mi cuenta
        </Link>
      </div>
    </section>
  );
}