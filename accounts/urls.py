from django.urls import path

from . import phone_login_views, views

urlpatterns = [
    path('booking/profile/', views.profile_view, name='profile'),
    path('booking/profile/delete/', views.delete_account, name='delete_account'),
    path('booking/addresses/', views.addresses_api, name='addresses_api'),
    path('booking/addresses/<int:address_id>/', views.address_delete, name='address_delete'),
    path('accounts/phone/login/', phone_login_views.request_phone_login, name='phone_login_request'),
    path('accounts/phone/login/confirm/', phone_login_views.confirm_phone_login, name='phone_login_confirm'),
]
