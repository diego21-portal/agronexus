import { createContext, useContext } from "react";

export interface NotificationContextValue {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
  resetUnreadCount: () => void;
}

export const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications debe utilizarse dentro de NotificationProvider.");
  return context;
}
