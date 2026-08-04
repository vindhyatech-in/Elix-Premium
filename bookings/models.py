import secrets
from datetime import datetime, time, timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone

# Each regular time_slot's own start time — used to compute a concrete
# datetime a booking is "for", since only exact_time exists on urgent
# bookings. Mirrors the windows in Booking.SLOT_CHOICES below.
SLOT_START_TIMES = {
    'morning': time(8, 0),
    'afternoon': time(12, 0),
    'evening': time(16, 0),
}

# How far ahead of the scheduled time a booking can still be cancelled.
CANCELLATION_CUTOFF = timedelta(hours=3)


def _generate_booking_number():
    """Same GAH###### shape the client-side mock used before real
    persistence existed — collision-checked since it's user-facing and
    must be unique, unlike the old Math.random()-based client id."""
    while True:
        candidate = f'GAH{secrets.randbelow(900000) + 100000}'
        if not Booking.objects.filter(booking_number=candidate).exists():
            return candidate


class Booking(models.Model):
    TYPE_CHOICES = [
        ('regular', 'Regular'),
        ('urgent', 'Urgent'),
    ]
    SLOT_CHOICES = [
        ('morning', 'Morning (8 AM – 12 PM)'),
        ('afternoon', 'Afternoon (12 PM – 4 PM)'),
        ('evening', 'Evening (4 PM – 8 PM)'),
    ]
    PAYMENT_METHOD_CHOICES = [
        ('pay_now', 'Pay Now'),
        ('pay_at_home', 'Pay At Home'),
    ]
    PAYMENT_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('failed', 'Failed'),
    ]
    STATUS_CHOICES = [
        ('upcoming', 'Upcoming'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    booking_number = models.CharField(max_length=20, unique=True, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='bookings')
    assigned_beautician = models.ForeignKey(
        'accounts.Employee', on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_bookings'
    )

    # Snapshotted, not just an FK to a saved Address — a booking must stay
    # accurate even if the address is later edited/deleted. See
    # developed.md "Catalog & Bookings models".
    address_label = models.CharField(max_length=60)
    address_text = models.TextField()
    address_pincode = models.CharField(max_length=10, blank=True)
    address_lat = models.FloatField(null=True, blank=True)
    address_lng = models.FloatField(null=True, blank=True)

    scheduled_date = models.DateField()
    booking_type = models.CharField(max_length=10, choices=TYPE_CHOICES, default='regular')
    time_slot = models.CharField(max_length=10, choices=SLOT_CHOICES, blank=True)
    exact_time = models.TimeField(null=True, blank=True)

    payment_method = models.CharField(max_length=15, choices=PAYMENT_METHOD_CHOICES)
    payment_status = models.CharField(max_length=10, choices=PAYMENT_STATUS_CHOICES, default='pending')

    # Snapshotted amounts — recomputed server-side at booking time from real
    # ServiceVariant prices, then frozen here. A later price/coupon change
    # must never alter a past booking's receipt.
    subtotal = models.DecimalField(max_digits=9, decimal_places=2)
    discount_amount = models.DecimalField(max_digits=9, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=9, decimal_places=2)
    coupon_code = models.CharField(max_length=30, blank=True)

    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='upcoming')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.booking_number:
            self.booking_number = _generate_booking_number()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.booking_number

    @property
    def scheduled_start(self):
        """The concrete datetime this booking is actually for — a regular
        booking only stores a time_slot (a window, not a moment), so this
        uses that slot's own start time; an urgent booking already has a
        real exact_time. Only meaningful thing this is used for today is
        can_cancel below (USE_TZ=False, so plain naive datetimes throughout
        — no timezone.make_aware() needed)."""
        slot_time = self.exact_time if self.booking_type == 'urgent' and self.exact_time else SLOT_START_TIMES.get(self.time_slot, time(0, 0))
        return datetime.combine(self.scheduled_date, slot_time)

    @property
    def can_cancel(self):
        """Only an 'upcoming' booking, and only until CANCELLATION_CUTOFF
        (3h) before it starts — see developed.md "Bookings dashboard"."""
        return self.status == 'upcoming' and timezone.now() <= self.scheduled_start - CANCELLATION_CUTOFF


class BookingItem(models.Model):
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name='items')
    service_variant = models.ForeignKey(
        'catalog.ServiceVariant', on_delete=models.SET_NULL, null=True, blank=True, related_name='booking_items',
    )
    # Snapshotted for the same reason as Booking's amounts above — a
    # deleted/repriced variant must not change what a past booking shows.
    name_snapshot = models.CharField(max_length=140)
    price_snapshot = models.DecimalField(max_digits=8, decimal_places=2)
    duration_snapshot = models.PositiveIntegerField()
    quantity = models.PositiveSmallIntegerField(default=1)

    def __str__(self):
        return f'{self.name_snapshot} x{self.quantity}'
