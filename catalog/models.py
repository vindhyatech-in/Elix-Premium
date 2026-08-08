from django.db import models
from django.templatetags.static import static


class Category(models.Model):
    """Endpoint: GET /api/v1/categories/ — same shape as the old
    booking_data.get_booking_categories() mock (slug/name/icon).

    `description`/`image`/`image_url` back the landing page's category
    grid (see core/booking_data.py::get_landing_categories()) — before
    these existed, that photo/blurb was a hardcoded per-slug dict in
    that function; now it's admin-editable (core/admin_dashboard_views.py::
    dashboard_categories) and falls back to that same dict only for a
    category that hasn't had one set yet, so pre-existing seeded
    categories don't regress to a broken/blank image. `image` (an
    upload) wins over `image_url` (a plain link) when both are set —
    see `display_image_url`."""
    slug = models.SlugField(unique=True)
    name = models.CharField(max_length=60)
    icon = models.CharField(max_length=40, blank=True)
    description = models.TextField(blank=True)
    image = models.ImageField(upload_to='categories/%Y/%m/', null=True, blank=True)
    image_url = models.URLField(max_length=500, blank=True)

    class Meta:
        verbose_name_plural = 'categories'
        # Insertion order (hair, skin, makeup, nails, spa, package) matches
        # the original mock get_booking_categories() order — alphabetical
        # would silently reorder the categories dropdown/sidebar checklist
        # relative to what the site always showed.
        ordering = ['id']

    def __str__(self):
        return self.name

    @property
    def display_image_url(self):
        """The uploaded file's URL, or the plain link, or None — callers
        that need a guaranteed fallback (get_landing_categories, which
        also has its own hardcoded per-slug defaults) handle that
        themselves rather than baking a generic default in here."""
        if self.image:
            return self.image.url
        return self.image_url or None


class Service(models.Model):
    """
    A bookable offering — single service or package (`kind`). One row per
    conceptual thing, not per price: `ServiceVariant` is where price/duration
    actually live, so a service can have multiple price points without
    duplicating name/description/category.

    `slug` is the same string id the mock catalog always used (e.g.
    'hair-spa') — the marketing site's mock_data.py service/package ids
    must keep matching this slug, since cart entries written from the
    marketing "Book Now"/"Choose <package>" buttons reference it directly.
    See developed.md "Catalog & Bookings models".
    """
    KIND_CHOICES = [
        ('service', 'Single Service'),
        ('package', 'Package'),
    ]

    slug = models.SlugField(unique=True)
    name = models.CharField(max_length=140)
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name='services')
    kind = models.CharField(max_length=10, choices=KIND_CHOICES, default='service')
    description = models.TextField()
    # `photo` predates admin-editable images (added 2026-08-08) — a static
    # asset path seeded catalog rows ship with, kept as the last-resort
    # fallback in `display_photo_url` below rather than backfilled, so
    # existing rows don't need a data migration. New/edited services set
    # `photo_image` (upload) or `photo_url` (link) instead, via
    # core/admin_dashboard_views.py::dashboard_services.
    photo = models.CharField(max_length=200, blank=True, help_text="Static path, e.g. 'images/service-hair-spa.jpg' — only used if neither photo below is set.")
    photo_image = models.ImageField(upload_to='services/%Y/%m/', null=True, blank=True)
    photo_url = models.URLField(max_length=500, blank=True)
    tone = models.CharField(max_length=20, blank=True, help_text='Fallback gradient class while the photo loads (espresso/blush/gold/rose)')
    rating = models.DecimalField(max_digits=2, decimal_places=1, default=0)
    reviews_count = models.PositiveIntegerField(default=0)
    popularity_score = models.PositiveSmallIntegerField(default=0)
    included_services = models.ManyToManyField(
        'self',
        symmetrical=False,
        blank=True,
        related_name='included_in_packages',
        help_text='Select single services included in this package'
    )
    badges = models.JSONField(default=list, blank=True, help_text='e.g. ["Bestseller", "New"]')
    available_today = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-popularity_score']

    def __str__(self):
        return self.name

    @property
    def total_included_duration(self):
        """Calculated sum of duration in minutes for all included services."""
        if self.kind != 'package':
            return 0
        total = 0
        for svc in self.included_services.all():
            v = svc.default_variant
            if v:
                total += v.duration_mins
        return total

    @property
    def total_included_mrp(self):
        """Calculated sum of individual service prices for all included services (serves as Package MRP)."""
        if self.kind != 'package':
            return 0
        total = 0
        for svc in self.included_services.all():
            v = svc.default_variant
            if v:
                total += v.price
        return float(total)

    @property
    def default_variant(self):
        """The one variant catalog cards show today. Once a variant-picker
        UI exists, this stops being load-bearing for display and becomes
        just the pre-selected default."""
        return self.variants.filter(is_active=True, is_default=True).first() \
            or self.variants.filter(is_active=True).order_by('sort_order', 'id').first()

    @property
    def display_photo_url(self):
        """The single source of truth every catalog/cart/detail consumer
        should read instead of the raw `photo`/`photo_image`/`photo_url`
        fields directly — an uploaded image wins over a plain link, which
        wins over the legacy static `photo` path, which falls back to a
        generic placeholder if even that's blank. Always a fully-resolved
        URL (static, media, or external), never a bare relative path — so
        templates render it with a plain `{{ }}`, no `{% static %}`."""
        if self.photo_image:
            return self.photo_image.url
        if self.photo_url:
            return self.photo_url
        return static(self.photo) if self.photo else static('images/service-facial.jpg')


class ServiceVariant(models.Model):
    """
    The actual sellable/bookable SKU — this is what has a price. A cart/
    booking line item always resolves to a specific variant, never to a
    bare Service. Only one variant per service is seeded today
    (is_default=True), but the schema supports more without migration.
    """
    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name='variants')
    label = models.CharField(max_length=60, blank=True, help_text="e.g. '60 min', 'Premium' — blank is fine with only one variant")
    duration_mins = models.PositiveIntegerField()
    price = models.DecimalField(max_digits=8, decimal_places=2)
    mrp = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    is_default = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']

    def __str__(self):
        return f'{self.service.name} — {self.label or self.duration_label}'

    @property
    def discount_pct(self):
        """Derived, not stored — see Service/ServiceVariant docstring and
        the same principle previously used in booking_data.py."""
        if not self.mrp or self.mrp <= self.price:
            return None
        return round((self.mrp - self.price) / self.mrp * 100)

    @property
    def duration_label(self):
        hours, minutes = divmod(self.duration_mins, 60)
        if not hours:
            return f'{minutes} min'
        return f'{hours}h {minutes}m' if minutes else f'{hours}h'
