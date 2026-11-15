import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import { getUnreadNotifications } from "../../services/notificationService";
import { NotificationContext, type NotificationContextValue } from "./NotificationContext";

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user, authenticated, loading: authLoading } = useAuth();
  const userId = user?.id;
  const [unreadCount, setUnreadCount] = useState(0);
  const account = useRef<number | undefined>(undefined);
  const requestVersion = useRef(0);

  const resetUnreadCount = useCallback(() => {
    requestVersion.current += 1;
    setUnreadCount(0);
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    if (!authenticated || userId === undefined || account.current !== userId) return;
    const version = ++requestVersion.current;
    try {
      const data = await getUnreadNotifications();
      if (version === requestVersion.current) setUnreadCount(data.count);
    } catch {
      // El contador conserva su último valor si falla una actualización.
    }
  }, [authenticated, userId]);

  useEffect(() => {
    account.current = userId;
    resetUnreadCount();
    let interval: number | undefined;
    if (!authLoading && authenticated) {
      void refreshUnreadCount();
      interval = window.setInterval(() => void refreshUnreadCount(), 60000);
    }
    return () => {
      window.clearInterval(interval);
      account.current = undefined;
      requestVersion.current += 1;
    };
  }, [userId, authenticated, authLoading, refreshUnreadCount, resetUnreadCount]);

  const value = useMemo<NotificationContextValue>(() => ({
    unreadCount, refreshUnreadCount, resetUnreadCount,
  }), [unreadCount, refreshUnreadCount, resetUnreadCount]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}
