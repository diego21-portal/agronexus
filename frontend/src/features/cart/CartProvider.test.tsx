import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router";
import type { ReactNode } from "react";
import { AuthContext } from "../auth/AuthContext";
import { CartProvider } from "./CartProvider";
import { useCart } from "./CartContext";
import { CartPage } from "../../pages/CartPage";
import { addCartItem, getCart } from "../../services/cartService";
import { authValue, deferred, testUser } from "../../test/asyncFixtures";
import type { Cart } from "../../types/cart";

vi.mock("../../services/cartService", () => ({
  addCartItem: vi.fn(), getCart: vi.fn(), updateCartItem: vi.fn(),
  deleteCartItem: vi.fn(), clearCart: vi.fn(),
}));
const emptyCart: Cart = { id: 1, status: "ACTIVE", items: [], subtotal: "0.00" };
let session = authValue();
function Wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter><AuthContext.Provider value={session}><CartProvider>{children}</CartProvider></AuthContext.Provider></MemoryRouter>;
}
beforeEach(() => { vi.resetAllMocks(); session = authValue(); });

test("carga una vez y conserva las funciones en un render sin cambios", async () => {
  vi.mocked(getCart).mockResolvedValue(emptyCart);
  const { result, rerender } = renderHook(() => useCart(), { wrapper: Wrapper });
  await waitFor(() => expect(result.current.cart).toEqual(emptyCart));
  const refresh = result.current.refreshCart;
  rerender();
  expect(result.current.refreshCart).toBe(refresh);
  expect(getCart).toHaveBeenCalledTimes(1);
});

test("agrega un producto y recarga las cantidades del backend", async () => {
  const updated: Cart = { ...emptyCart, subtotal: "20.00", items: [{ id: 3, product_id: 7, quantity: 2, unit_price: "10.00" }] };
  vi.mocked(getCart).mockResolvedValueOnce(emptyCart).mockResolvedValueOnce(updated);
  const { result } = renderHook(() => useCart(), { wrapper: Wrapper });
  await waitFor(() => expect(result.current.cart).toEqual(emptyCart));
  await act(async () => { await result.current.addItem(7, 2); });
  expect(addCartItem).toHaveBeenCalledWith({ product_id: 7, quantity: 2 });
  expect(result.current.itemCount).toBe(2);
  expect(result.current.subtotal).toBe(20);
  expect(result.current.operationLoading).toBe(false);
});

test("una carga fallida muestra el error y permite reintentar sin decir que el carrito está vacío", async () => {
  vi.mocked(getCart).mockRejectedValueOnce(new Error("Sin conexión")).mockResolvedValueOnce(emptyCart);
  render(<CartPage />, { wrapper: Wrapper });
  expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo cargar el carrito.");
  expect(screen.queryByText("Tu carrito está vacío")).not.toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole("button", { name: "Reintentar" }));
  expect(await screen.findByText("Tu carrito está vacío")).toBeInTheDocument();
});

test("ignora el carrito que llega después de cerrar sesión", async () => {
  const pending = deferred<Cart>();
  vi.mocked(getCart).mockReturnValue(pending.promise);
  const { result, rerender } = renderHook(() => useCart(), { wrapper: Wrapper });
  session = authValue(null);
  rerender();
  await act(async () => { pending.resolve(emptyCart); });
  expect(result.current.cart).toBeNull();
  expect(result.current.itemCount).toBe(0);
});

test("cambiar de usuario descarta la respuesta pendiente del usuario anterior", async () => {
  const first = deferred<Cart>();
  const second = { ...emptyCart, id: 2 };
  vi.mocked(getCart).mockReturnValueOnce(first.promise).mockResolvedValueOnce(second);
  const { result, rerender } = renderHook(() => useCart(), { wrapper: Wrapper });
  session = authValue({ ...testUser, id: 2 });
  rerender();
  await waitFor(() => expect(result.current.cart?.id).toBe(2));
  await act(async () => { first.resolve(emptyCart); });
  expect(result.current.cart?.id).toBe(2);
});

test("una operación anterior no recarga el carrito después de cambiar de cuenta", async () => {
  const pending = deferred<Awaited<ReturnType<typeof addCartItem>>>();
  vi.mocked(getCart).mockResolvedValue(emptyCart);
  vi.mocked(addCartItem).mockReturnValue(pending.promise);
  const { result, rerender } = renderHook(() => useCart(), { wrapper: Wrapper });
  await waitFor(() => expect(result.current.cart).toEqual(emptyCart));
  let operation!: Promise<void>;
  act(() => { operation = result.current.addItem(7, 1); });
  session = authValue({ ...testUser, id: 2 });
  rerender();
  await waitFor(() => expect(getCart).toHaveBeenCalledTimes(2));
  await act(async () => { pending.resolve({ id: 1, quantity: 1, unit_price: "10.00" }); await operation; });
  expect(getCart).toHaveBeenCalledTimes(2);
});
