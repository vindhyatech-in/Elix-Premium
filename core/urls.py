from django.urls import path

from . import admin_dashboard_views, employee_dashboard_views, views

urlpatterns = [
    path('', views.index, name='index'),
    path('booking/', views.services_booking, name='services_booking'),
    path('services/<slug:slug>/', views.service_detail, name='service_detail'),
    path('robots.txt', views.robots_txt, name='robots_txt'),
    path('sitemap.xml', views.sitemap_xml, name='sitemap_xml'),
    # Owner / Admin Dashboard
    path('dashboard/', admin_dashboard_views.dashboard_overview, name='admin_dashboard_overview'),
    path('dashboard/bookings/', admin_dashboard_views.dashboard_bookings, name='admin_dashboard_bookings'),
    path('dashboard/services/', admin_dashboard_views.dashboard_services, name='admin_dashboard_services'),
    path('dashboard/packages/', admin_dashboard_views.dashboard_packages, name='admin_dashboard_packages'),
    path('dashboard/employees/', admin_dashboard_views.dashboard_employees, name='admin_dashboard_employees'),
    path('dashboard/categories/', admin_dashboard_views.dashboard_categories, name='admin_dashboard_categories'),
    path('dashboard/offers/', admin_dashboard_views.dashboard_offers, name='admin_dashboard_offers'),
    # Employee / Beautician Dashboard
    path('employee/', employee_dashboard_views.employee_dashboard, name='employee_dashboard'),
    path('employee/profile/', employee_dashboard_views.employee_profile_view, name='employee_profile'),
]
