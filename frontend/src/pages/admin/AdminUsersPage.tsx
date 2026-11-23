import { useAuth } from "../../features/auth/AuthContext";
import { AdminResourceState } from "../../features/admin/AdminResourceState";
import { useAdminResource } from "../../features/admin/useAdminResource";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SellerOnboardingForm } from "./SellerOnboardingForm";

import {
  getAdminUsers,
  updateAdminUser,
} from "../../services/adminService";

import type {
  AdminUser,
  SellerOnboardingPayload,
} from "../../types/admin";

import type {
  UserRole,
} from "../../types/auth";

export function AdminUsersPage() {
  const { user: currentUser, refreshUser } = useAuth();
  const { data, loading, error, reload, saving, runAction } = useAdminResource(getAdminUsers, "No se pudieron cargar los usuarios.");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const scope = `${currentUser?.id ?? "anonymous"}:${currentUser?.role ?? ""}`;
  const actorRef = useRef({ scope, active: true });
  if (actorRef.current.scope !== scope) {
    actorRef.current.active = false;
    actorRef.current = { scope, active: true };
  }
  const actor = actorRef.current;
  useEffect(() => {
    actor.active = true;
    return () => { actor.active = false; };
  }, [actor]);
  const [onboarding, setOnboarding] = useState<{ actor: typeof actor; user: AdminUser } | null>(null);
  const commercialRegistration = onboarding?.actor === actor ? onboarding : null;

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
    if (nextRole === "SELLER" && (!user.seller_profile?.is_active || !user.seller_profile.business_name.trim())) {
      setOnboarding({ actor, user });
      return;
    }
    await runAction(async () => {
      await updateAdminUser(user.id, { role: nextRole });
      if (actor.active && actorRef.current === actor && user.id === currentUser?.id && nextRole !== currentUser.role) {
        await refreshUser();
      }
    }, "No se pudo cambiar el rol.");
  }

  async function registerSeller(profile: SellerOnboardingPayload) {
    const registration = commercialRegistration;
    if (!registration || !actor.active || actorRef.current !== registration.actor) return false;
    let failure: unknown;
    const success = await runAction(async () => {
      try {
        await updateAdminUser(registration.user.id, { role: "SELLER", seller_profile: profile });
        if (actor.active && actorRef.current === registration.actor && registration.user.id === currentUser?.id && currentUser.role !== "SELLER") {
          await refreshUser();
        }
      } catch (requestError) {
        failure = requestError;
        throw requestError;
      }
    }, "No se pudo completar el alta comercial.");
    if (success) setOnboarding((current) => current === registration ? null : current);
    if (failure) throw failure;
    return success;
  }

  return (
    <section className="min-w-0 rounded-2xl border border-agro-line bg-white p-4 sm:p-6">
      <h2 className="text-2xl font-bold">
        Usuarios
      </h2>

      <p className="mt-1 text-gray-600">
        Gestión de cuentas y permisos.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,220px)]">
        <input
          aria-label="Buscar usuario"
          placeholder="Nombre o correo"
          value={search}
          onChange={(event) =>
            setSearch(
              event.target.value
            )
          }
          className="min-h-11 min-w-0 rounded-lg border border-agro-control px-3 py-2 text-base"
        />

        <select
          aria-label="Filtrar usuarios por rol"
          value={role}
          onChange={(event) =>
            setRole(
              event.target.value
            )
          }
          className="min-h-11 min-w-0 rounded-lg border border-agro-control px-3 py-2 text-base"
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

      {commercialRegistration && currentUser && (
        <SellerOnboardingForm key={`${scope}:${commercialRegistration.user.id}`}
          user={commercialRegistration.user} saving={saving} onSubmit={registerSeller}
          onCancel={() => setOnboarding(null)} />
      )}

      {data && filtered.length > 0 && (
      <div className="mt-6 lg:overflow-x-auto">
        <table role="table" aria-label="Usuarios" className="block w-full text-left text-sm lg:table lg:min-w-[760px]">
          <thead role="rowgroup" className="sr-only lg:not-sr-only">
            <tr role="row" className="border-b border-agro-line text-agro-muted">
              <th role="columnheader" scope="col" className="pb-3">
                Usuario
              </th>

              <th role="columnheader" scope="col" className="pb-3">
                Rol
              </th>

              <th role="columnheader" scope="col" className="pb-3">
                Estado
              </th>

              <th role="columnheader" scope="col" className="pb-3">
                Registro
              </th>

              <th role="columnheader" scope="col" className="pb-3 text-right">
                Acciones
              </th>
            </tr>
          </thead>

          <tbody role="rowgroup" className="grid gap-3 lg:table-row-group">
            {filtered.map(
              (user) => (
                <tr
                  key={user.id}
                  role="row"
                  className="grid min-w-0 gap-3 rounded-xl border border-agro-line bg-agro-paper p-3 sm:p-4 lg:table-row lg:rounded-none lg:border-0 lg:border-b lg:bg-white lg:p-0 lg:last:border-b-0"
                >
                  <td role="cell" className="min-w-0 break-words lg:px-2 lg:py-4">
                    <p className="font-semibold">
                      {user.first_name}{" "}
                      {user.last_name}
                    </p>

                    <p className="break-all text-sm text-agro-muted">
                      {user.email}
                    </p>
                  </td>

                  <td role="cell" className="min-w-0 break-words lg:px-2 lg:py-4">
                    <span aria-hidden="true" className="mb-1 block font-medium text-agro-muted lg:hidden">Rol</span>
                    <select
                      aria-label={`Rol de ${user.email}`}
                      value={user.role}
                      disabled={
                        saving || Boolean(commercialRegistration) || user.is_superuser ||
                        (user.role === "SUPER_ADMIN" && currentUser?.role !== "SUPER_ADMIN")
                      }
                      onChange={(event) =>
                        changeRole(
                          user,
                          event.target
                            .value as UserRole
                        )
                      }
                      className="min-h-11 max-w-full rounded-lg border border-agro-control bg-white px-2 text-base lg:text-sm"
                    >
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
                      {(currentUser?.role === "SUPER_ADMIN" || user.role === "SUPER_ADMIN") && (
                        <option value="SUPER_ADMIN">Superadministrador</option>
                      )}
                    </select>
                  </td>

                  <td role="cell" className="min-w-0 break-words lg:px-2 lg:py-4">
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

                  <td role="cell" className="min-w-0 break-words lg:px-2 lg:py-4">
                    <span aria-hidden="true" className="font-medium text-agro-muted lg:hidden">Registro · </span>
                    {user.date_joined
                      ? new Date(
                          user.date_joined
                        ).toLocaleDateString(
                          "es-AR"
                        )
                      : "—"}
                  </td>

                  <td role="cell" className="min-w-0 lg:px-2 lg:py-4 lg:text-right">
                    {user.role === "SELLER" && (!user.seller_profile?.is_active || !user.seller_profile.business_name.trim()) && (
                      <button type="button" disabled={saving || Boolean(commercialRegistration)}
                        onClick={() => setOnboarding({ actor, user })}
                        className="mb-2 block min-h-11 rounded-lg border border-agro-control bg-white px-3 py-2 font-semibold text-agro-forest lg:ml-auto">
                        {user.seller_profile?.is_active === false ? "Reactivar perfil vendedor" : "Completar alta comercial"}
                      </button>
                    )}
                    {(!user.is_superuser || currentUser?.role === "SUPER_ADMIN") && (
                      <button
                        type="button"
                        disabled={saving || user.id === currentUser?.id || (user.role === "SUPER_ADMIN" && currentUser?.role !== "SUPER_ADMIN")}
                        onClick={() =>
                          toggleUser(user)
                        }
                        className={
                          user.is_active
                            ? "min-h-11 rounded-lg border border-red-200 bg-white px-3 py-2 font-semibold text-red-800"
                            : "min-h-11 rounded-lg border border-agro-control bg-white px-3 py-2 font-semibold text-agro-forest"
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
