import { act, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, MemoryRouter, RouterProvider } from "react-router";
import { beforeEach, expect, test, vi } from "vitest";
import { AuthContext } from "../../features/auth/AuthContext";
import { api } from "../../lib/api";
import { authValue, deferred, testUser } from "../../test/asyncFixtures";
import { AdminPaymentsPage } from "./AdminPaymentsPage";
import { AdminShipmentsPage } from "./AdminShipmentsPage";
import { AdminUsersPage } from "./AdminUsersPage";
import { AdminSellersPage } from "./AdminSellersPage";
import { AdminProductsPage } from "./AdminProductsPage";
import { AdminOrderDetailPage } from "./AdminOrderDetailPage";
import type { User } from "../../types/auth";

vi.mock("../../lib/api", () => ({ api: { get: vi.fn(), patch: vi.fn() } }));
const admin: User = { ...testUser, id: 11, role: "ADMIN" };
const account = { ...testUser, id: 7, email: "cuenta@example.invalid", role: "CUSTOMER", is_active: true, is_superuser: false };
const payment = { id: 1, order: 8, order_number: "ORD-PRUEBA", status: "APPROVED", payment_method: "TRANSFER", amount: "120.50", transaction_code: "TX-PRUEBA" };
const shipment = { id: 2, order: 8, order_number: "ORD-PRUEBA", seller: 7, seller_name: "Agro Prueba", status: "IN_TRANSIT", tracking_code: "TRACK-PRUEBA", carrier: "Correo Prueba" };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.get).mockResolvedValue({ data: [] });
  vi.mocked(api.patch).mockResolvedValue({ data: {} });
});
function mount(element: React.ReactNode, user: User | null = admin) {
  const wrapper = (accountUser: User | null) => <AuthContext.Provider value={authValue(accountUser)}><MemoryRouter>{element}</MemoryRouter></AuthContext.Provider>;
  const view = render(wrapper(user));
  return { ...view, changeAccount: (next: User | null) => view.rerender(wrapper(next)) };
}

