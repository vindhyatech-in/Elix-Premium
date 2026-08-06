"""
Mock content for the Service Booking app (/booking/).

Sibling to `mock_data.py` (which powers the marketing landing page only) —
kept separate on purpose: this is a different product surface with its own
growing dataset (catalog, categories, offers, notifications, search). Same
convention as mock_data.py: one get_*() per future REST endpoint, docstring
names the endpoint it stands in for.

`get_booking_categories()` and `get_booking_catalog()` are no longer mock —
they query the real `catalog` app models (Category/Service/ServiceVariant,
added 2026-07-31) but keep their exact function names and the exact same
return shape, so `core/views.py::services_booking` and every template/JS
consumer needed zero changes. See developed.md "Catalog & Bookings models".
`get_booking_offers()`/`get_notifications_mock()`/`get_trending_searches()`
below remain genuine mock data — not asked to become models yet.
"""
from catalog.models import Category, Service


def get_booking_categories():
    """Endpoint: GET /api/v1/categories/"""
    return [
        {'slug': cat.slug, 'name': cat.name, 'icon': cat.icon}
        for cat in Category.objects.all()
    ]


def get_landing_categories():
    """Category list with descriptions, service counts, and photos for the landing page grid."""
    category_defaults = {
        'threading': {'photo': 'images/portfolio-5.jpg', 'desc': 'Precision shaping & smooth hair removal for face & eyebrows.'},
        'peel-off-wax': {'photo': 'images/portfolio-3.jpg', 'desc': 'Painless peel-off waxing for facial & delicate areas.'},
        'body-wax': {'photo': 'images/service-massage.jpg', 'desc': 'Full body, arms & legs waxing with soothing aloe care.'},
        'bikini-wax': {'photo': 'images/portfolio-4.jpg', 'desc': 'Hygienic & gentle wax rituals by trained female experts.'},
        'basic-facial': {'photo': 'images/service-facial.jpg', 'desc': 'Deep cleansing, fruit & glow facials for instant radiance.'},
        'premium-facial': {'photo': 'images/compare-facial-after.jpg', 'desc': 'O3+, Sara Lightening & luxury anti-aging facial treatments.'},
        'package': {'photo': 'images/portfolio-6.jpg', 'desc': 'Super saver beauty combos & monthly maintenance packages.'},
    }

    categories = []
    for cat in Category.objects.all():
        if cat.slug == 'package':
            continue
        first_svc = cat.services.first()
        defaults = category_defaults.get(cat.slug, {})
        photo = defaults.get('photo') or (first_svc.photo if first_svc else 'images/service-facial.jpg')
        desc = defaults.get('desc', 'Professional at-home salon services by certified beauticians.')
        
        categories.append({
            'slug': cat.slug,
            'name': cat.name,
            'services_count': cat.services.count(),
            'photo': photo,
            'description': desc,
        })
    return categories


def get_landing_packages():
    """Returns real package offerings from the database for the marketing landing page."""
    packages = []
    pkgs_qs = Service.objects.filter(kind='package', is_active=True).prefetch_related('included_services', 'variants')
    for pkg in pkgs_qs:
        v = pkg.default_variant
        if not v:
            continue
        inc_names = [inc.name for inc in pkg.included_services.all()]
        features = inc_names if inc_names else ['Custom beauty bundle', 'Certified beautician', 'Sealed products']

        packages.append({
            'id': pkg.slug,
            'name': pkg.name,
            'tagline': pkg.description or 'Curated super saver beauty combo',
            'price': float(v.price),
            'mrp': float(v.mrp) if v.mrp else None,
            'discount_pct': v.discount_pct,
            'featured': 'Bestseller' in (pkg.badges or []) or pkg.popularity_score > 80,
            'photo': pkg.photo or 'images/portfolio-6.jpg',
            'features': features,
        })
    return packages


