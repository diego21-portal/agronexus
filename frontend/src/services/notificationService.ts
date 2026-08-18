import { api } from "../lib/api";

import {
  extractResults,
  type ListResponse,
} from "../types/api";

import type {
  Notification,
  UnreadNotificationData,
} from "../types/notification";

export async function getNotifications(): Promise<
  Notification[]
> {
  const response =
    await api.get<ListResponse<Notification>>(
      "/notifications/"
    );

  return extractResults(response.data);
}

export async function getUnreadNotifications(): Promise<
  UnreadNotificationData
> {
  const response = await api.get<
    | ListResponse<Notification>
    | {
        count: number;
        results?: Notification[];
        notifications?: Notification[];
      }
  >("/notifications/unread/");

  const data = response.data;

  if (Array.isArray(data)) {
    return {
      count: data.length,
      notifications: data,
    };
  }

  if ("results" in data) {
    return {
      count:
        data.count ??
        data.results?.length ??
        0,

      notifications:
        data.results ?? [],
    };
  }

  if ("notifications" in data) {
    return {
      count:
        data.count ??
        data.notifications?.length ??
        0,

      notifications:
        data.notifications ?? [],
    };
  }

  return {
    count: data.count || 0,
    notifications: [],
  };
}

export async function markNotificationRead(
  notificationId: number
): Promise<Notification> {
  const response =
    await api.patch<Notification>(
      `/notifications/${notificationId}/read/`
    );

  return response.data;
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.patch(
    "/notifications/read-all/"
  );
}

export async function deleteNotification(
  notificationId: number
): Promise<void> {
  await api.delete(
    `/notifications/${notificationId}/`
  );
}