import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders } from "axios";
import { MemoryRouter } from "react-router";
import { beforeEach, expect, test, vi } from "vitest";
import { AuthContext } from "../../features/auth/AuthContext";
import { api } from "../../lib/api";
import { adminListResponse } from "../../test/adminFixtures";
import { authValue, deferred, testUser } from "../../test/asyncFixtures";
import type { AdminSellerProfile, AdminUser, AdminUserUpdate } from "../../types/admin";
import type { User } from "../../types/auth";
import { AdminUsersPage } from "./AdminUsersPage";

vi.mock("../../lib/api", () => ({ api: { get: vi.fn(), patch: vi.fn() } }));
const administrator: User = { ...testUser, id: 11, role: "ADMIN" };
const customer: AdminUser = {
  ...testUser, id: 7, role: "CUSTOMER", email: "alta@example.invalid",
  is_active: true, is_staff: false, is_superuser: false, seller_profile: null,
};
const profile: AdminSellerProfile = {
  id: 5, business_name: "Agro Comercio", tax_id: "20-12345678-9", description: "Insumos agrícolas",
  is_active: true, is_verified: false,
};

beforeEach(() => { vi.resetAllMocks(); });

function installUser(user: AdminUser = customer) {
  let updated: AdminUser = user;
  vi.mocked(api.get).mockImplementation(async () => (adminListResponse([updated])));
  vi.mocked(api.patch).mockImplementation(async (_url, data) => {
    const values = data as AdminUserUpdate;
    updated = { ...updated, ...values, seller_profile: values.seller_profile
      ? { ...profile, ...updated.seller_profile, ...values.seller_profile }
      : updated.seller_profile,
    };
    return { data: updated };
  });
}

function mount() {
  const wrapper = (user: User | null) => (
    <AuthContext.Provider value={authValue(user)}><MemoryRouter><AdminUsersPage /></MemoryRouter></AuthContext.Provider>
  );
  const view = render(wrapper(administrator));
  return { ...view, changeAccount: (user: User | null) => view.rerender(wrapper(user)) };
}

async function openRegistration() {
  await userEvent.selectOptions(await screen.findByRole("combobox", { name: `Rol de ${customer.email}` }), "SELLER");
  return screen.findByRole("form", { name: "Alta comercial del vendedor" });
}

test("seleccionar SELLER solicita datos, valida y permite cancelar sin cambiar el rol", async () => {
  installUser();
  mount();
  const form = await openRegistration();
  expect(screen.getByRole("combobox", { name: `Rol de ${customer.email}` })).toHaveValue("CUSTOMER");
  expect(api.patch).not.toHaveBeenCalled();
  await userEvent.click(within(form).getByRole("button", { name: "Guardar alta y habilitar vendedor" }));
  expect(within(form).getByRole("alert")).toHaveTextContent("El nombre comercial debe tener entre 2 y 160 caracteres.");
  expect(api.patch).not.toHaveBeenCalled();
  await userEvent.type(within(form).getByRole("textbox", { name: "Nombre comercial" }), "Comercio descartado");
  await userEvent.click(within(form).getByRole("button", { name: "Cancelar alta" }));
  expect(screen.queryByRole("form")).not.toBeInTheDocument();
  expect(api.patch).not.toHaveBeenCalled();
  const reopened = await openRegistration();
  expect(within(reopened).getByRole("textbox", { name: "Nombre comercial" })).toHaveValue("");
});

test("el alta envía los datos recortados y espera la respuesta confirmada sin duplicar solicitudes", async () => {
  installUser();
  const pending = deferred<{ data: AdminUser }>();
  vi.mocked(api.patch).mockReturnValueOnce(pending.promise);
  mount();
  const form = await openRegistration();
  fireEvent.change(within(form).getByRole("textbox", { name: "Nombre comercial" }), { target: { value: "  Agro Comercio  " } });
  fireEvent.change(within(form).getByRole("textbox", { name: /CUIT/ }), { target: { value: "  20-12345678-9  " } });
  fireEvent.change(within(form).getByRole("textbox", { name: /Descripción comercial/ }), { target: { value: "  Insumos agrícolas  " } });
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(api.patch).toHaveBeenCalledTimes(1);
  expect(api.patch).toHaveBeenCalledWith("/admin/users/7/", {
    role: "SELLER", seller_profile: { business_name: profile.business_name, tax_id: profile.tax_id, description: profile.description },
  });
  expect(within(form).getByRole("textbox", { name: "Nombre comercial" })).toBeDisabled();
  expect(screen.getByRole("combobox", { name: `Rol de ${customer.email}` })).toHaveValue("CUSTOMER");
  vi.mocked(api.get).mockResolvedValue(adminListResponse([{ ...customer, role: "SELLER", seller_profile: profile }]));
  await act(async () => pending.resolve({ data: { ...customer, role: "SELLER", seller_profile: profile } }));
  await waitFor(() => expect(screen.queryByRole("form")).not.toBeInTheDocument());
  expect(await screen.findByRole("combobox", { name: `Rol de ${customer.email}` })).toHaveValue("SELLER");
  expect(screen.queryByRole("button", { name: "Completar alta comercial" })).not.toBeInTheDocument();
});

test("un perfil comercial activo permite promoción directa conservando sus datos", async () => {
  installUser({ ...customer, seller_profile: profile });
  mount();
  await userEvent.selectOptions(await screen.findByRole("combobox", { name: `Rol de ${customer.email}` }), "SELLER");
  await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/admin/users/7/", { role: "SELLER" }));
  expect(screen.queryByRole("form")).not.toBeInTheDocument();
});