def get_booking_offers():
    """Endpoint: GET /api/v1/offers/"""
    return [
        {
            'code': 'GLAM10',
            'title': '10% off your first booking',
            'description': 'Applies to any single service or package. New customers only.',
        },
        {
            'code': 'BUNDLE20',
            'title': '20% off when you book 2+ services',
            'description': 'Add any two catalog items to your cart to unlock this automatically.',
        },
        {
            'code': 'WEEKDAY15',
            'title': '15% off Monday-Thursday slots',
            'description': 'Book a regular (non-urgent) weekday appointment and save.',
        },
    ]


def get_booking_catalog():
    """
    Endpoint: GET /api/v1/services/ + GET /api/v1/packages/ (merged).

    Single services and packages are unified into one list so search/filter/
    sort/cart can treat every item generically — each is tagged
    `kind: 'service' | 'package'`. Queries the real catalog models (see
    module docstring) but keeps the exact list-of-dicts shape templates/JS
    have always consumed — `core/views.py` and every template/JS consumer
    needed zero changes for this migration.

    Ordered by `id` (creation order), not `Service.Meta.ordering`
    (`-popularity_score`) — `booking.js`'s "Newest" sort assumes the
    embedded catalog array's order reflects chronological order and
    reverses it for "newest first"; sorting by popularity here would
    silently break that sort option.

    `price`/`mrp`/`rating` are cast to `float()` explicitly: `json_script`
    (how this reaches `booking.js` via `catalog_grid.html`) serializes
    `Decimal` through `DjangoJSONEncoder` as a *string* — left as Decimal,
    `item.price * qty` in JS would silently become string concatenation
    instead of multiplication. `discount_pct`/`duration_label` stay derived
    (now `ServiceVariant` properties) rather than stored, same anti-drift
    reasoning the mock version used.
    """
    catalog = []
    services = (
        Service.objects.filter(is_active=True)
        .select_related('category')
        .prefetch_related('variants', 'included_services__variants')
        .order_by('id')
    )
    for service in services:
        variant = service.default_variant
        if not variant:
            continue
        all_variants = sorted(
            (v for v in service.variants.all() if v.is_active),
            key=lambda v: (v.sort_order, v.id),
        )

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

        catalog.append({
            'id': service.slug,
            'kind': service.kind,
            'category': service.category.slug,
            'name': service.name,
            'description': service.description,
            'duration_mins': variant.duration_mins,
            'price': float(variant.price),
            'mrp': float(variant.mrp) if variant.mrp else None,
            'rating': float(service.rating),
            'reviews_count': service.reviews_count,
            'popularity_score': service.popularity_score,
            'badges': service.badges,
            'available_today': service.available_today,
            'tone': service.tone,
            'photo': service.photo,
            'discount_pct': variant.discount_pct,
            'duration_label': variant.duration_label,
            'included_services': included_services_data,
            'variants': [
                {
                    'id': v.id,
                    'label': v.label or v.duration_label,
                    'price': float(v.price),
                    'mrp': float(v.mrp) if v.mrp else None,
                    'duration_mins': v.duration_mins,
                    'duration_label': v.duration_label,
                    'discount_pct': v.discount_pct,
                    'is_default': v.id == variant.id,
                }
                for v in all_variants
            ],
        })
    return catalog


def get_notifications_mock():
    """Endpoint: GET /api/v1/notifications/"""
    return [
        {
            'id': 1,
            'title': 'Booking confirmed',
            'body': 'Your Signature Hair Spa is confirmed for tomorrow, 11 AM.',
            'time_label': '2h ago',
            'read': False,
            'icon': 'check',
        },
        {
            'id': 2,
            'title': 'Limited slots left',
            'body': 'Keratin Smoothing has only 3 weekend slots remaining in your area.',
            'time_label': '1d ago',
            'read': False,
            'icon': 'clock',
        },
        {
            'id': 3,
            'title': 'New offer for you',
            'body': 'Use WEEKDAY15 for 15% off your next Monday-Thursday booking.',
            'time_label': '3d ago',
            'read': True,
            'icon': 'tag',
        },
    ]


def get_trending_searches():
    """Endpoint: GET /api/v1/search/trending/"""
    return ['Bridal Makeup', 'Keratin Smoothing', 'Deep Cleanse Facial', 'Head Massage', 'Gel Manicure']
