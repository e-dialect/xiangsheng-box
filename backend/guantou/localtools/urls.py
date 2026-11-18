from django.urls import path

from .views import LocalToolPacks

urlpatterns = [path("", LocalToolPacks.as_view(), name="local-tool-packs")]
