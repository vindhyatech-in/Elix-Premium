"""
Views for the marketing landing page.

The index view assembles context from `core.mock_data` — a stand-in for
REST calls the frontend will make once the API ships (see developed.md for
the endpoint map). Keeping data-shaping out of templates means swapping a
mock function for `requests.get(...)` (or moving the fetch client-side) is
a one-file change.
"""
from django.http import HttpResponse
from django.shortcuts import render
from django.template.loader import render_to_string
from django.urls import reverse
from django.views.decorators.http import require_GET

from . import booking_data, mock_data


def index(request):
    context = {
        'hero': mock_data.get_hero(),
        'value_pillars': mock_data.get_value_pillars(),
        'service_categories': mock_data.get_service_categories(),
        'featured_services': mock_data.get_featured_services(),
        'packages': mock_data.get_packages(),
        'how_it_works': mock_data.get_how_it_works(),
        'trust_points': mock_data.get_trust_points(),
        'trust_badges': mock_data.get_trust_badges(),
        'beauticians': mock_data.get_beauticians(),
        'testimonials': mock_data.get_testimonials(),
        'gallery': mock_data.get_gallery(),
        'beauty_tips': mock_data.get_beauty_tips(),
        'faqs': mock_data.get_faqs(),
    }
    return render(request, 'index.html', context)


def services_booking(request):
    """
    The Service Booking app (Phase 1: catalog browsing, search, filters,
    sort, wishlist, cart — see developed.md "Service Booking App" for the
    Phase 2/3 roadmap: booking drawer, real chat, notifications backend,
    wishlist page, bookings dashboard).
    """
    context = {
        'booking_categories': booking_data.get_booking_categories(),
        'booking_offers': booking_data.get_booking_offers(),
        'booking_catalog': booking_data.get_booking_catalog(),
        'notifications': booking_data.get_notifications_mock(),
        'trending_searches': booking_data.get_trending_searches(),
    }
    return render(request, 'booking/pages/service_booking.html', context)


@require_GET
def robots_txt(request):
    lines = [
        'User-agent: *',
        'Allow: /',
        f"Sitemap: {request.build_absolute_uri(reverse('sitemap_xml'))}",
    ]
    return HttpResponse('\n'.join(lines), content_type='text/plain')


@require_GET
def sitemap_xml(request):
    """
    Hand-rolled sitemap for the single-page site. If more pages (blog
    detail, beautician profiles) are added later, switch to
    django.contrib.sitemaps for auto-generated, model-driven sitemaps.
    """
    urls = [
        {'loc': request.build_absolute_uri(reverse('index')), 'priority': '1.0', 'changefreq': 'weekly'},
        {'loc': request.build_absolute_uri(reverse('services_booking')), 'priority': '0.9', 'changefreq': 'daily'},
    ]
    xml = render_to_string('sitemap.xml', {'urls': urls})
    return HttpResponse(xml, content_type='application/xml')
