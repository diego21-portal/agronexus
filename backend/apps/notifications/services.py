from .models import Notification


def create_notification(
    user,
    title,
    message,
    notification_type=Notification.NotificationType.SYSTEM,
    related_object_type="",
    related_object_id=None,
    action_url="",
):
    if not user:
        return None

    return Notification.objects.create(
        user=user,
        title=title,
        message=message,
        notification_type=notification_type,
        related_object_type=related_object_type,
        related_object_id=related_object_id,
        action_url=action_url,
    )


def create_notifications_for_users(
    users,
    title,
    message,
    notification_type=Notification.NotificationType.SYSTEM,
    related_object_type="",
    related_object_id=None,
    action_url="",
):
    notifications = []

    for user in users:
        if user:
            notifications.append(
                Notification(
                    user=user,
                    title=title,
                    message=message,
                    notification_type=notification_type,
                    related_object_type=related_object_type,
                    related_object_id=related_object_id,
                    action_url=action_url,
                )
            )

    if notifications:
        return Notification.objects.bulk_create(notifications)

    return []