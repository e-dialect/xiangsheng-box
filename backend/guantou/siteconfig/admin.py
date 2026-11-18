from django.contrib import admin

from . import profile_admin  # Registers the per-profile administration views.
from .models import SiteSettings


@admin.register(SiteSettings)
class SiteSettingsAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "announcements",
        "featured_announcements",
        "carousel",
        "remote_capabilities",
    )

    def has_add_permission(self, request):
        return not SiteSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False
