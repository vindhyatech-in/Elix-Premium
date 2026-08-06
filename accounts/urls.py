from django.urls import path

from . import views

urlpatterns = [
    path('booking/profile/', views.profile_view, name='profile'),
    path('booking/addresses/', views.addresses_api, name='addresses_api'),
    path('booking/addresses/<int:address_id>/', views.address_delete, name='address_delete'),
]
