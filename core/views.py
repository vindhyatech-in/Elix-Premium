"""
Views for the marketing landing page.

The index view assembles context from `core.mock_data` — a stand-in for
REST calls the frontend will make once the API ships (see developed.md for
the endpoint map). Keeping data-shaping out of templates means swapping a
mock function for `requests.get(...)` (or moving the fetch client-side) is
a one-file change.
"""
from django.conf import settings
from django.http import HttpResponse
from django.shortcuts import render
from django.template.loader import render_to_string
from django.urls import reverse
from django.views.decorators.http import require_GET

from . import booking_data, mock_data


def index(request):
    catalog = booking_data.get_booking_catalog()

    context = {
        'hero': mock_data.get_hero(),
        'value_pillars': mock_data.get_value_pillars(),
        'service_categories': booking_data.get_landing_categories(),
        'featured_services': mock_data.get_featured_services(),
        'packages': booking_data.get_landing_packages(),
        'booking_categories': booking_data.get_booking_categories(),
        'booking_offers': booking_data.get_booking_offers(),
        'booking_catalog': catalog,
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
    sort, cart — see developed.md "Service Booking App" for the
    Phase 2/3 roadmap: booking drawer, real chat, notifications backend,
    bookings dashboard).
    """
    context = {
        'booking_categories': booking_data.get_booking_categories(),
        'booking_offers': booking_data.get_booking_offers(),
        'booking_catalog': booking_data.get_booking_catalog(),
        'notifications': booking_data.get_notifications_mock(),
        'trending_searches': booking_data.get_trending_searches(),
    }
    return render(request, 'booking/pages/service_booking.html', context)


def service_detail(request, slug):
    """
    Dedicated Service & Package detail page view: renders full information,
    media photo, variant choices, included services (for packages), how it works,
    customer reviews & ratings, FAQs, and related services recommendations.
    """
    from django.shortcuts import get_object_or_404
    from catalog.models import Service

    service = get_object_or_404(
        Service.objects.select_related('category').prefetch_related('variants', 'included_services__variants'),
        slug=slug,
        is_active=True
    )
    default_var = service.default_variant

    # Prepare included services list for packages
    included_services_data = []
    if service.kind == 'package':
        for inc in service.included_services.all():
            inc_vars = [
                {
                    'id': iv.id,
                    'label': iv.label or iv.duration_label,
                    'price': float(iv.price),
                    'duration_mins': iv.duration_mins,
                    'duration_label': iv.duration_label,
                }
                for iv in inc.variants.filter(is_active=True)
            ]
            inc_default = inc.default_variant
            if inc_default:
                included_services_data.append({
                    'id': inc.id,
                    'name': inc.name,
                    'photo': inc.photo or 'images/portfolio-5.jpg',
                    'selected_variant_id': inc_default.id,
                    'price': float(inc_default.price),
                    'duration_mins': inc_default.duration_mins,
                    'duration_label': inc_default.duration_label,
                    'variants': inc_vars,
                })

    # Real customer reviews — submitted from a completed booking's "Rate &
    # Review" action (see bookings/views.py::submit_review). Every row here
    # came from an actual completed BookingItem, so all are "verified".
    reviews = service.reviews.select_related('user').order_by('-created_at')[:20]

    # Service FAQs
    faqs = [
        {
            'question': 'How do beauticians ensure hygiene at home?',
            'answer': 'Our professionals carry single-use disposables, sterilized tools, and open sealed product sachets directly in front of you.'
        },
        {
            'question': 'Can I select a preferred time slot?',
            'answer': 'Yes! You can choose any convenient date and time during checkout. Express 50-minute delivery is also available for today.'
        },
        {
            'question': 'What if I need to reschedule or cancel?',
            'answer': 'Free cancellation and instant rescheduling are available up to 2 hours before your booked appointment slot.'
        },
    ]

    # Step-by-step workflow
    how_it_works = [
        {
            'step': '01',
            'title': 'Beautician Arrival & Prep',
            'desc': 'Certified female professional arrives at your doorstep equipped with salon setup and hygiene disposable kit.',
        },
        {
            'step': '02',
            'title': 'Sealed Product Unboxing',
            'desc': 'All products are mono-doses opened right before your eyes to guarantee 100% purity and safety.',
        },
        {
            'step': '03',
            'title': 'Flawless Service & Clean-up',
            'desc': 'Enjoy luxury salon treatment at home, followed by complete post-service clean-up and care guidance.',
        },
    ]

    # Related items from the same category or overall catalog
    related_qs = Service.objects.filter(category=service.category, is_active=True).exclude(id=service.id)[:3]

    context = {
        'page_title': f"{service.name} — {settings.SITE_NAME}",
        'service': service,
        'default_variant': default_var,
        'variants': service.variants.filter(is_active=True),
        'included_services': included_services_data,
        'reviews': reviews,
        'faqs': faqs,
        'how_it_works': how_it_works,
        'related_services': related_qs,
        'booking_categories': booking_data.get_booking_categories(),
        'booking_catalog': booking_data.get_booking_catalog(),
    }
    return render(request, 'booking/pages/service_detail.html', context)


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
