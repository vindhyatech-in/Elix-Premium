from django.urls import path

from . import views

urlpatterns = [
    path('booking/checkout/', views.create_booking, name='create_booking'),
    path('booking/razorpay/order/', views.create_razorpay_order, name='create_razorpay_order'),
    path('booking/my-bookings/', views.bookings_dashboard, name='bookings_dashboard'),
    path('booking/my-bookings/<str:booking_number>/cancel/', views.cancel_booking, name='cancel_booking'),
    path('booking/my-bookings/<str:booking_number>/reschedule/', views.reschedule_booking, name='reschedule_booking'),
    # invoice_preview shows the styled HTML receipt; booking_invoice_pdf serves the raw PDF download
    path('booking/my-bookings/<str:booking_number>/invoice/', views.invoice_preview, name='booking_invoice'),
    path('booking/my-bookings/<str:booking_number>/invoice/pdf/', views.booking_invoice_pdf, name='booking_invoice_pdf'),
    path('booking/my-bookings/reviews/<int:item_id>/', views.submit_review, name='submit_review'),
    path('booking/my-bookings/<str:booking_number>/feedback/', views.submit_booking_feedback, name='submit_booking_feedback'),
]

