from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    notification_type_display = serializers.CharField(
        source="get_notification_type_display",
        read_only=True,
    )

    class Meta:
        model = Notification
        fields = (
            "id",
            "notification_type",
            "notification_type_display",
            "title",
            "message",
            "is_read",
            "read_at",
            "related_object_type",
            "related_object_id",
            "action_url",
            "created_at",
            "updated_at",
        )


class NotificationReadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = (
            "is_read",
        )
        read_only_fields = (
            "is_read",
        )

    def update(self, instance, validated_data):
        instance.mark_as_read()
        return instance

    def to_representation(self, instance):
        return NotificationSerializer(instance, context=self.context).data