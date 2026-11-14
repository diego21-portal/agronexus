import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { ReactNode } from "react";
import { AuthContext } from "../auth/AuthContext";
import { NotificationProvider } from "./NotificationProvider";
import { useNotifications } from "./NotificationContext";
import { getUnreadNotifications } from "../../services/notificationService";
import { authValue, deferred } from "../../test/asyncFixtures";

vi.mock("../../services/notificationService", () => ({ getUnreadNotifications: vi.fn() }));
let session = authValue();
function Wrapper({ children }: { children: ReactNode }) {
  return <AuthContext.Provider value={session}><NotificationProvider>{children}</NotificationProvider></AuthContext.Provider>;
}
beforeEach(() => { vi.resetAllMocks(); session = authValue(); });
afterEach(() => vi.restoreAllMocks());

test("mantiene un solo intervalo y lo elimina al desmontar", async () => {
  const interval = vi.spyOn(window, "setInterval");
  const clear = vi.spyOn(window, "clearInterval");
  vi.mocked(getUnreadNotifications).mockResolvedValue({ count: 3, notifications: [] });
  const { result, rerender, unmount } = renderHook(() => useNotifications(), { wrapper: Wrapper });
  await waitFor(() => expect(result.current.unreadCount).toBe(3));
  const pollingIndex = interval.mock.calls.findIndex(([, delay]) => delay === 60000);
  const timer = interval.mock.results[pollingIndex].value;
  rerender();
  expect(interval.mock.calls.filter(([, delay]) => delay === 60000)).toHaveLength(1);
  expect(getUnreadNotifications).toHaveBeenCalledTimes(1);
  unmount();
  expect(clear).toHaveBeenCalledWith(timer);
});

test("cerrar sesión deja el contador en cero aunque llegue una respuesta anterior", async () => {
  const pending = deferred<Awaited<ReturnType<typeof getUnreadNotifications>>>();
  vi.mocked(getUnreadNotifications).mockReturnValue(pending.promise);
  const { result, rerender } = renderHook(() => useNotifications(), { wrapper: Wrapper });
  session = authValue(null);
  rerender();
  await act(async () => { pending.resolve({ count: 8, notifications: [] }); });
  expect(result.current.unreadCount).toBe(0);
});
