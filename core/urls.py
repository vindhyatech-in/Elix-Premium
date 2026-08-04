from django.urls import path

from . import admin_dashboard_views, employee_dashboard_views, views

urlpatterns = [
    path('', views.index, name='index'),
    path('services-booking/', views.services_booking, name='services_booking'),
    path('robots.txt', views.robots_txt, name='robots_txt'),
    path('sitemap.xml', views.sitemap_xml, name='sitemap_xml'),
    # Owner / Admin Dashboard
    path('owner-dashboard/', admin_dashboard_views.dashboard_overview, name='admin_dashboard_overview'),
    path('owner-dashboard/bookings/', admin_dashboard_views.dashboard_bookings, name='admin_dashboard_bookings'),
    path('owner-dashboard/services/', admin_dashboard_views.dashboard_services, name='admin_dashboard_services'),
    path('owner-dashboard/employees/', admin_dashboard_views.dashboard_employees, name='admin_dashboard_employees'),
    # Employee / Beautician Dashboard
    path('emp-dashboard/', employee_dashboard_views.employee_dashboard, name='employee_dashboard'),
]
