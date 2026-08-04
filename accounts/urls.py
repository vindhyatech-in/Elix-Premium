from django.urls import path

from . import views

urlpatterns = [
    path('services-booking/profile/', views.profile_view, name='profile'),
    path('services-booking/addresses/', views.addresses_api, name='addresses_api'),
    path('services-booking/addresses/<int:address_id>/', views.address_delete, name='address_delete'),
]
