"""
Real, DB-backed marketing landing-page content — replaces `mock_data.py`
(2026-08-08). Every model here backs exactly one section of `templates/
index.html` and keeps the exact field names the templates already read,
so no template needed to change beyond swapping a `{% static x.photo %}`
tag for a resolved `x.display_photo_url` (uploads need a real URL, not a
bare relative path). Ordering: everything orderable has a `sort_order`
(admin-editable), `Meta.ordering = ['sort_order', 'id']`.
"""
from django.db import models
from django.templatetags.static import static


class SiteImageMixin(models.Model):
    """Same upload/URL/static-fallback pattern `catalog.CatalogItemBase`
    uses — repeated here (not shared cross-app) since several of this
    app's own models need it and there's no existing cross-app base to
    hang it off. An upload wins over a plain URL, which wins over the
    static fallback path."""
    photo = models.CharField(max_length=200, blank=True, help_text="Static fallback path, e.g. 'images/hero-bg.jpg' — only used if neither field below is set.")
    photo_image = models.ImageField(upload_to='site/%Y/%m/', null=True, blank=True)
    photo_url = models.URLField(max_length=500, blank=True)

    class Meta:
        abstract = True

    @property
    def display_photo_url(self):
        if self.photo_image:
            return self.photo_image.url
        if self.photo_url:
            return self.photo_url
        return static(self.photo) if self.photo else static('images/service-facial.jpg')


