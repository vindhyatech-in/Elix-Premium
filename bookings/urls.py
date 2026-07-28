from django.urls import path

from . import views

urlpatterns = [
    path('services-booking/book/', views.create_booking, name='create_booking'),
]
