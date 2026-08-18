import {
  useEffect,
  useState,
} from "react";

import { Link } from "react-router";

import {
  useNotifications,
} from "../features/notifications/NotificationContext";

import {
  deleteNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notificationService";

import type {
  Notification,
} from "../types/notification";

import {
  getApiErrorMessage,
} from "../utils/apiError";

export function NotificationsPage() {
  const [
    notifications,
    setNotifications,
  ] = useState<Notification[]>(
    []
  );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const {
    refreshUnreadCount,
  } = useNotifications();

  async function loadNotifications() {
    try {
      setLoading(true);
      setError("");

      setNotifications(
        await getNotifications()
      );
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "No se pudieron cargar las notificaciones."
        )
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadNotifications();
  }, []);

  async function handleRead(
    notification: Notification
  ) {
    if (
      notification.is_read
    ) {
      return;
    }

    try {
      await markNotificationRead(
        notification.id
      );

      setNotifications(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              notification.id
                ? {
                    ...item,
                    is_read: true,
                  }
                : item
          )
      );

      await refreshUnreadCount();
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "No se pudo actualizar la notificación."
        )
      );
    }
  }

  async function handleReadAll() {
    try {
      await markAllNotificationsRead();

      setNotifications(
        (current) =>
          current.map(
            (item) => ({
              ...item,
              is_read: true,
            })
          )
      );

      await refreshUnreadCount();
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "No se pudieron marcar las notificaciones."
        )
      );
    }
  }

  async function handleDelete(
    notificationId: number
  ) {
    try {
      await deleteNotification(
        notificationId
      );

      setNotifications(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              notificationId
          )
      );

      await refreshUnreadCount();
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "No se pudo eliminar la notificación."
        )
      );
    }
  }

  const unread =
    notifications.filter(
      (notification) =>
        !notification.is_read
    ).length;

  return (
    <section className="mx-auto max-w-4xl">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-green-700">
            Actividad
          </p>

          <h1 className="mt-2 text-3xl font-bold">
            Notificaciones
          </h1>

          <p className="mt-2 text-gray-600">
            {unread} sin leer
          </p>
        </div>

        {unread > 0 && (
          <button
            type="button"
            onClick={
              handleReadAll
            }
            className="rounded-lg border border-green-700 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-50"
          >
            Marcar todas como
            leídas
          </button>
        )}
      </div>

      {error && (
        <div className="mt-6 rounded-xl bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-7 space-y-3">
          {Array.from({
            length: 5,
          }).map((_, index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-2xl bg-gray-200"
            />
          ))}
        </div>
      ) : notifications.length ===
        0 ? (
        <div className="mt-7 rounded-2xl bg-white p-10 text-center shadow-sm">
          <div className="text-5xl">
            🔔
          </div>

          <h2 className="mt-4 text-xl font-bold">
            Todo tranquilo
          </h2>

          <p className="mt-2 text-gray-600">
            No tenés notificaciones
            por el momento.
          </p>
        </div>
      ) : (
        <div className="mt-7 space-y-3">
          {notifications.map(
            (notification) => (
              <article
                key={
                  notification.id
                }
                className={
                  notification.is_read
                    ? "rounded-2xl border border-gray-200 bg-white p-5"
                    : "rounded-2xl border border-green-200 bg-green-50 p-5 shadow-sm"
                }
              >
                <div className="flex gap-4">
                  <div
                    className={
                      notification.is_read
                        ? "mt-1 h-3 w-3 shrink-0 rounded-full bg-gray-300"
                        : "mt-1 h-3 w-3 shrink-0 rounded-full bg-green-600"
                    }
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col justify-between gap-2 sm:flex-row">
                      <h2 className="font-bold">
                        {
                          notification.title
                        }
                      </h2>

                      <time className="shrink-0 text-xs text-gray-500">
                        {new Date(
                          notification.created_at
                        ).toLocaleString(
                          "es-AR"
                        )}
                      </time>
                    </div>

                    <p className="mt-2 text-sm leading-6 text-gray-700">
                      {
                        notification.message
                      }
                    </p>

                    <div className="mt-4 flex flex-wrap gap-4 text-sm">
                      {notification.action_url && (
                        <Link
                          to={
                            notification.action_url
                          }
                          onClick={() =>
                            handleRead(
                              notification
                            )
                          }
                          className="font-semibold text-green-700"
                        >
                          Ver detalle
                        </Link>
                      )}

                      {!notification.is_read && (
                        <button
                          type="button"
                          onClick={() =>
                            handleRead(
                              notification
                            )
                          }
                          className="font-medium text-gray-600"
                        >
                          Marcar como
                          leída
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          handleDelete(
                            notification.id
                          )
                        }
                        className="font-medium text-red-600"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            )
          )}
        </div>
      )}
    </section>
  );
}