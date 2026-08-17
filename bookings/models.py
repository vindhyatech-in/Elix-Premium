import secrets

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


def _generate_booking_number():
    """Same ELX###### shape the client-side mock used before real
    persistence existed — collision-checked since it's user-facing and
    must be unique, unlike the old Math.random()-based client id."""
    while True:
        candidate = f'ELX{secrets.randbelow(900000) + 100000}'
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
    # Labels only — DB values stay as-is (upcoming/in_progress) so every
    # existing filter(status='upcoming')/etc. across views/templates/admin
    # keeps working unchanged; 'on_the_way' is the one genuinely new value,
    # inserted between them. See core/employee_dashboard_views.py for the
    # full flow: Pending -> On The Way -> (arrival photo + customer OTP) ->
    # Job Started -> Completed.
    STATUS_CHOICES = [
        ('upcoming', 'Pending'),
        ('on_the_way', 'On The Way'),
        ('in_progress', 'Job Started'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    booking_number = models.CharField(max_length=20, unique=True, editable=False)
    # SET_NULL, not CASCADE — a customer deleting their own account (see
    # accounts/views.py::delete_account) must not also erase real revenue/
    # order history; the booking row (and its items/amounts) survives with
    # user=None. Reviews still cascade away with the account (Review.user
    # stays CASCADE) since those are opinion, not a financial record.
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='bookings')
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
    # Populated only for payment_method='pay_now', after the signature
    # verification in bookings/views.py::create_booking passes — kept for
    # support/refund lookups against the Razorpay dashboard.
    razorpay_order_id = models.CharField(max_length=40, blank=True)
    razorpay_payment_id = models.CharField(max_length=40, blank=True)

    # Snapshotted amounts — recomputed server-side at booking time from real
    # ServiceVariant prices, then frozen here. A later price/coupon change
    # must never alter a past booking's receipt.
    subtotal = models.DecimalField(max_digits=9, decimal_places=2)
    discount_amount = models.DecimalField(max_digits=9, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=9, decimal_places=2)
    coupon_code = models.CharField(max_length=30, blank=True)

    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='upcoming')

    # Arrival verification — deliberately NOT matched against
    # Employee.face_photo_* by any ML/face-recognition today ("for now,
    # just save the image" — a future upgrade, not implied by this field
    # existing). It's a human-checkable record: if a customer disputes who
    # showed up, the owner has a timestamped photo to look at. The actual
    # gate that lets the employee move past "On The Way" is the OTP below,
    # not this photo.
    verification_photo = models.ImageField(upload_to='job_verification/%Y/%m/', max_length=255, null=True, blank=True)

    # OTP the customer reads out to the employee to confirm they're ready
    # to start — shown on the customer's own /booking/my-bookings/ page
    # while status is 'on_the_way' (no SMS/email gateway configured yet,
    # see developed.md; swapping in real SMS delivery later doesn't need
    # to touch this field, just where/how it's shown to the customer).
    start_otp = models.CharField(max_length=6, blank=True)
    otp_generated_at = models.DateTimeField(null=True, blank=True)
    otp_verified_at = models.DateTimeField(null=True, blank=True)
    # A 6-digit code with no attempt cap is guessable within its 20-minute
    # validity window at a high enough request rate — locks out after 5
    # wrong guesses (see employee_dashboard_views.py::verify_start_otp),
    # reset to 0 whenever a fresh code is generated.
    otp_failed_attempts = models.PositiveSmallIntegerField(default=0)

    # One overall write-up for the whole order — separate from each
    # BookingItem's own star `Review` (see Review model below). A
    # multi-item order earning 5 individual star ratings but only one
    # free-text comment about the visit as a whole reads far more
    # naturally than the same text repeated under every item, or forcing
    # a customer to write several near-identical paragraphs.
    feedback_comment = models.TextField(blank=True)
    feedback_submitted_at = models.DateTimeField(null=True, blank=True)
    rescheduled_at = models.DateTimeField(null=True, blank=True)

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
    def can_cancel(self):
        """Cancellable any time up until the beautician marks arrival —
        once status leaves 'upcoming' (on_the_way/in_progress/etc.), the
        job is already in motion and can no longer be self-cancelled."""
        return self.status == 'upcoming'

    @property
    def customer_display_name(self):
        """First name (falling back to username), or a placeholder once
        the account has been deleted (user=None — see accounts/views.py::
        delete_account, and Booking.user's on_delete=SET_NULL). Exists
        because `{{ booking.user.first_name|default:booking.user.username }}`
        crashes once `booking.user` can be None: Django's `default` filter
        evaluates its argument as its own variable lookup, and a lookup
        that bottoms out at None (unlike one that's simply missing) isn't
        caught silently the way the bare value is."""
        if not self.user:
            return 'Deleted user'
        return self.user.first_name or self.user.username


