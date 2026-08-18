export interface Notification {
  id: number;

  type?: string;
  notification_type?: string;

  title: string;
  message: string;

  is_read: boolean;

  action_url?: string | null;

  related_object_type?: string | null;
  related_object_id?: number | null;

  created_at: string;
  read_at?: string | null;
}

export interface UnreadNotificationData {
  count: number;
  notifications: Notification[];
}