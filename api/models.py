import secrets

from django.conf import settings
from django.db import models


class AuthToken(models.Model):
    """Bearer token for the Flutter mobile client — the `api` app has no
    session cookie to rely on the way the web app's own views do, so
    mobile requests authenticate via `Authorization: Token <key>`
    instead (see api/auth.py::token_required). One token per user: a
    fresh login reuses/rotates the same row rather than piling up a new
    one per device."""
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='auth_token')
    key = models.CharField(max_length=40, unique=True, db_index=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.key:
            self.key = secrets.token_hex(20)
        super().save(*args, **kwargs)

    def __str__(self):
        return f'Token for {self.user}'
