import { useAuth } from "../../features/auth/AuthContext";
import { AdminResourceState } from "../../features/admin/AdminResourceState";
import { useAdminResource } from "../../features/admin/useAdminResource";
import {
  useMemo,
  useState,
} from "react";

import {
  getAdminUsers,
  updateAdminUser,
} from "../../services/adminService";

import type {
  AdminUser,
} from "../../types/admin";

import type {
  UserRole,
} from "../../types/auth";

export function AdminUsersPage() {
  const { user: currentUser, refreshUser } = useAuth();
  const { data, loading, error, reload, saving, runAction } = useAdminResource(getAdminUsers, "No se pudieron cargar los usuarios.");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");

  const filtered =
    useMemo(() => {
      const query =
        search.toLowerCase();

      return (data ?? []).filter(
        (user) => {
          const text = [
            user.email,
            user.username,
            user.first_name,
            user.last_name,
          ]
            .join(" ")
            .toLowerCase();

          return (
            text.includes(query) &&
            (!role ||
              user.role === role)
          );
        }
      );
    }, [data, search, role]);

  async function toggleUser(user: AdminUser) {
    await runAction(() => updateAdminUser(user.id, { is_active: !user.is_active }),
      "No se pudo modificar el usuario.");
  }

  async function changeRole(user: AdminUser, nextRole: UserRole) {
    await runAction(async () => {
      await updateAdminUser(user.id, { role: nextRole });
      if (user.id === currentUser?.id && nextRole !== currentUser.role) {
        await refreshUser();
      }
    }, "No se pudo cambiar el rol.");
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-bold">
        Usuarios
      </h2>

      <p className="mt-1 text-gray-600">
        Gestión de cuentas y permisos.
      </p>

      <div className="mt-6 grid gap-3 md:grid-cols-[1fr_220px]">
        <input
          placeholder="Buscar usuario..."
          value={search}
          onChange={(event) =>
            setSearch(
              event.target.value
            )
          }
          className="rounded-lg border px-4 py-2"
        />

        <select
          aria-label="Filtrar usuarios por rol"
          value={role}
          onChange={(event) =>
            setRole(
              event.target.value
            )
          }
          className="rounded-lg border px-4 py-2"
        >
          <option value="">
            Todos los roles
          </option>

          <option value="CUSTOMER">
            Cliente
          </option>

          <option value="SELLER">
            Vendedor
          </option>

          <option value="LOGISTICS_OPERATOR">
            Logística
          </option>

          <option value="ADMIN">
            Administrador
          </option>
          <option value="SUPER_ADMIN">Superadministrador</option>
        </select>
      </div>

      <AdminResourceState loading={loading} error={error} empty={filtered.length === 0}
        loadingText="Cargando usuarios..." emptyText="No se encontraron usuarios." onRetry={reload} />

      {data && (
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b text-gray-500">
              <th className="pb-3">
                Usuario
              </th>

              <th className="pb-3">
                Rol
              </th>

              <th className="pb-3">
                Estado
              </th>

              <th className="pb-3">
                Registro
              </th>

              <th className="pb-3 text-right">
                Acciones
              </th>
            </tr>
          </thead>

          <tbody>
            {filtered.map(
              (user) => (
                <tr
                  key={user.id}
                  className="border-b last:border-0"
                >
                  <td className="py-4">
                    <p className="font-semibold">
                      {user.first_name}{" "}
                      {user.last_name}
                    </p>

                    <p className="text-xs text-gray-500">
                      {user.email}
                    </p>
                  </td>

                  <td className="py-4">
                    <select
                      aria-label={`Rol de ${user.email}`}
                      value={user.role}
                      disabled={
                        saving || user.is_superuser ||
                        (user.role === "SUPER_ADMIN" && currentUser?.role !== "SUPER_ADMIN")
                      }
                      onChange={(event) =>
                        changeRole(
                          user,
                          event.target
                            .value as UserRole
                        )
                      }
                      className="rounded-lg border px-2 py-1"
                    >
                      <option value="CUSTOMER">
                        CUSTOMER
                      </option>

                      <option value="SELLER">
                        SELLER
                      </option>

                      <option value="LOGISTICS_OPERATOR">
                        LOGISTICS
                      </option>

                      <option value="ADMIN">
                        ADMIN
                      </option>
                      {(currentUser?.role === "SUPER_ADMIN" || user.role === "SUPER_ADMIN") && (
                        <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                      )}
                    </select>
                  </td>

                  <td className="py-4">
                    <span
                      className={
                        user.is_active
                          ? "font-medium text-green-700"
                          : "font-medium text-red-700"
                      }
                    >
                      {user.is_active
                        ? "Activo"
                        : "Bloqueado"}
                    </span>
                  </td>

                  <td className="py-4">
                    {user.date_joined
                      ? new Date(
                          user.date_joined
                        ).toLocaleDateString(
                          "es-AR"
                        )
                      : "—"}
                  </td>

                  <td className="py-4 text-right">
                    {(!user.is_superuser || currentUser?.role === "SUPER_ADMIN") && (
                      <button
                        type="button"
                        disabled={saving || user.id === currentUser?.id || (user.role === "SUPER_ADMIN" && currentUser?.role !== "SUPER_ADMIN")}
                        onClick={() =>
                          toggleUser(user)
                        }
                        className={
                          user.is_active
                            ? "rounded-lg border border-red-200 px-3 py-2 font-medium text-red-700"
                            : "rounded-lg border border-green-200 px-3 py-2 font-medium text-green-700"
                        }
                      >
                        {user.is_active
                          ? "Bloquear"
                          : "Activar"}
                      </button>
                    )}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
      )}
    </section>
  );
}
