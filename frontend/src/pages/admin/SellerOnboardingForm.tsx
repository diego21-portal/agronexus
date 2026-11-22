import axios from "axios";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { AdminUser, SellerOnboardingPayload } from "../../types/admin";
import { getApiErrorMessage } from "../../utils/apiError";

function onboardingError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const profileError: unknown = error.response?.data?.seller_profile;
    if (typeof profileError === "string") return profileError;
    if (Array.isArray(profileError) && typeof profileError[0] === "string") return profileError[0];
    if (typeof profileError === "object" && profileError !== null && !Array.isArray(profileError)) {
      const labels: Record<string, string> = {
        business_name: "Nombre comercial", tax_id: "CUIT / identificación fiscal",
        description: "Descripción comercial", is_active: "Reactivación",
      };
      for (const [field, messages] of Object.entries(profileError)) {
        const message = typeof messages === "string" ? messages
          : Array.isArray(messages) && typeof messages[0] === "string" ? messages[0] : null;
        if (message) return field === "non_field_errors" ? message : `${labels[field] ?? field}: ${message}`;
      }
    }
  }
  return getApiErrorMessage(error, "No se pudo completar el alta comercial. Revisa los datos e inténtalo otra vez.");
}

interface Props {
  user: AdminUser;
  saving: boolean;
  onSubmit: (profile: SellerOnboardingPayload) => Promise<boolean>;
  onCancel: () => void;
}

export function SellerOnboardingForm({ user, saving, onSubmit, onCancel }: Props) {
  const profile = user.seller_profile;
  const reactivating = profile?.is_active === false;
  const [businessName, setBusinessName] = useState(profile?.business_name ?? "");
  const [taxId, setTaxId] = useState(profile?.tax_id ?? "");
  const [description, setDescription] = useState(profile?.description ?? "");
  const [reactivate, setReactivate] = useState(false);
  const [error, setError] = useState("");
  const lifecycle = useRef({ active: true, pending: false });
  const nameInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const operation = { active: true, pending: false };
    lifecycle.current = operation;
    nameInput.current?.focus();
    return () => { operation.active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const operation = lifecycle.current;
    if (!operation.active || operation.pending || saving) return;
    const business_name = businessName.trim();
    const tax_id = taxId.trim();
    const descriptionValue = description.trim();
    if (business_name.length < 2 || business_name.length > 160) {
      setError("El nombre comercial debe tener entre 2 y 160 caracteres.");
      return;
    }
    if (tax_id.length > 30) {
      setError("La identificación fiscal no puede superar los 30 caracteres.");
      return;
    }
    if (descriptionValue.length > 5000) {
      setError("La descripción comercial no puede superar los 5000 caracteres.");
      return;
    }
    if (reactivating && !reactivate) {
      setError("Confirma la reactivación del perfil comercial para continuar.");
      return;
    }
    operation.pending = true;
    setError("");
    try {
      await onSubmit({ business_name, tax_id, description: descriptionValue,
        ...(reactivating ? { is_active: true as const } : {}),
      });
    } catch (requestError) {
      if (operation.active) setError(onboardingError(requestError));
    } finally {
      operation.pending = false;
    }
  }

  return (
    <form aria-label="Alta comercial del vendedor" noValidate onSubmit={submit}
      className="mt-6 space-y-4 rounded-xl border border-green-200 bg-green-50 p-5">
      <div>
        <h3 className="text-lg font-bold">{reactivating ? "Reactivar perfil vendedor" : "Completar alta comercial"}</h3>
        <p className="mt-1 text-sm text-gray-700">Cuenta: {user.email}</p>
        <p className="mt-1 text-sm text-gray-600">
          {reactivating ? "Confirma los datos y la reactivación para habilitar el portal vendedor."
            : "Registra los datos comerciales para habilitar el portal vendedor."}
        </p>
        {user.is_active === false && <p className="mt-2 text-sm text-amber-900">
          La cuenta de usuario está bloqueada. El alta comercial no la desbloquea; actívala desde su fila para permitir el acceso.
        </p>}
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <fieldset disabled={saving} className="space-y-4 disabled:opacity-60">
        <label className="block text-sm font-medium">
          Nombre comercial
          <input ref={nameInput} value={businessName} onChange={(event) => setBusinessName(event.target.value)}
            required minLength={2} maxLength={160} className="mt-1 block w-full rounded-lg border bg-white px-3 py-2" />
        </label>
        <label className="block text-sm font-medium">
          CUIT / identificación fiscal (opcional)
          <input value={taxId} onChange={(event) => setTaxId(event.target.value)} maxLength={30}
            className="mt-1 block w-full rounded-lg border bg-white px-3 py-2" />
        </label>
        <label className="block text-sm font-medium">
          Descripción comercial (opcional)
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={5000}
            rows={3} className="mt-1 block w-full rounded-lg border bg-white px-3 py-2" />
        </label>
        {reactivating && <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={reactivate} onChange={(event) => setReactivate(event.target.checked)} />
          Confirmo reactivar el perfil comercial
        </label>}
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded-lg border bg-white px-4 py-2">Cancelar alta</button>
          <button type="submit" className="rounded-lg bg-green-700 px-4 py-2 font-semibold text-white">
            {saving ? "Guardando alta..." : reactivating ? "Reactivar y habilitar vendedor" : "Guardar alta y habilitar vendedor"}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
