from django.urls import path

from . import views

urlpatterns = [
    path('services-booking/book/', views.create_booking, name='create_booking'),
    path('services-booking/bookings/', views.bookings_dashboard, name='bookings_dashboard'),
    path('services-booking/bookings/<str:booking_number>/cancel/', views.cancel_booking, name='cancel_booking'),
]
