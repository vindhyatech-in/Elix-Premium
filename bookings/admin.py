from django.contrib import admin

from .models import Booking, BookingItem


class BookingItemInline(admin.TabularInline):
    model = BookingItem
    extra = 0
    readonly_fields = ('service_variant', 'name_snapshot', 'price_snapshot', 'duration_snapshot', 'quantity')
    can_delete = False


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = (
        'booking_number', 'user', 'scheduled_date', 'booking_type', 'time_slot',
        'payment_method', 'payment_status', 'total_amount', 'status', 'created_at',
    )
    list_filter = ('status', 'payment_status', 'payment_method', 'booking_type')
    search_fields = ('booking_number', 'user__email', 'address_text')
    readonly_fields = (
        'booking_number', 'subtotal', 'discount_amount', 'total_amount',
        'address_label', 'address_text', 'address_pincode', 'address_lat', 'address_lng',
        'created_at', 'updated_at',
    )
    inlines = [BookingItemInline]
