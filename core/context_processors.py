"""
Global template context.

Injects brand-level constants (name, contact info, socials, app store links)
into every template render, so partials like navbar/footer/JSON-LD schema
never hardcode business details in markup.
"""
from django.conf import settings


def user_roles(request):
    """
    `is_owner`/`is_emp`/`user_role_label` for templates —
    profile_dropdown.html uses `is_owner`/`is_emp` to decide which
    dashboard link(s) to show, and `user_role_label` to show the
    account's role instead of `user.is_staff`/`user.employee_profile`
    directly (see core/decorators.py for why `is_staff` specifically is
    no longer used for this). One `.groups` query for both booleans, not
    two — an anonymous visitor never even reaches it. `user_role_label`
    distinguishes superuser from a plain 'owner' group member even
    though both get `is_owner=True` (superuser needs the wider label
    since "super admin will have access of all things", not just the
    owner dashboard).
    """
    user = request.user
    if not user.is_authenticated:
        return {'is_owner': False, 'is_emp': False, 'user_role_label': ''}
    if user.is_superuser:
        return {'is_owner': True, 'is_emp': False, 'user_role_label': 'Super Admin'}
    group_names = set(user.groups.values_list('name', flat=True))
    is_owner = 'owner' in group_names
    is_emp = 'emp' in group_names
    if is_owner:
        role_label = 'Owner'
    elif is_emp:
        role_label = 'Employee'
    else:
        role_label = 'Customer'
    return {'is_owner': is_owner, 'is_emp': is_emp, 'user_role_label': role_label}


def site_meta(request):
    return {
        'SITE': {
            'name': settings.SITE_NAME,
            'tagline': settings.SITE_TAGLINE,
            'domain': settings.SITE_DOMAIN,
            'description': settings.SITE_DESCRIPTION,
            'phone': settings.SITE_PHONE,
            'email': settings.SITE_EMAIL,
            'address': settings.SITE_ADDRESS,
            'social': settings.SOCIAL_LINKS,
            'apps': settings.APP_LINKS,
        },
        # Client-side Maps JS API key (restricted by HTTP referrer in the
        # Google Cloud Console, not by secrecy — normal for this key type
        # to be visible in rendered HTML). Powers the booking drawer's
        # address-map step; see booking_base.html and booking_drawer.js.
        # USE_GOOGLE_MAPS_FOR_ADDRESS picks between that and the free
        # Leaflet/Nominatim fallback that's kept in the codebase either way.
        'GOOGLE_MAPS_API_KEY': settings.GOOGLE_MAPS_API_KEY,
        'USE_GOOGLE_MAPS_FOR_ADDRESS': settings.USE_GOOGLE_MAPS_FOR_ADDRESS,
    }