test("reactivar un perfil existente requiere confirmación explícita y conserva los datos comerciales", async () => {
  installUser({ ...customer, role: "SELLER", seller_profile: { ...profile, is_active: false } });
  mount();
  await userEvent.click(await screen.findByRole("button", { name: "Reactivar perfil vendedor" }));
  const form = screen.getByRole("form", { name: "Alta comercial del vendedor" });
  expect(within(form).getByRole("textbox", { name: "Nombre comercial" })).toHaveValue(profile.business_name);
  await userEvent.click(within(form).getByRole("button", { name: "Reactivar y habilitar vendedor" }));
  expect(within(form).getByRole("alert")).toHaveTextContent("Confirma la reactivación");
  expect(api.patch).not.toHaveBeenCalled();
  await userEvent.click(within(form).getByRole("checkbox", { name: "Confirmo reactivar el perfil comercial" }));
  await userEvent.click(within(form).getByRole("button", { name: "Reactivar y habilitar vendedor" }));
  await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/admin/users/7/", {
    role: "SELLER", seller_profile: { business_name: profile.business_name, tax_id: profile.tax_id, description: profile.description, is_active: true },
  }));
  await waitFor(() => expect(screen.queryByRole("form")).not.toBeInTheDocument());
});

test("una cuenta ya SELLER sin perfil puede completar el alta desde su fila", async () => {
  installUser({ ...customer, role: "SELLER" });
  mount();
  await userEvent.click(await screen.findByRole("button", { name: "Completar alta comercial" }));
  const form = screen.getByRole("form", { name: "Alta comercial del vendedor" });
  await userEvent.type(within(form).getByRole("textbox", { name: "Nombre comercial" }), "Agro Comercio");
  await userEvent.click(within(form).getByRole("button", { name: "Guardar alta y habilitar vendedor" }));
  await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/admin/users/7/", {
    role: "SELLER", seller_profile: { business_name: profile.business_name, tax_id: "", description: "" },
  }));
});

test.each([
  { kind: "lista del serializer", message: ["Indica el nombre comercial registrado."] },
  { kind: "mensaje del servicio", message: "Indica el nombre comercial registrado." },
])("un rechazo de validación muestra el campo comercial y permite reintentar ($kind)", async ({ message }) => {
  installUser();
  const config = { headers: new AxiosHeaders() };
  vi.mocked(api.patch).mockRejectedValueOnce(new AxiosError("Bad Request", "ERR_BAD_REQUEST", config, undefined, {
    data: { seller_profile: { business_name: message } },
    status: 400, statusText: "Bad Request", headers: {}, config,
  }));
  mount();
  const form = await openRegistration();
  await userEvent.type(within(form).getByRole("textbox", { name: "Nombre comercial" }), "Agro Comercio");
  await userEvent.click(within(form).getByRole("button", { name: "Guardar alta y habilitar vendedor" }));
  expect(await within(form).findByRole("alert")).toHaveTextContent("Nombre comercial: Indica el nombre comercial registrado.");
  expect(screen.getByRole("combobox", { name: `Rol de ${customer.email}` })).toHaveValue("CUSTOMER");
  expect(within(form).getByRole("textbox", { name: "Nombre comercial" })).toHaveValue("Agro Comercio");
  await userEvent.click(within(form).getByRole("button", { name: "Guardar alta y habilitar vendedor" }));
  await waitFor(() => expect(screen.queryByRole("form")).not.toBeInTheDocument());
  expect(api.patch).toHaveBeenCalledTimes(2);
});

test("el alta de una cuenta bloqueada informa que debe activarse y no solicita desbloquearla", async () => {
  installUser({ ...customer, is_active: false });
  mount();
  const form = await openRegistration();
  expect(within(form).getByText(/El alta comercial no la desbloquea/)).toBeInTheDocument();
  await userEvent.type(within(form).getByRole("textbox", { name: "Nombre comercial" }), "Agro Comercio");
  await userEvent.click(within(form).getByRole("button", { name: "Guardar alta y habilitar vendedor" }));
  await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/admin/users/7/", {
    role: "SELLER", seller_profile: { business_name: "Agro Comercio", tax_id: "", description: "" },
  }));
  await waitFor(() => expect(screen.queryByRole("form")).not.toBeInTheDocument());
  expect(screen.getByText("Bloqueado")).toBeInTheDocument();
});

test("cambiar de cuenta oculta el alta y un fallo tardío no contamina la sesión nueva", async () => {
  installUser();
  const pending = deferred<{ data: AdminUser }>();
  vi.mocked(api.patch).mockReturnValueOnce(pending.promise);
  const view = mount();
  const form = await openRegistration();
  await userEvent.type(within(form).getByRole("textbox", { name: "Nombre comercial" }), "Comercio privado anterior");
  await userEvent.click(within(form).getByRole("button", { name: "Guardar alta y habilitar vendedor" }));
  view.changeAccount({ ...administrator, id: 22 });
  expect(screen.queryByRole("form")).not.toBeInTheDocument();
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  await act(async () => pending.reject(new Error("Fallo de la cuenta anterior")));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  view.changeAccount(administrator);
  expect(screen.queryByDisplayValue("Comercio privado anterior")).not.toBeInTheDocument();
  expect(api.patch).toHaveBeenCalledTimes(1);
});
