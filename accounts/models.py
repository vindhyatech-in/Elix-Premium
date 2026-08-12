from django.conf import settings
from django.db import models
from django.templatetags.static import static


class Profile(models.Model):
    """
    Extends the built-in User model (AUTH_USER_MODEL was never swapped to a
    custom one — this project is too far past its first migration for that
    to be a safe change now) with the one field the account page needs that
    auth.User doesn't have. first_name/last_name/email already exist on
    User itself, so the profile page edits those directly.
    """
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile')
    phone = models.CharField(max_length=20, blank=True)
    phone_verified = models.BooleanField(default=False)
    age = models.PositiveIntegerField(null=True, blank=True)

    def __str__(self):
        return self.user.email


class Address(models.Model):
    """
    A user's saved delivery address — reusable across bookings, not
    snapshotted (unlike Booking's own address_* fields, which freeze a
    *copy* of one of these at booking time so a later edit/delete here
    never changes a past booking's record). Manageable from the profile
    page and, since it's the exact same {label, text, pincode, lat, lng}
    shape the booking drawer's address step already used when it was
    localStorage-backed, from there too — see developed.md
    "Profile & saved addresses".
    """
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='addresses')
    label = models.CharField(max_length=60)
    text = models.TextField()
    pincode = models.CharField(max_length=10, blank=True)
    lat = models.FloatField(null=True, blank=True)
    lng = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.label} — {self.user.email}'


class Employee(models.Model):
    """
    The one real staff model — also backs the marketing landing page's
    "meet the team" carousel now (merged 2026-08-11; that carousel used
    to be `core.Beautician`, a separate decorative model with fictional
    profiles unrelated to real staff). `slug`/`reviews`/`skills`/
    `sort_order`/`photo_image`/`photo_url` exist only for that public
    display — real hiring/job-assignment fields above are unaffected.
    Only `status='active'` employees are shown publicly (see
    `core/views.py::index`) — on_leave/inactive employees keep their
    record without being advertised.
    """
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('on_leave', 'On Leave'),
        ('inactive', 'Inactive'),
    ]

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='employee_profile')
    slug = models.SlugField(max_length=110, unique=True, blank=True)
    name = models.CharField(max_length=100)
    phone = models.CharField(max_length=20)
    email = models.EmailField(blank=True)
    specialties = models.CharField(max_length=200, help_text="e.g. Hair Spa, Facials, Makeup")
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='active')
    rating = models.DecimalField(max_digits=2, decimal_places=1, default=5.0)
    reviews = models.PositiveIntegerField(default=0, help_text='Shown on the public "meet the team" card')
    skills = models.JSONField(default=list, blank=True, help_text='List of short skill strings, e.g. ["Threading", "Honey Wax"] — shown on the public card')
    sort_order = models.PositiveSmallIntegerField(default=0, help_text='Ordering on the public "meet the team" carousel')
    experience_years = models.PositiveIntegerField(default=1)
    photo = models.CharField(max_length=200, blank=True, help_text="Static fallback photo path — only used if neither field below is set.")
    photo_image = models.ImageField(upload_to='employees/%Y/%m/', max_length=255, null=True, blank=True)
    photo_url = models.URLField(max_length=500, blank=True)

    # Reference photos for job-site arrival verification (see
    # bookings.Booking.verification_photo / core/employee_dashboard_views.py)
    # — one-time profile setup, not matched by any ML today (see that
    # field's docstring for why); just a human-checkable reference set.
    face_photo_front = models.ImageField(upload_to='employee_faces/%Y/%m/', max_length=255, null=True, blank=True, help_text="Straight-on, looking directly at the camera")
    face_photo_left = models.ImageField(upload_to='employee_faces/%Y/%m/', max_length=255, null=True, blank=True, help_text="Head turned to show your left profile")
    face_photo_right = models.ImageField(upload_to='employee_faces/%Y/%m/', max_length=255, null=True, blank=True, help_text="Head turned to show your right profile")
    face_photo_top = models.ImageField(upload_to='employee_faces/%Y/%m/', max_length=255, null=True, blank=True, help_text="Chin down, eyes looking up toward the camera")
    face_photo_bottom = models.ImageField(upload_to='employee_faces/%Y/%m/', max_length=255, null=True, blank=True, help_text="Chin up, eyes looking down toward the camera")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.get_status_display()})"

    @property
    def face_photos_complete(self):
        return all([
            self.face_photo_front, self.face_photo_left, self.face_photo_right,
            self.face_photo_top, self.face_photo_bottom,
        ])

    @property
    def display_photo_url(self):
        """The public "meet the team" card's photo — an upload wins over
        a plain URL, which wins over the static fallback path. Distinct
        from the face_photo_* fields above (verification reference
        photos, never shown publicly)."""
        if self.photo_image:
            return self.photo_image.url
        if self.photo_url:
            return self.photo_url
        return static(self.photo) if self.photo else static('images/artist-1.jpg')


class EmployeeLeave(models.Model):
    """
    A future date range an employee has marked themselves unavailable for,
    self-declared from the employee dashboard (see
    core/employee_dashboard_views.py). Effective immediately on save — no
    approval workflow, matching this shop's single-owner-managed scale.
    Surfaced on the owner's employees list (admin_dashboard) so bookings
    aren't assigned to that employee during it; doesn't itself block
    assignment, since that's a manual owner decision today.
    """
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='leaves')
    start_date = models.DateField()
    end_date = models.DateField()
    reason = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['start_date']

    def __str__(self):
        return f'{self.employee.name}: {self.start_date} to {self.end_date}'

    @property
    def duration_days(self):
        return (self.end_date - self.start_date).days + 1

