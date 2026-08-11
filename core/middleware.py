from django.shortcuts import redirect

# Path prefixes an owner/emp account can still reach — everything else
# (marketing homepage, booking app, service detail, profile, etc.) gets
# redirected to their own dashboard. Kept as prefixes, not exact paths,
# so nothing under e.g. /dashboard/services/ needs listing individually.
ALWAYS_ALLOWED_PREFIXES = (
    '/dashboard/', '/employee/', '/accounts/', '/admin/',
    '/static/', '/media/', '/api/',
)


class RoleRedirectMiddleware:
    """
    Keeps the owner and employee roles out of the customer-facing
    marketing/booking app entirely — "when owner login marketing page
    should disappear, redirect to dashboard, emp to emp dashboard" (see
    accounts/adapter.py::get_login_redirect_url for the same behavior
    applied once, right after login; this is the enforcement point for
    every request after that — a bookmarked URL, an explicit `?next=`,
    browser back/forward, all land here too). Superusers are exempt —
    "super admin will have access of all things", including being able
    to browse the customer app if they want to.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, 'user', None)
        if user and user.is_authenticated and not user.is_superuser:
            if not request.path.startswith(ALWAYS_ALLOWED_PREFIXES):
                if user.groups.filter(name='owner').exists():
                    return redirect('admin_dashboard_overview')
                if user.groups.filter(name='emp').exists():
                    return redirect('employee_dashboard')
        return self.get_response(request)
