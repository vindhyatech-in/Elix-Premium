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
        }
    }
