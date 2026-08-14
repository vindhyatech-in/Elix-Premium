"""
Role-based access decorators for the owner and employee dashboards —
built around three Django auth Groups ('owner', 'emp', 'customer'), not
`is_staff`/`is_superuser` flags. `is_staff` used to be (incorrectly)
relied on for owner-dashboard access; an emp login ending up with
is_staff=True is exactly what silently granted it full owner-dashboard
access (customer data, pricing, other employees) with no code path ever
having set that flag deliberately. Group membership is now the only
thing either dashboard's access check looks at. See accounts/adapter.py
(customer/owner group assignment) and core/middleware.py (keeps an
owner/emp account out of the customer-facing marketing/booking app).
"""
from functools import wraps

from django.contrib import messages
from django.contrib.auth.views import redirect_to_login
from django.shortcuts import redirect


def is_owner(user):
    return user.is_authenticated and (user.is_superuser or user.groups.filter(name='owner').exists())


def is_emp(user):
    return user.is_authenticated and user.groups.filter(name='emp').exists()


def owner_required(view_func):
    """Owner admin dashboard — superusers and the 'owner' group only.
    An authenticated emp gets bounced to their own dashboard rather than
    a bare 403, since that's almost certainly what they meant to reach."""
    @wraps(view_func)
    def _wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect_to_login(request.get_full_path(), login_url='account_login')
        if is_owner(request.user):
            return view_func(request, *args, **kwargs)
        if is_emp(request.user):
            messages.error(request, "You don't have access to the owner dashboard.")
            return redirect('employee_dashboard')
        messages.error(request, "You don't have access to that page.")
        return redirect('index')
    return _wrapped


def owner_or_emp_required(view_func):
    """Employee/beautician dashboard — the 'emp' group, plus owners and
    superusers (who can preview any employee's view — see
    core/employee_dashboard_views.py::employee_dashboard). A plain
    customer gets sent back to the booking app with an explanatory
    message instead of a bare 403."""
    @wraps(view_func)
    def _wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect_to_login(request.get_full_path(), login_url='account_login')
        if is_owner(request.user) or is_emp(request.user):
            return view_func(request, *args, **kwargs)
        messages.error(request, 'You do not have an assigned Beautician profile.')
        return redirect('index')
    return _wrapped
