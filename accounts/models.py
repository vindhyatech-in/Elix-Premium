from django.conf import settings
from django.db import models


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
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('on_leave', 'On Leave'),
        ('inactive', 'Inactive'),
    ]

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='employee_profile')
    name = models.CharField(max_length=100)
    phone = models.CharField(max_length=20)
    email = models.EmailField(blank=True)
    specialties = models.CharField(max_length=200, help_text="e.g. Hair Spa, Facials, Makeup")
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='active')
    rating = models.DecimalField(max_digits=2, decimal_places=1, default=5.0)
    experience_years = models.PositiveIntegerField(default=1)
    photo = models.CharField(max_length=200, blank=True, help_text="Static photo path")

    # Reference photos for job-site arrival verification (see
    # bookings.Booking.verification_photo / core/employee_dashboard_views.py)
    # — one-time profile setup, not matched by any ML today (see that
    # field's docstring for why); just a human-checkable reference set.
    face_photo_front = models.ImageField(upload_to='employee_faces/%Y/%m/', null=True, blank=True, help_text="Straight-on, looking directly at the camera")
    face_photo_left = models.ImageField(upload_to='employee_faces/%Y/%m/', null=True, blank=True, help_text="Head turned to show your left profile")
    face_photo_right = models.ImageField(upload_to='employee_faces/%Y/%m/', null=True, blank=True, help_text="Head turned to show your right profile")
    face_photo_top = models.ImageField(upload_to='employee_faces/%Y/%m/', null=True, blank=True, help_text="Chin down, eyes looking up toward the camera")
    face_photo_bottom = models.ImageField(upload_to='employee_faces/%Y/%m/', null=True, blank=True, help_text="Chin up, eyes looking down toward the camera")

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

