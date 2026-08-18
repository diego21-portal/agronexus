from rest_framework import serializers
from django.utils import timezone

from .models import ProductQuestion

class ProductQuestionSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_slug = serializers.CharField(source="product.slug", read_only=True)
    user_name = serializers.SerializerMethodField()
    answered_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ProductQuestion
        fields = (
            "id",
            "product",
            "product_name",
            "product_slug",
            "user_name",
            "question",
            "answer",
            "answered_by_name",
            "answered_at",
            "status",
            "is_public",
            "created_at",
            "updated_at",
        )

    def get_user_name(self, obj):
        full_name = f"{obj.user.first_name} {obj.user.last_name}".strip()
        return full_name or obj.user.username

    def get_answered_by_name(self, obj):
        if not obj.answered_by:
            return None

        full_name = f"{obj.answered_by.first_name} {obj.answered_by.last_name}".split()
        return full_name or obj.answered_by.username            

class ProductQuestionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductQuestion
        fields = (
            "id",
            "question",
        )
        read_only_fields = ("id",)

    def validate_question(self, value):
        if not value.strip():
            raise serializers.ValidationError("La pregunta no puede estar vacía.")

        if len(value.strip()) < 5:
            raise serializers.ValidationError(
                "La pregunta debe tener al menos 5 caracteres."
            )

        return value.strip()

    def create(self, validated_data):
        request = self.context["request"]
        product = self.context["product"]

        question = ProductQuestion.objects.create(
            product=product,
            user=request.user,
            question=validated_data["question"],
        )

        from apps.notifications.models import Notification
        from apps.notifications.services import create_notification

        create_notification(
            user=product.seller.user,
            title="Nueva pregunta recibida",
            message=f"Recibiste una pregunta sobre {product.name}.",
            notification_type=Notification.NotificationType.QUESTION_CREATED,
            related_object_type="ProductQuestion",
            related_object_id=question.id,
            action_url=f"/seller/questions/{question.id}",
        )

        return question
    
    def to_representation(self, instance):
        return ProductQuestionSerializer(instance, context=self.context).data


class SellerQuestionAnswerSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductQuestion
        fields = (
            "answer",
            "is_public",
        )

    def validate_answer(self, value):
        if not value.strip():
            raise serializers.ValidationError("La respuesta no puede estar vacía.")

        if len(value.strip()) < 5:
            raise serializers.ValidationError(
                "La respuesta debe tener al menos 5 caracteres."
            )

        return value.strip()

    def update(self, instance, validated_data):
        request = self.context["request"]

        instance.answer = validated_data["answer"]
        instance.is_public = validated_data.get("is_public", instance.is_public)
        instance.status = ProductQuestion.Status.ANSWERED
        instance.answered_by = request.user
        instance.answered_at = timezone.now()
        instance.save(
            update_fields=[
                "answer",
                "is_public",
                "status",
                "answered_by",
                "answered_at",
                "updated_at",
            ]
        )

        from apps.notifications.models import Notification
        from apps.notifications.services import create_notification

        create_notification(
            user=instance.user,
            title="Tu pregunta fue respondida",
            message=f"El vendedor respondió tu pregunta sobre {instance.product.name}.",
            notification_type=Notification.NotificationType.QUESTION_ANSWERED,
            related_object_type="ProductQuestion",
            related_object_id=instance.id,
            action_url=f"/products/{instance.product.slug}",
        )        

        return instance

    def to_representation(self, instance):
        return ProductQuestionSerializer(instance, context=self.context).data