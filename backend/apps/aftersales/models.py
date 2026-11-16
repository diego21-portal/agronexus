from django.conf import settings
from django.db import models
from django.db.models import F, Q

from apps.core.models import TimeStampedModel


class CancellationRequest(TimeStampedModel):
    class Status(models.TextChoices):
        REQUESTED = "REQUESTED", "Solicitada"
        RETURNING = "RETURNING", "Retorno en camino"
        RECEIVED = "RECEIVED", "Productos recibidos"
        INSPECTED = "INSPECTED", "Inspección completada"
        COMPLETED = "COMPLETED", "Cancelación completada"
        REJECTED = "REJECTED", "Rechazada"
        WITHDRAWN = "WITHDRAWN", "Desistida por el cliente"

    shipment = models.ForeignKey(
        "shipments.Shipment", on_delete=models.PROTECT, related_name="cancellations",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="cancellations",
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.REQUESTED)
    reason = models.TextField(max_length=1000)
    resolution = models.TextField(blank=True)
    admin_note = models.TextField(blank=True)
    is_pre_dispatch = models.BooleanField(default=False)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="resolved_cancellations",
    )

    class Meta:
        ordering = ["-created_at", "-pk"]
        constraints = [
            models.UniqueConstraint(
                fields=["shipment"],
                condition=Q(status__in=["REQUESTED", "RETURNING", "RECEIVED", "INSPECTED"]),
                name="one_active_cancellation_per_shipment",
            ),
        ]

    def __str__(self):
        return f"Cancelación {self.pk} - {self.status}"


class CancellationEvent(TimeStampedModel):
    cancellation_request = models.ForeignKey(
        CancellationRequest, on_delete=models.CASCADE, related_name="events",
    )
    status = models.CharField(max_length=20, choices=CancellationRequest.Status.choices)
    action = models.CharField(max_length=30)
    description = models.CharField(max_length=1000)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="cancellation_events",
    )

    class Meta:
        ordering = ["created_at", "pk"]


class ReturnInspection(TimeStampedModel):
    cancellation_request = models.ForeignKey(
        CancellationRequest, on_delete=models.PROTECT, null=True, blank=True,
        related_name="inspections",
    )
    return_request = models.OneToOneField(
        "complaints.ReturnRequest", on_delete=models.PROTECT, null=True, blank=True,
        related_name="inspection",
    )
    order_item = models.ForeignKey(
        "orders.OrderItem", on_delete=models.PROTECT, related_name="return_inspections",
    )
    expected_quantity = models.PositiveIntegerField()
    received_quantity = models.PositiveIntegerField(default=0)
    restocked_quantity = models.PositiveIntegerField(default=0)
    defective_quantity = models.PositiveIntegerField(default=0)
    note = models.TextField(blank=True)
    received_at = models.DateTimeField(null=True, blank=True)
    inspected_at = models.DateTimeField(null=True, blank=True)
    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="received_return_inspections",
    )
    inspected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="completed_return_inspections",
    )

    class Meta:
        ordering = ["order_item_id"]
        constraints = [
            models.CheckConstraint(
                condition=(Q(cancellation_request__isnull=False, return_request__isnull=True)
                           | Q(cancellation_request__isnull=True, return_request__isnull=False)),
                name="inspection_has_one_source",
            ),
            models.CheckConstraint(condition=Q(expected_quantity__gt=0), name="inspection_expected_positive"),
            models.CheckConstraint(condition=Q(received_quantity__lte=F("expected_quantity")), name="inspection_received_bounded"),
            models.CheckConstraint(
                condition=Q(received_quantity__gte=F("restocked_quantity") + F("defective_quantity")),
                name="inspection_disposition_bounded",
            ),
            models.UniqueConstraint(
                fields=["cancellation_request", "order_item"],
                condition=Q(cancellation_request__isnull=False), name="one_cancellation_item_inspection",
            ),
        ]

    @property
    def quarantined_quantity(self):
        return self.received_quantity - self.restocked_quantity - self.defective_quantity
