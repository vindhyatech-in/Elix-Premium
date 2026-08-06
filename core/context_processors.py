"""
Global template context.

Injects brand-level constants (name, contact info, socials, app store links)
into every template render, so partials like navbar/footer/JSON-LD schema
never hardcode business details in markup.
"""
from django.conf import settings


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
