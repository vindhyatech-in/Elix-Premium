"""
Views for the marketing landing page.

The index view assembles context from real DB-backed models — `core.models`
for marketing content (hero, testimonials, gallery, etc.) and `catalog`/
`bookings` for real business data (see `booking_data.py`). No mock data is
used anywhere in this view (see developed.md "Marketing content moved off
mock_data.py").
"""
from django.conf import settings
from django.http import HttpResponse
from django.shortcuts import render
from django.template.loader import render_to_string
from django.urls import reverse
from django.views.decorators.http import require_GET

from accounts.models import Employee

from . import booking_data
from .models import (
    FAQ, BeautyTip, GalleryBeforeAfter, GalleryPortfolioItem,
    Hero, HowItWorksStep, Testimonial, TrustBadge, TrustPoint, ValuePillar,
)


def index(request):
    catalog = booking_data.get_booking_catalog()

    context = {
        'hero': Hero.objects.filter(is_active=True).first(),
        'value_pillars': ValuePillar.objects.all(),
        'service_categories': booking_data.get_landing_categories(),
        'packages': booking_data.get_landing_packages(),
        'booking_categories': booking_data.get_booking_categories(),
        'booking_offers': booking_data.get_booking_offers(),
        'booking_catalog': catalog,
        'how_it_works': HowItWorksStep.objects.all(),
        'trust_points': TrustPoint.objects.all(),
        'trust_badges': TrustBadge.objects.all(),
        'beauticians': Employee.objects.filter(status='active').order_by('sort_order', 'name'),
        'testimonials': Testimonial.objects.all(),
        'gallery': {
            'before_after': GalleryBeforeAfter.objects.all(),
            'portfolio': GalleryPortfolioItem.objects.all(),
        },
        'beauty_tips': BeautyTip.objects.all(),
        'faqs': FAQ.objects.all(),
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
    from catalog.models import Package, Service

    # Service and Package are separate tables/slug-namespaces since the
    # catalog model split (see catalog/models.py) — a detail slug can land
    # in either, so try Service first (the common case) then Package.
    try:
        service = Service.objects.select_related('category').prefetch_related('variants').get(
            slug=slug, is_active=True,
        )
        kind = 'service'
    except Service.DoesNotExist:
        service = get_object_or_404(
            Package.objects.select_related('category').prefetch_related('included_services__variants'),
            slug=slug,
            is_active=True,
        )
        kind = 'package'

    # A package has no separate variant row to resolve — it's priced
    # directly on the model (see catalog/models.py::Package's docstring),
    # so the package instance itself stands in for "the priced thing"
    # everywhere the template reads `default_variant.<field>`.
    default_var = service if kind == 'package' else service.default_variant

    # Prepare included services list for packages
    included_services_data = []
    if kind == 'package':
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
                    'photo': inc.display_photo_url,
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

    # Related items from the same category — same model as the item being
    # viewed, since Service/Package are separate tables now.
    related_model = Package if kind == 'package' else Service
    related_qs = related_model.objects.filter(category=service.category, is_active=True).exclude(id=service.id)[:3]

    context = {
        'page_title': f"{service.name} — {settings.SITE_NAME}",
        'service': service,
        'kind': kind,
        'kind_display': 'Package' if kind == 'package' else 'Service',
        'default_variant': default_var,
        'variants': service.variants.filter(is_active=True) if kind == 'service' else [],
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
        {'loc': request.build_absolute_uri(reverse('privacy_policy')), 'priority': '0.3', 'changefreq': 'monthly'},
        {'loc': request.build_absolute_uri(reverse('terms_and_conditions')), 'priority': '0.3', 'changefreq': 'monthly'},
    ]
    xml = render_to_string('sitemap.xml', {'urls': urls})
    return HttpResponse(xml, content_type='application/xml')


def privacy_policy(request):
    """
    Privacy Policy static page.
    """
    return render(request, 'core/privacy.html', {
        'page_title': f"Privacy Policy — {settings.SITE_NAME}",
    })


def terms_and_conditions(request):
    """
    Terms & Conditions static page.
    """
    return render(request, 'core/terms.html', {
        'page_title': f"Terms of Service — {settings.SITE_NAME}",
    })
