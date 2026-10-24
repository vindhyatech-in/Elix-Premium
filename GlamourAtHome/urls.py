"""
URL configuration for GlamourAtHome project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from api import razorpay_views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('i18n/', include('django.conf.urls.i18n')),
    path('accounts/', include('allauth.urls')),

    # Razorpay Standard Checkout endpoints & page
    path('api/create-order', razorpay_views.create_order, name='create_order_direct'),
    path('api/create-order/', razorpay_views.create_order, name='create_order'),
    path('api/verify-payment', razorpay_views.verify_payment, name='verify_payment_direct'),
    path('api/verify-payment/', razorpay_views.verify_payment, name='verify_payment'),
    path('checkout/', razorpay_views.checkout_page, name='checkout_page'),
    path('razorpay-checkout/', razorpay_views.checkout_page, name='razorpay_checkout_page'),

    path('api/v1/', include('api.urls')),
    path('', include('accounts.urls')),
    path('', include('bookings.urls')),
    path('', include('core.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATICFILES_DIRS[0])
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
