from django.urls import path

from . import views

urlpatterns = [
    path('booking/checkout/', views.create_booking, name='create_booking'),
    path('booking/my-bookings/', views.bookings_dashboard, name='bookings_dashboard'),
    path('booking/my-bookings/<str:booking_number>/cancel/', views.cancel_booking, name='cancel_booking'),
    path('booking/my-bookings/reviews/<int:item_id>/', views.submit_review, name='submit_review'),
]
