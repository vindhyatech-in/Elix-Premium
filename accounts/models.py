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

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='employee_profile')
    slug = models.SlugField(max_length=110, unique=True, blank=True)
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

    # 128-d ML face embedding vector for automated 1:1 face verification
    face_embedding = models.JSONField(null=True, blank=True, help_text="Pre-calculated 128-d ML face embedding vector for 1:1 facial verification")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['user__first_name', 'user__last_name']

    def __init__(self, *args, **kwargs):
        name_val = kwargs.pop('name', None)
        phone_val = kwargs.pop('phone', None)
        email_val = kwargs.pop('email', None)
        super().__init__(*args, **kwargs)
        if name_val is not None:
            if self.user_id and hasattr(self, 'user') and self.user:
                self.name = name_val
            else:
                parts = str(name_val).strip().split(None, 1)
                self._initial_first_name = parts[0]
                self._initial_last_name = parts[1] if len(parts) > 1 else ''
        if phone_val is not None:
            if self.user_id and hasattr(self, 'user') and self.user:
                self.phone = phone_val
            else:
                self._initial_phone = phone_val
        if email_val is not None:
            if self.user_id and hasattr(self, 'user') and self.user:
                self.email = email_val
            else:
                self._initial_email = email_val

    @property
    def name(self):
        if self.user_id and hasattr(self, 'user') and self.user:
            full = self.user.get_full_name().strip()
            return full or self.user.username
        parts = [getattr(self, '_initial_first_name', ''), getattr(self, '_initial_last_name', '')]
        joined = ' '.join(p for p in parts if p)
        return joined or ''

    @name.setter
    def name(self, val):
        if val is None:
            val = ''
        parts = str(val).strip().split(None, 1)
        first = parts[0] if parts else ''
        last = parts[1] if len(parts) > 1 else ''
        self._initial_first_name = first
        self._initial_last_name = last
        if self.user_id and hasattr(self, 'user') and self.user:
            self.user.first_name = first
            self.user.last_name = last

    @property
    def phone(self):
        if self.user_id and hasattr(self, 'user') and self.user:
            try:
                return self.user.profile.phone
            except Exception:
                return ''
        return getattr(self, '_initial_phone', '')

    @phone.setter
    def phone(self, val):
        self._initial_phone = val or ''
        if self.user_id and hasattr(self, 'user') and self.user:
            from accounts.models import Profile
            profile, _ = Profile.objects.get_or_create(user=self.user)
            profile.phone = val or ''
            profile.save(update_fields=['phone'])

    @property
    def email(self):
        if self.user_id and hasattr(self, 'user') and self.user:
            return self.user.email
        return getattr(self, '_initial_email', '')

    @email.setter
    def email(self, val):
        self._initial_email = val or ''
        if self.user_id and hasattr(self, 'user') and self.user:
            self.user.email = val or ''

    def save(self, *args, **kwargs):
        if not self.user_id:
            from django.contrib.auth.models import User, Group
            from accounts.models import Profile
            from accounts.utils import generate_username_from_name
            import uuid
            first = getattr(self, '_initial_first_name', '') or 'Staff'
            last = getattr(self, '_initial_last_name', '')
            uname = generate_username_from_name(first, last or str(uuid.uuid4())[:4])
            email = getattr(self, '_initial_email', '')
            user = User.objects.create_user(
                username=uname,
                first_name=first,
                last_name=last,
                email=email,
            )
            emp_group, _ = Group.objects.get_or_create(name='emp')
            user.groups.add(emp_group)
            phone = getattr(self, '_initial_phone', '')
            if phone:
                Profile.objects.update_or_create(user=user, defaults={'phone': phone})
            self.user = user

        if not self.slug:
            from core.utils import generate_unique_slug
            slug_base = self.name or (self.user.username if self.user else 'employee')
            self.slug = generate_unique_slug(Employee, slug_base)

        super().save(*args, **kwargs)

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
    A future date range or specific time slot an employee has marked themselves unavailable for.
    Supports full-day absences as well as time-bounded intra-day breaks (e.g., lunch 1 PM - 2 PM).
    """
    LEAVE_TYPE_CHOICES = [
        ('full_day', 'Full Day Leave'),
        ('short_break', 'Short Break / Time Slot'),
        ('multi_day', 'Multi-Day Leave'),
    ]

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='leaves')
    leave_type = models.CharField(max_length=20, choices=LEAVE_TYPE_CHOICES, default='full_day')
    start_date = models.DateField()
    end_date = models.DateField()
    start_time = models.TimeField(null=True, blank=True, help_text="Start time for short breaks (optional)")
    end_time = models.TimeField(null=True, blank=True, help_text="End time for short breaks (optional)")
    reason = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['start_date', 'start_time']

    def __str__(self):
        if self.start_time and self.end_time:
            return f'{self.employee.name}: {self.start_date} ({self.start_time.strftime("%H:%M")} - {self.end_time.strftime("%H:%M")})'
        return f'{self.employee.name}: {self.start_date} to {self.end_date}'

    @property
    def duration_days(self):
        return (self.end_date - self.start_date).days + 1


