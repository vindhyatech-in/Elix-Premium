from django.urls import path
from . import razorpay_views, views

urlpatterns = [
    path('serviceability/', views.verify_serviceability, name='api_serviceability'),
    path('categories/', views.get_categories, name='api_categories'),
    path('catalog/', views.catalog_view, name='api_catalog'),
    path('offers/', views.offers_view, name='api_offers'),
    path('validate-coupon/', views.validate_coupon_view, name='api_validate_coupon'),
    path('home/', views.home_view, name='api_home'),
    path('beauticians/', views.beauticians_view, name='api_beauticians'),

    path('auth/login/', views.auth_login, name='api_auth_login'),
    path('auth/signup/', views.auth_signup, name='api_auth_signup'),
    path('auth/phone/request/', views.auth_phone_request, name='api_auth_phone_request'),
    path('auth/phone/verify/', views.auth_phone_verify, name='api_auth_phone_verify'),
    path('auth/logout/', views.auth_logout, name='api_auth_logout'),
    path('auth/social-callback/', views.auth_social_callback, name='api_auth_social_callback'),

    path('profile/', views.profile_view, name='api_profile'),
    path('addresses/', views.addresses_view, name='api_addresses'),
    path('addresses/<int:address_id>/', views.address_delete_view, name='api_address_delete'),

    path('maps/reverse-geocode/', views.maps_reverse_geocode, name='api_maps_reverse_geocode'),
    path('maps/places-autocomplete/', views.maps_places_autocomplete, name='api_maps_places_autocomplete'),
    path('maps/place-details/', views.maps_place_details, name='api_maps_place_details'),
    path('maps/nearby/', views.maps_search_nearby, name='api_maps_search_nearby'),

    path('bookings/', views.bookings_view, name='api_bookings'),
    path('bookings/checkout/', views.checkout_view, name='api_bookings_checkout'),
    path('bookings/<str:booking_number>/cancel/', views.booking_cancel_view, name='api_booking_cancel'),

    path('payments/razorpay/create-order/', views.razorpay_create_order, name='api_razorpay_create_order'),
    path('payments/razorpay/verify/', views.razorpay_verify, name='api_razorpay_verify'),

    path('create-order/', razorpay_views.create_order, name='api_v1_create_order'),
    path('verify-payment/', razorpay_views.verify_payment, name='api_v1_verify_payment'),
]
