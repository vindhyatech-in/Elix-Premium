from functools import wraps

from django.http import JsonResponse

from .models import AuthToken


def token_required(view_func):
    """Resolves `request.user` from an `Authorization: Token <key>` header
    instead of the session cookie `django.contrib.auth`'s own
    `login_required` expects — the mobile client has no session, only the
    token handed back by `POST /api/v1/auth/login/` (see api/views.py)."""
    @wraps(view_func)
    def _wrapped(request, *args, **kwargs):
        header = request.headers.get('Authorization', '')
        key = header[6:].strip() if header.startswith('Token ') else ''
        token = AuthToken.objects.select_related('user').filter(key=key).first() if key else None
        if not token:
            return JsonResponse({'ok': False, 'error': 'Authentication required.'}, status=401)
        request.user = token.user
        return view_func(request, *args, **kwargs)
    return _wrapped
