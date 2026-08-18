import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "../auth/AuthContext";

import { getUnreadNotifications } from "../../services/notificationService";

interface NotificationContextValue {
  unreadCount: number;

  refreshUnreadCount: () => Promise<void>;

  resetUnreadCount: () => void;
}

const NotificationContext =
  createContext<
    NotificationContextValue | undefined
  >(undefined);

export function NotificationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const {
    authenticated,
    loading: authLoading,
  } = useAuth();

  const [
    unreadCount,
    setUnreadCount,
  ] = useState(0);

  const refreshUnreadCount =
    useCallback(async () => {
      if (!authenticated) {
        setUnreadCount(0);
        return;
      }

      try {
        const data =
          await getUnreadNotifications();

        setUnreadCount(data.count);
      } catch {
        // El navbar no debe romperse
        // aunque falle el endpoint.
      }
    }, [authenticated]);

  function resetUnreadCount() {
    setUnreadCount(0);
  }

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!authenticated) {
      setUnreadCount(0);
      return;
    }

    void refreshUnreadCount();

    const interval =
      window.setInterval(() => {
        void refreshUnreadCount();
      }, 60000);

    return () => {
      window.clearInterval(interval);
    };
  }, [
    authenticated,
    authLoading,
    refreshUnreadCount,
  ]);

  const value =
    useMemo(
      () => ({
        unreadCount,
        refreshUnreadCount,
        resetUnreadCount,
      }),
      [
        unreadCount,
        refreshUnreadCount,
      ]
    );

  return (
    <NotificationContext.Provider
      value={value}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context =
    useContext(NotificationContext);

  if (!context) {
    throw new Error(
      "useNotifications debe utilizarse dentro de NotificationProvider."
    );
  }

  return context;
}