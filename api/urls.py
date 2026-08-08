from django.urls import path
from . import views

urlpatterns = [
    path('serviceability/', views.verify_serviceability, name='api_serviceability'),
    path('categories/', views.get_categories, name='api_categories'),
    path('services/', views.get_services, name='api_services'),
]
