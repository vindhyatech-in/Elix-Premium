from django.urls import path
from . import views

urlpatterns = [
    path('serviceability/', views.verify_serviceability, name='api_serviceability'),
    path('categories/', views.get_categories, name='api_categories'),
    path('catalog/', views.catalog_view, name='api_catalog'),
    path('offers/', views.offers_view, name='api_offers'),

    path('auth/login/', views.auth_login, name='api_auth_login'),
    path('auth/logout/', views.auth_logout, name='api_auth_logout'),

    path('profile/', views.profile_view, name='api_profile'),
    path('addresses/', views.addresses_view, name='api_addresses'),
    path('addresses/<int:address_id>/', views.address_delete_view, name='api_address_delete'),

    path('bookings/', views.bookings_view, name='api_bookings'),
    path('bookings/checkout/', views.checkout_view, name='api_bookings_checkout'),
    path('bookings/<str:booking_number>/cancel/', views.booking_cancel_view, name='api_booking_cancel'),
]
