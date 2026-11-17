from django.urls import path

from . import views

app_name = "siteconfig"

urlpatterns = [
    path("announcements", views.announcements),
    path("featured-announcements", views.featured_announcements),
    path("carousel", views.carousel),
    path("capabilities", views.capabilities),
    path("product-profile", views.product_profile, name="product-profile"),
    path(
        "product-profile/<slug:key>",
        views.client_product_profile,
        name="client-product-profile",
    ),
]
