from django.conf import settings
from django.contrib import admin
from django.contrib.staticfiles import views as staticfiles_views
from django.urls import path, include

from user import views as user
from user.view import wechat_bridge
from files.recording_media import recording_media
from files.views import open_file_url

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", include("guantou.urls")),
    path("", include("themes.urls")),
    path("", include("productanalytics.urls")),
    path("local-tools/", include("localtools.urls")),
    path("users/", include("user.urls", namespace="users")),
    path("login/wechat/bridge/availability", wechat_bridge.availability),
    path("login/wechat/bridge/start", wechat_bridge.start),
    path("login/wechat/bridge/details", wechat_bridge.details),
    path("login/wechat/bridge/confirm", wechat_bridge.confirm),
    path("login/wechat/bridge/exchange", wechat_bridge.exchange),
    path("login/wechat/bridge/cancel", wechat_bridge.cancel),
    path("login/", include("user.urls", namespace="login")),
    path("users", user.router_users),
    path("login", user.login),
    path("announcements", include("announcements.urls", namespace="announcements")),
    path("site-settings/", include("siteconfig.urls", namespace="siteconfig")),
    path("files", include("files.urls", namespace="files")),
    path("notifications", include("inbox.urls", namespace="inbox")),
    path(
        "files/recording-media/<uuid:asset_id>/",
        recording_media,
        name="recording-media",
    ),
    path("files/<type>/<id>/<Y>/<M>/<D>/<X>", open_file_url),
]

# Test and development deployments intentionally support Django's built-in
# server. Serve app-provided admin assets even when DEBUG stays disabled; real
# production deployments must serve STATIC_ROOT through their web server.
if settings.ENVIRONMENT != "production":
    urlpatterns.insert(
        0,
        path(
            "static/<path:path>",
            staticfiles_views.serve,
            {"insecure": True},
        ),
    )
