import {
  useEffect,
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

import { getApiErrorMessage } from "../../utils/apiError";

export function AdminUsersPage() {
  const [users, setUsers] =
    useState<AdminUser[]>([]);

  const [search, setSearch] =
    useState("");

  const [role, setRole] =
    useState("");

  const [error, setError] =
    useState("");

  async function loadUsers() {
    try {
      setUsers(
        await getAdminUsers()
      );
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "No se pudieron cargar los usuarios."
        )
      );
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  const filtered =
    useMemo(() => {
      const query =
        search.toLowerCase();

      return users.filter(
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
    }, [users, search, role]);

  async function toggleUser(
    user: AdminUser
  ) {
    try {
      await updateAdminUser(
        user.id,
        {
          is_active:
            !user.is_active,
        }
      );

      await loadUsers();
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "No se pudo modificar el usuario."
        )
      );
    }
  }

  async function changeRole(
    user: AdminUser,
    nextRole: UserRole
  ) {
    try {
      await updateAdminUser(
        user.id,
        {
          role: nextRole,
        }
      );

      await loadUsers();
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "No se pudo cambiar el rol."
        )
      );
    }
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
        </select>
      </div>

      {error && (
        <div className="mt-5 rounded-lg bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

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
                      value={user.role}
                      disabled={
                        user.is_superuser
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
                    {!user.is_superuser && (
                      <button
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
    </section>
  );
}