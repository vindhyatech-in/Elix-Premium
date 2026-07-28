from django.db import models


class Category(models.Model):
    """Endpoint: GET /api/v1/categories/ — same shape as the old
    booking_data.get_booking_categories() mock (slug/name/icon)."""
    slug = models.SlugField(unique=True)
    name = models.CharField(max_length=60)
    icon = models.CharField(max_length=40, blank=True)

    class Meta:
        verbose_name_plural = 'categories'
        # Insertion order (hair, skin, makeup, nails, spa, package) matches
        # the original mock get_booking_categories() order — alphabetical
        # would silently reorder the categories dropdown/sidebar checklist
        # relative to what the site always showed.
        ordering = ['id']

    def __str__(self):
        return self.name


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
    photo = models.CharField(max_length=200, help_text="Static path, e.g. 'images/service-hair-spa.jpg'")
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
        ordering = ['-popularity_score']

    def __str__(self):
        return self.name

    @property
    def default_variant(self):
        """The one variant catalog cards show today. Once a variant-picker
        UI exists, this stops being load-bearing for display and becomes
        just the pre-selected default."""
        return self.variants.filter(is_active=True, is_default=True).first() \
            or self.variants.filter(is_active=True).order_by('sort_order', 'id').first()


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
