from django.contrib import admin

from .models import ProductEvent, ProductEventDailySummary


@admin.register(ProductEvent)
class ProductEventAdmin(admin.ModelAdmin):
    list_display = (
        "event_name",
        "platform",
        "site",
        "surface",
        "result",
        "received_at",
    )
    list_filter = ("event_name", "platform", "site", "surface", "result")
    readonly_fields = (
        "event_name",
        "session_hash",
        "platform",
        "site",
        "surface",
        "result",
        "metadata",
        "received_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(ProductEventDailySummary)
class ProductEventDailySummaryAdmin(admin.ModelAdmin):
    list_display = (
        "date",
        "event_name",
        "platform",
        "site",
        "surface",
        "result",
        "event_count",
        "unique_sessions",
    )
    list_filter = ("date", "event_name", "platform", "site", "surface", "result")
    readonly_fields = (
        "date",
        "event_name",
        "platform",
        "site",
        "surface",
        "result",
        "event_count",
        "unique_sessions",
        "updated_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
