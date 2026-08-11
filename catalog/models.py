from django.db import models
from django.templatetags.static import static


class Category(models.Model):
    """Endpoint: GET /api/v1/categories/ — same shape as the old
    booking_data.get_booking_categories() mock (slug/name).

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


class CatalogItemBase(models.Model):
    """
    Fields/behavior shared by `Service` and `Package` — split into two
    real models+tables (2026-08-08) instead of one `Service` row with a
    `kind` discriminator, so a package and a single service are
    genuinely separate records, not two flavors of the same row. Each
    concrete model still declares its own `category` FK (the
    `related_name` must differ) and, for Package, `included_services`.

    `slug` is the same string id the mock catalog always used (e.g.
    'hair-spa') — the marketing site's mock_data.py service/package ids
    must keep matching this slug, since cart entries written from the
    marketing "Book Now"/"Choose <package>" buttons reference it directly.
    See developed.md "Catalog & Bookings models".
    """
    slug = models.SlugField(unique=True)
    name = models.CharField(max_length=140)
    description = models.TextField(blank=True)
    # `photo` predates admin-editable images (added 2026-08-08) — a static
    # asset path seeded catalog rows ship with, kept as the last-resort
    # fallback in `display_photo_url` below rather than backfilled, so
    # existing rows don't need a data migration. New/edited rows set
    # `photo_image` (upload) or `photo_url` (link) instead, via
    # core/admin_dashboard_views.py.
    photo = models.CharField(max_length=200, blank=True, help_text="Static path, e.g. 'images/service-hair-spa.jpg' — only used if neither photo below is set.")
    photo_image = models.ImageField(upload_to='catalog/%Y/%m/', null=True, blank=True)
    photo_url = models.URLField(max_length=500, blank=True)
    tone = models.CharField(max_length=20, blank=True, help_text='Fallback gradient class while the photo loads (espresso/blush/gold/rose)')
    rating = models.DecimalField(max_digits=2, decimal_places=1, default=0)
    reviews_count = models.PositiveIntegerField(default=0)
    popularity_score = models.PositiveSmallIntegerField(default=0)
    badges = models.JSONField(default=list, blank=True, help_text='e.g. ["Bestseller", "New"]')
    available_today = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        ordering = ['-popularity_score']

    def __str__(self):
        return self.name

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


class Service(CatalogItemBase):
    """A single, standalone bookable service (see CatalogItemBase for the
    fields/behavior shared with Package). `ServiceVariant` is where
    price/duration actually live, so a service can have multiple price
    points without duplicating name/description/category."""
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name='services')

    @property
    def default_variant(self):
        """The one variant catalog cards show today. Once a variant-picker
        UI exists, this stops being load-bearing for display and becomes
        just the pre-selected default."""
        return self.variants.filter(is_active=True, is_default=True).first() \
            or self.variants.filter(is_active=True).order_by('sort_order', 'id').first()


class Package(CatalogItemBase):
    """A bundle of services sold together at one price — see
    CatalogItemBase for the fields/behavior shared with Service.
    `included_services` is what the package actually contains (real
    `Service` rows, never other packages).

    Unlike Service, a package's own sellable price/duration live directly
    on this model rather than a separate variant model (removed
    2026-08-08) — a package is only ever sold at one price point in
    practice (no "60 min vs 90 min" tiers the way a wax service has), so
    a `PackageVariant` table that could only ever hold one real row per
    package was pure overhead. `price`/`mrp`/`duration_mins` mirror
    `VariantBase`'s fields by name on purpose, and `discount_pct`/
    `duration_label` below mirror its properties too — callers that
    resolve "the priced thing" for an item (see bookings/views.py::
    _resolve_cart_pricing, core/booking_data.py::_catalog_entry) use a
    ServiceVariant for a Service and the Package instance itself for a
    Package, and both expose the same attribute names.
    """
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name='packages')
    included_services = models.ManyToManyField(
        Service,
        blank=True,
        related_name='included_in_packages',
        help_text='Select single services included in this package',
    )
    price = models.DecimalField(max_digits=8, decimal_places=2)
    mrp = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    duration_mins = models.PositiveIntegerField()

    @property
    def discount_pct(self):
        if not self.mrp or self.mrp <= self.price:
            return None
        return round((self.mrp - self.price) / self.mrp * 100)

    @property
    def duration_label(self):
        hours, minutes = divmod(self.duration_mins, 60)
        if not hours:
            return f'{minutes} min'
        return f'{hours}h {minutes}m' if minutes else f'{hours}h'

    @property
    def total_included_duration(self):
        """Calculated sum of duration in minutes for all included services."""
        total = 0
        for svc in self.included_services.all():
            v = svc.default_variant
            if v:
                total += v.duration_mins
        return total

    @property
    def total_included_mrp(self):
        """Calculated sum of individual service prices for all included services (serves as Package MRP)."""
        total = 0
        for svc in self.included_services.all():
            v = svc.default_variant
            if v:
                total += v.price
        return float(total)


class VariantBase(models.Model):
    """Fields/behavior for `ServiceVariant` — the actual sellable SKU, this
    is what has a price. A cart/booking line for a service always resolves
    to a specific variant, never to a bare Service. Only one variant per
    row is seeded today (is_default=True), but the schema supports more
    without migration. (`Package` had an equivalent `PackageVariant` until
    2026-08-08 — removed since a package only ever needs one price point,
    see Package's own docstring — so this base class now backs only
    `ServiceVariant`, kept abstract in case a second variant-bearing model
    shows up again.)"""
    label = models.CharField(max_length=60, blank=True, help_text="e.g. '60 min', 'Premium' — blank is fine with only one variant")
    duration_mins = models.PositiveIntegerField()
    price = models.DecimalField(max_digits=8, decimal_places=2)
    mrp = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    is_default = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        abstract = True
        ordering = ['sort_order', 'id']

    @property
    def discount_pct(self):
        """Derived, not stored — see CatalogItemBase/VariantBase docstrings
        and the same principle previously used in booking_data.py."""
        if not self.mrp or self.mrp <= self.price:
            return None
        return round((self.mrp - self.price) / self.mrp * 100)

    @property
    def duration_label(self):
        hours, minutes = divmod(self.duration_mins, 60)
        if not hours:
            return f'{minutes} min'
        return f'{hours}h {minutes}m' if minutes else f'{hours}h'


class ServiceVariant(VariantBase):
    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name='variants')

    def __str__(self):
        return f'{self.service.name} — {self.label or self.duration_label}'
