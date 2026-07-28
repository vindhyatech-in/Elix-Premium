from django.urls import path

from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('services-booking/', views.services_booking, name='services_booking'),
    path('robots.txt', views.robots_txt, name='robots_txt'),
    path('sitemap.xml', views.sitemap_xml, name='sitemap_xml'),
]