class Hero(models.Model):
    """Landing page hero banner — effectively a singleton (only
    `is_active=True` row is used); kept as a table rather than a
    hardcoded dict so the owner can edit copy without a code change."""
    eyebrow = models.CharField(max_length=80, blank=True)
    headline_lines = models.JSONField(default=list, help_text='List of headline lines, e.g. ["Premium Salon", "at Home."]')
    subhead = models.TextField(blank=True)
    primary_cta_label = models.CharField(max_length=60, blank=True)
    primary_cta_href = models.CharField(max_length=200, blank=True)
    secondary_cta_label = models.CharField(max_length=60, blank=True)
    secondary_cta_href = models.CharField(max_length=200, blank=True)
    stats = models.JSONField(default=list, help_text='List of {value, suffix, label}')
    floating_chips = models.JSONField(default=list, blank=True, help_text='List of short strings')
    photo = models.CharField(max_length=200, blank=True)
    photo_image = models.ImageField(upload_to='site/%Y/%m/', null=True, blank=True)
    photo_url = models.URLField(max_length=500, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = 'Hero'

    def __str__(self):
        return self.eyebrow or 'Hero'

    @property
    def display_photo_url(self):
        if self.photo_image:
            return self.photo_image.url
        if self.photo_url:
            return self.photo_url
        return static(self.photo) if self.photo else static('images/hero-bg.jpg')


class ValuePillar(models.Model):
    """The "Why us" section's four pillars. `image` is a short key
    (e.g. 'verified') the template turns into a static path
    (`images/pillar-<image>.jpg`), not a real upload — matches
    `templates/components/why_us.html`'s existing `{% static
    'images/pillar-'|add:pillar.image|add:'.jpg' %}` untouched."""
    index = models.CharField(max_length=4, help_text="Display label, e.g. '01'")
    title = models.CharField(max_length=140)
    body = models.TextField()
    image = models.CharField(max_length=40, help_text="Key used as images/pillar-<image>.jpg")
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']

    def __str__(self):
        return self.title


class HowItWorksStep(models.Model):
    step = models.CharField(max_length=4, help_text="Display label, e.g. '01'")
    title = models.CharField(max_length=140)
    body = models.TextField()
    icon = models.CharField(max_length=40, blank=True)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']
        verbose_name = 'How It Works step'

    def __str__(self):
        return self.title


class TrustPoint(models.Model):
    """The hero-adjacent stat strip (12,000+ Verified Beauticians, etc.)."""
    value = models.DecimalField(max_digits=10, decimal_places=1)
    suffix = models.CharField(max_length=10, blank=True)
    label = models.CharField(max_length=100)
    icon = models.CharField(max_length=40, blank=True)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']

    def __str__(self):
        return self.label


class TrustBadge(models.Model):
    """The "Identity Verified / Hygiene Certified / ..." trust badges."""
    title = models.CharField(max_length=100)
    body = models.TextField()
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']

    def __str__(self):
        return self.title


class Testimonial(models.Model):
    name = models.CharField(max_length=100)
    location = models.CharField(max_length=100)
    rating = models.PositiveSmallIntegerField(default=5)
    quote = models.TextField()
    service = models.CharField(max_length=140, help_text='The service name this customer is quoted about')
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']

    def __str__(self):
        return f'{self.name} — {self.service}'


class GalleryBeforeAfter(models.Model):
    """The gallery section's before/after compare sliders. Two
    independent photo slots (before/after) — `SiteImageMixin` only
    covers one, so both are declared directly here."""
    label = models.CharField(max_length=100)
    tone = models.CharField(max_length=20, blank=True, help_text='CSS tone modifier, e.g. espresso/blush/gold')
    before_photo = models.CharField(max_length=200, blank=True, help_text='Static fallback path')
    before_photo_image = models.ImageField(upload_to='site/%Y/%m/', null=True, blank=True)
    before_photo_url = models.URLField(max_length=500, blank=True)
    after_photo = models.CharField(max_length=200, blank=True, help_text='Static fallback path')
    after_photo_image = models.ImageField(upload_to='site/%Y/%m/', null=True, blank=True)
    after_photo_url = models.URLField(max_length=500, blank=True)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']
        verbose_name = 'Gallery before/after'
        verbose_name_plural = 'Gallery before/afters'

    def __str__(self):
        return self.label

    @property
    def display_before_photo_url(self):
        if self.before_photo_image:
            return self.before_photo_image.url
        if self.before_photo_url:
            return self.before_photo_url
        return static(self.before_photo) if self.before_photo else static('images/service-facial.jpg')

    @property
    def display_after_photo_url(self):
        if self.after_photo_image:
            return self.after_photo_image.url
        if self.after_photo_url:
            return self.after_photo_url
        return static(self.after_photo) if self.after_photo else static('images/service-facial.jpg')


class GalleryPortfolioItem(SiteImageMixin, models.Model):
    """The gallery section's plain portfolio masonry grid."""
    label = models.CharField(max_length=100)
    tone = models.CharField(max_length=20, blank=True)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']
        verbose_name = 'Gallery portfolio item'

    def __str__(self):
        return self.label


class BeautyTip(SiteImageMixin, models.Model):
    slug = models.SlugField(unique=True)
    category = models.CharField(max_length=60)
    title = models.CharField(max_length=160)
    excerpt = models.TextField()
    read_time = models.CharField(max_length=30, help_text="Free text, e.g. '4 min read'")
    date = models.DateField()
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', '-date', 'id']
        verbose_name = 'Beauty tip'

    def __str__(self):
        return self.title


class FAQ(models.Model):
    question = models.CharField(max_length=200)
    answer = models.TextField()
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']
        verbose_name = 'FAQ'
        verbose_name_plural = 'FAQs'

    def __str__(self):
        return self.question


class SiteNotification(models.Model):
    """Generic example content for the booking app's notification bell
    dropdown — not wired to real per-booking events yet (that's a
    distinct future feature, not implied by moving this off mock data)."""
    title = models.CharField(max_length=140)
    body = models.TextField()
    time_label = models.CharField(max_length=30, help_text="Free text, e.g. '2h ago'")
    icon = models.CharField(max_length=40, blank=True)
    read = models.BooleanField(default=False)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', '-id']

    def __str__(self):
        return self.title


class TrendingSearch(models.Model):
    term = models.CharField(max_length=60)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']

    def __str__(self):
        return self.term