class BookingItem(models.Model):
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name='items')
    # Exactly one of these two is set, never both — which one tells you
    # whether this line was a single service or a package (Service/
    # Package are separate models+tables, see catalog/models.py). Both
    # SET_NULL, same reasoning: a deleted/repriced variant must not
    # retroactively change what a past booking shows (see the snapshot
    # fields below, which are what job cards/receipts actually display).
    service_variant = models.ForeignKey(
        'catalog.ServiceVariant', on_delete=models.SET_NULL, null=True, blank=True, related_name='booking_items',
    )
    # Points at the Package directly (not a variant model — a package only
    # ever has one sellable price, see catalog/models.py::Package's
    # docstring, so there's no separate PackageVariant to point at).
    package = models.ForeignKey(
        'catalog.Package', on_delete=models.SET_NULL, null=True, blank=True, related_name='booking_items',
    )
    # Snapshotted for the same reason as Booking's amounts above — a
    # deleted/repriced variant must not change what a past booking shows.
    name_snapshot = models.CharField(max_length=140)
    price_snapshot = models.DecimalField(max_digits=8, decimal_places=2)
    duration_snapshot = models.PositiveIntegerField()
    quantity = models.PositiveSmallIntegerField(default=1)

    # Only populated for a package item — a snapshot of each included
    # service's name/variant/price/duration at booking time (see
    # bookings/views.py::create_booking), since Package.included_services
    # only defines what a package *can* include, not what a specific past
    # booking actually had — that's what lets job cards/dashboards list a
    # package's contents instead of showing just its one line.
    included_snapshot = models.JSONField(default=list, blank=True)

    def __str__(self):
        return f'{self.name_snapshot} x{self.quantity}'

    @property
    def is_package(self):
        return self.package_id is not None


class Review(models.Model):
    """
    A customer's star rating for one completed booking item — see
    bookings/views.py::submit_review (one click on a star, submitted via
    AJAX, updatable — not a one-shot form). One review per item, enforced
    via OneToOneField (not per Booking — a booking can contain several
    different services, each earning its own rating).

    `comment` predates the one-shared-comment-per-order redesign (see
    Booking.feedback_comment) — kept, still populated on older rows, but
    the current UI only ever writes `rating` here; free-text feedback is
    collected once for the whole order instead.

    `service`/`package` are denormalized here rather than reached via
    `booking_item.service_variant.service` because that FK is nullable
    (SET_NULL — see BookingItem above): a review must keep pointing at
    the right catalog row even after its originating variant is deleted,
    since Service/Package.rating/reviews_count are recomputed from real
    Review rows on every submission (see submit_review). Exactly one of
    `service`/`package` is set, matching whichever BookingItem this
    reviews (Service and Package are separate models — see
    catalog/models.py).
    """
    booking_item = models.OneToOneField(BookingItem, on_delete=models.CASCADE, related_name='review')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reviews')
    service = models.ForeignKey('catalog.Service', on_delete=models.CASCADE, null=True, blank=True, related_name='reviews')
    package = models.ForeignKey('catalog.Package', on_delete=models.CASCADE, null=True, blank=True, related_name='reviews')
    rating = models.PositiveSmallIntegerField(
        null=True, blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    beautician_rating = models.PositiveSmallIntegerField(
        null=True, blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.reviewed_item.name} — {self.rating}★ by {self.user}'

    @property
    def reviewed_item(self):
        return self.service or self.package

    @property
    def display_name(self):
        """First name + last initial (e.g. 'Meera N.'), falling back to
        the email's local part — avoids showing a customer's full email
        or full name next to a public review."""
        full_name = self.user.get_full_name().strip()
        if full_name:
            parts = full_name.split()
            return f'{parts[0]} {parts[1][0]}.' if len(parts) > 1 else parts[0]
        return self.user.email.split('@')[0]


class Offer(models.Model):
    """
    A real, admin-manageable coupon — replaces the hardcoded
    `COUPON_RATES` dict that used to live in bookings/views.py (kept the
    same three seeded codes, see the 0010 migration, so nothing already
    advertised in marketing copy silently stops working). `code` is what
    a customer types at checkout (see _resolve_cart_pricing); `title`/
    `description` are what's shown in the "Offers" navbar dropdown (see
    core/booking_data.py::get_booking_offers()).
    """
    code = models.CharField(max_length=20, unique=True)
    title = models.CharField(max_length=140)
    description = models.TextField(blank=True)
    discount_pct = models.PositiveSmallIntegerField(
        help_text='Whole percent off the cart subtotal, 1-100.',
        validators=[MinValueValidator(1), MaxValueValidator(100)],
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.code} — {self.discount_pct}% off'
