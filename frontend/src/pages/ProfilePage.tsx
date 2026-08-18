import { useAuth } from "../features/auth/AuthContext";

export function ProfilePage() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  const fullName = `${user.first_name} ${user.last_name}`.trim();

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="rounded-2xl bg-white p-6 shadow-sm lg:col-span-2">
        <h1 className="mb-2 text-2xl font-bold">Mi perfil</h1>
        <p className="mb-6 text-gray-600">
          Información general de tu cuenta en AgroNexus.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <Info label="Nombre completo" value={fullName || "Sin completar"} />
          <Info label="Email" value={user.email} />
          <Info label="Usuario" value={user.username} />
          <Info label="Rol" value={user.role} />
          <Info label="Teléfono" value={user.profile?.phone || "Sin completar"} />
          <Info
            label="Documento"
            value={user.profile?.document_number || "Sin completar"}
          />
        </div>
      </section>

      <aside className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-bold">Accesos rápidos</h2>

        <div className="space-y-2 text-sm">
          <p className="rounded-lg bg-gray-50 p-3">Historial de compras</p>
          <p className="rounded-lg bg-gray-50 p-3">Direcciones</p>
          <p className="rounded-lg bg-gray-50 p-3">Favoritos</p>
          <p className="rounded-lg bg-gray-50 p-3">Preguntas realizadas</p>
        </div>
      </aside>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <p className="text-xs font-medium uppercase text-gray-500">{label}</p>
      <p className="mt-1 font-semibold text-gray-900">{value}</p>
    </div>
  );
}