test.each([
  { name: "pagos", Component: AdminPaymentsPage, endpoint: "/admin/payments/", empty: "No hay pagos registrados.", row: payment },
  { name: "envíos", Component: AdminShipmentsPage, endpoint: "/admin/shipments/", empty: "No hay envíos registrados.", row: shipment },
])("$name distingue error de carga, permite reintentar y muestra DTO de la API", async ({ Component, endpoint, empty, row }) => {
  vi.mocked(api.get).mockRejectedValueOnce(new Error("Conexión fallida")).mockResolvedValueOnce({ data: [row] });
  mount(<Component />);
  expect(screen.getByRole("status")).toHaveTextContent("Cargando");
  expect(await screen.findByRole("alert")).toHaveTextContent("No se pudieron cargar");
  expect(screen.queryByText(empty)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  expect(await screen.findByText(/ORD-PRUEBA/)).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledWith(endpoint);
  expect(api.patch).not.toHaveBeenCalled();
});

test("un listado vacío de pagos tiene un estado propio", async () => {
  mount(<AdminPaymentsPage />);
  expect(await screen.findByText("No hay pagos registrados.")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("cambiar de cuenta elimina datos privados y descarta respuestas de la cuenta anterior", async () => {
  const old = deferred<{ data: typeof payment[] }>();
  vi.mocked(api.get).mockReturnValueOnce(old.promise).mockResolvedValueOnce({ data: [{ ...payment, order_number: "ORD-CUENTA-ACTUAL" }] });
  const view = mount(<AdminPaymentsPage />);
  view.changeAccount({ ...admin, id: 12 });
  expect(await screen.findByText("ORD-CUENTA-ACTUAL")).toBeInTheDocument();
  await act(async () => old.resolve({ data: [{ ...payment, order_number: "ORD-CUENTA-ANTERIOR" }] }));
  expect(screen.queryByText("ORD-CUENTA-ANTERIOR")).not.toBeInTheDocument();
  view.changeAccount(null);
  expect(screen.queryByText("ORD-CUENTA-ACTUAL")).not.toBeInTheDocument();
  expect(api.get).toHaveBeenCalledTimes(2);
});

test("las cuentas visibles se ocultan inmediatamente mientras carga la cuenta nueva", async () => {
  const next = deferred<{ data: typeof payment[] }>();
  vi.mocked(api.get).mockResolvedValueOnce({ data: [payment] }).mockReturnValueOnce(next.promise);
  const view = mount(<AdminPaymentsPage />);
  await screen.findByText("ORD-PRUEBA");
  view.changeAccount({ ...admin, id: 12 });
  expect(screen.queryByText("ORD-PRUEBA")).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Cargando");
  await act(async () => next.resolve({ data: [] }));
});

test("usuarios modifica role e is_active sin enviar privilegios Django", async () => {
  let updated = { ...account };
  vi.mocked(api.get).mockImplementation(async () => ({ data: [updated] }));
  vi.mocked(api.patch).mockImplementation(async (_url, payload) => {
    updated = { ...updated, ...(payload as Partial<typeof account>) };
    return { data: updated };
  });
  mount(<AdminUsersPage />);
  await userEvent.selectOptions(await screen.findByRole("combobox", { name: `Rol de ${account.email}` }), "LOGISTICS_OPERATOR");
  await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/admin/users/7/", { role: "LOGISTICS_OPERATOR" }));
  await userEvent.click(await screen.findByRole("button", { name: "Bloquear" }));
  await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/admin/users/7/", { is_active: false }));
  expect(await screen.findByText("Bloqueado")).toBeInTheDocument();
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
});

test("un rechazo de cambios en usuarios se muestra y preserva el estado confirmado", async () => {
  vi.mocked(api.get).mockResolvedValue({ data: [account] });
  vi.mocked(api.patch).mockRejectedValue(new Error("Rechazado"));
  mount(<AdminUsersPage />);
  await userEvent.click(await screen.findByRole("button", { name: "Bloquear" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo modificar el usuario.");
  expect(screen.getByText("Activo")).toBeInTheDocument();
});

test("verificar vendedor usa la ruta y el booleano de verificación", async () => {
  const seller = { id: 5, user: account, business_name: "Agro Prueba", is_verified: false, is_active: true };
  vi.mocked(api.get).mockResolvedValueOnce({ data: [seller] }).mockResolvedValueOnce({ data: [{ ...seller, is_verified: true }] });
  mount(<AdminSellersPage />);
  await userEvent.click(await screen.findByRole("button", { name: "Verificar vendedor" }));
  expect(api.patch).toHaveBeenCalledWith("/admin/sellers/5/verify/", { is_verified: true });
  expect(await screen.findByText("Verificado")).toBeInTheDocument();
});

test("activar producto cambia solo is_active y conserva el estado publicado", async () => {
  const product = { id: 9, name: "Filtro agrícola", sku: "F-9", seller: { business_name: "Agro Prueba" }, price: "120.00", current_price: "100.00", stock: 3, status: "PUBLISHED", is_active: true };
  vi.mocked(api.get).mockResolvedValueOnce({ data: [product] }).mockResolvedValueOnce({ data: [{ ...product, is_active: false }] });
  mount(<AdminProductsPage />);
  await userEvent.click(await screen.findByRole("button", { name: "Desactivar" }));
  expect(api.patch).toHaveBeenCalledWith("/admin/products/9/", { is_active: false });
  expect(await screen.findByText("Inactivo")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Activar" })).toBeInTheDocument();
});

test("una mutación de la cuenta anterior no refresca la lista de la cuenta nueva", async () => {
  const old = deferred<{ data: typeof account }>();
  vi.mocked(api.get).mockResolvedValue({ data: [account] });
  vi.mocked(api.patch).mockReturnValueOnce(old.promise);
  const view = mount(<AdminUsersPage />);
  await userEvent.click(await screen.findByRole("button", { name: "Bloquear" }));
  view.changeAccount({ ...admin, id: 12 });
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  await act(async () => old.resolve({ data: account }));
  expect(api.get).toHaveBeenCalledTimes(2);
});

test("cambiar el rol propio actualiza la sesión y oculta administración sin recargar datos privados", async () => {
  const ownAccount = { ...admin, is_active: true, is_superuser: false };
  const otherAdmin = { ...ownAccount, id: 22, email: "otro-admin@example.invalid" };
  const refresh = vi.fn();
  vi.mocked(api.get).mockImplementation(async (url) => ({ data:
    url === "/users/me/" ? { ...admin, role: "CUSTOMER" } : [ownAccount, otherAdmin],
  }));
  vi.mocked(api.patch).mockResolvedValue({ data: { ...ownAccount, role: "CUSTOMER" } });

  function AccountSession() {
    const [user, setUser] = useState<User>(admin);
    return (
      <AuthContext.Provider value={{ ...authValue(user), refreshUser: async () => {
        refresh();
        const response = await api.get<User>("/users/me/");
        setUser(response.data);
      } }}>
        <p>Rol de sesión: {user.role}</p>
        <MemoryRouter><AdminUsersPage /></MemoryRouter>
      </AuthContext.Provider>
    );
  }

  render(<AccountSession />);
  await screen.findByText(otherAdmin.email);
  expect(screen.getAllByRole("button", { name: "Bloquear" })[0]).toBeDisabled();
  await userEvent.selectOptions(screen.getByRole("combobox", { name: `Rol de ${admin.email}` }), "CUSTOMER");

  expect(await screen.findByText("Rol de sesión: CUSTOMER")).toBeInTheDocument();
  expect(api.patch).toHaveBeenCalledWith("/admin/users/11/", { role: "CUSTOMER" });
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(api.get).toHaveBeenCalledWith("/users/me/");
  expect(screen.queryByText(otherAdmin.email)).not.toBeInTheDocument();
  expect(screen.queryByRole("combobox", { name: `Rol de ${admin.email}` })).not.toBeInTheDocument();
  expect(vi.mocked(api.get).mock.calls.filter(([url]) => url === "/admin/users/")).toHaveLength(1);
});

test("el detalle administrativo descarta un pedido tardío al cambiar de URL y permite reintentar", async () => {
  const old = deferred<{ data: unknown }>();
  const order = { id: 2, order_number: "ORD-ACTUAL", status: "PAID", total: "120.50", created_at: "2026-11-01T12:00:00Z", items: [], shipments: [], payment: null, shipping_address_snapshot: null, shipping_address_snapshot_source: "LEGACY_UNKNOWN" };
  vi.mocked(api.get).mockImplementation(async (url) => url === "/admin/orders/1/" ? old.promise : { data: order });
  const router = createMemoryRouter([{ path: "/admin/orders/:orderId", element: <AdminOrderDetailPage /> }], { initialEntries: ["/admin/orders/1"] });
  render(<AuthContext.Provider value={authValue(admin)}><RouterProvider router={router} /></AuthContext.Provider>);
  await waitFor(() => expect(api.get).toHaveBeenCalledWith("/admin/orders/1/"));
  await act(async () => { await router.navigate("/admin/orders/2"); });
  expect(await screen.findByRole("heading", { name: "ORD-ACTUAL" })).toBeInTheDocument();
  await act(async () => old.resolve({ data: { ...order, order_number: "ORD-ANTERIOR" } }));
  expect(screen.queryByText("ORD-ANTERIOR")).not.toBeInTheDocument();
  expect(screen.getByText(/no conserva una copia verificable/)).toBeInTheDocument();
  vi.mocked(api.get).mockRejectedValueOnce(new Error("Conexión fallida")).mockResolvedValueOnce({ data: order });
  await act(async () => { await router.navigate("/admin/orders/3"); });
  expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo cargar la orden.");
  expect(screen.queryByText("ORD-ACTUAL")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  expect(await screen.findByRole("heading", { name: "ORD-ACTUAL" })).toBeInTheDocument();
});
