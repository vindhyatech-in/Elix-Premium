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
are all real DB-backed models now too (added 2026-08-11) — no mock data
remains anywhere in this module.
"""
from django.templatetags.static import static

from bookings.models import Offer
from catalog.models import Category, Package, Service

from .models import SiteNotification, TrendingSearch


def get_booking_categories():
    """Endpoint: GET /api/v1/categories/"""
    return [
        {'slug': cat.slug, 'name': cat.name}
        for cat in Category.objects.all()
    ]


def get_landing_categories():
    """
    Category list with descriptions, service counts, and photos for the
    landing page grid. `description`/`image`/`image_url` are real,
    admin-editable `Category` fields now (added 2026-08-08, see
    core/admin_dashboard_views.py::dashboard_categories) — this dict was
    the ONLY source before that, so it's kept as the fallback for any
    category that hasn't had its own photo/blurb set yet, rather than
    those categories regressing to a blank image.
    """
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

        if cat.display_image_url:
            photo_url = cat.display_image_url
        elif defaults.get('photo'):
            photo_url = static(defaults['photo'])
        elif first_svc:
            photo_url = first_svc.display_photo_url
        else:
            photo_url = static('images/service-facial.jpg')

        description = cat.description or defaults.get('desc', 'Professional at-home salon services by certified beauticians.')

        categories.append({
            'slug': cat.slug,
            'name': cat.name,
            'services_count': cat.services.count(),
            'photo_url': photo_url,
            'description': description,
        })
    return categories


def get_landing_packages():
    """Returns real package offerings from the database for the marketing landing page."""
    packages = []
    pkgs_qs = Package.objects.filter(is_active=True).prefetch_related('included_services')
    for pkg in pkgs_qs:
        inc_names = [inc.name for inc in pkg.included_services.all()]
        features = inc_names if inc_names else ['Custom beauty bundle', 'Certified beautician', 'Sealed products']

        packages.append({
            'id': pkg.slug,
            'name': pkg.name,
            'tagline': pkg.description or 'Curated super saver beauty combo',
            'price': float(pkg.price),
            'mrp': float(pkg.mrp) if pkg.mrp else None,
            'discount_pct': pkg.discount_pct,
            'featured': 'Bestseller' in (pkg.badges or []) or pkg.popularity_score > 80,
            'photo': pkg.display_photo_url,
            'features': features,
        })
    return packages


def get_booking_offers():
    """Endpoint: GET /api/v1/offers/ — real `bookings.Offer` rows now
    (added 2026-08-08; admin-managed, see core/admin_dashboard_views.py::
    dashboard_offers), not mock data. Kept in this module rather than
    inlined at each call site since app_navbar.html's Offers dropdown is
    the one thing shared across every page that includes it."""
    return list(
        Offer.objects.filter(is_active=True).values('code', 'title', 'description')
    )


def _catalog_entry(item, kind):
    """
    One get_booking_catalog() dict — shared between `Service` and
    `Package` since both are `CatalogItemBase` subclasses with the same
    shape (see catalog/models.py); `kind` is tagged manually here since
    it's no longer a model field distinguishing rows in one shared
    table. Returns None if `item` has no active variant to price it by.

    `price`/`mrp`/`rating` are cast to `float()` explicitly: `json_script`
    (how this reaches `booking.js` via `catalog_grid.html`) serializes
    `Decimal` through `DjangoJSONEncoder` as a *string* — left as Decimal,
    `item.price * qty` in JS would silently become string concatenation
    instead of multiplication. `discount_pct`/`duration_label` stay
    derived (properties, not stored fields) rather than stored, same
    anti-drift reasoning the mock version used.
    """
    if kind == 'package':
        # A package has no separate variant row — it's priced directly
        # (see catalog/models.py::Package's docstring), and it never has
        # more than one price point, so there's no real "variants" list
        # to build; the JS cart already treats a missing/empty one as
        # "use the item's own top-level price" for packages.
        variant = item
        all_variants = []
    else:
        variant = item.default_variant
        if not variant:
            return None
        all_variants = sorted(
            (v for v in item.variants.all() if v.is_active),
            key=lambda v: (v.sort_order, v.id),
        )

    included_services_data = []
    if kind == 'package':
        for inc in item.included_services.all():
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

    return {
        'id': item.slug,
        'kind': kind,
        'category': item.category.slug,
        'name': item.name,
        'description': item.description,
        'duration_mins': variant.duration_mins,
        'price': float(variant.price),
        'mrp': float(variant.mrp) if variant.mrp else None,
        'rating': float(item.rating),
        'reviews_count': item.reviews_count,
        'popularity_score': item.popularity_score,
        'badges': item.badges,
        'available_today': item.available_today,
        'tone': item.tone,
        'photo': item.display_photo_url,
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
    }


def get_booking_catalog():
    """
    Endpoint: GET /api/v1/services/ + GET /api/v1/packages/ (merged).

    Single services and packages are unified into one list so search/filter/
    sort/cart can treat every item generically — each is tagged
    `kind: 'service' | 'package'`. Queries the real catalog models (see
    module docstring) but keeps the exact list-of-dicts shape templates/JS
    have always consumed — `core/views.py` and every template/JS consumer
    needed zero changes for this migration.

    Merge-sorted by `created_at`, not `id` — `Service` and `Package` are
    separate tables/id-sequences now (see catalog/models.py), so an id
    comparison across the two would no longer reflect real chronological
    order the way it did when both lived in one table. `booking.js`'s
    "Newest" sort assumes the embedded catalog array's order reflects
    chronological order and reverses it for "newest first".
    """
    services = list(
        Service.objects.filter(is_active=True)
        .select_related('category')
        .prefetch_related('variants')
    )
    packages = list(
        Package.objects.filter(is_active=True)
        .select_related('category')
        .prefetch_related('included_services__variants')
    )
    tagged_items = [(s, 'service') for s in services] + [(p, 'package') for p in packages]
    tagged_items.sort(key=lambda pair: pair[0].created_at)

    catalog = []
    for item, kind in tagged_items:
        entry = _catalog_entry(item, kind)
        if entry:
            catalog.append(entry)
    return catalog


def get_notifications_mock():
    """Endpoint: GET /api/v1/notifications/ — real `core.SiteNotification`
    rows now (added 2026-08-11), not mock data. Still generic example
    content rather than tied to real per-user booking events — that's a
    distinct future feature. Kept the function name/shape (list of
    dicts with the same keys) so every existing template/consumer
    needed zero changes."""
    return list(
        SiteNotification.objects.values('id', 'title', 'body', 'time_label', 'read', 'icon')
    )


def get_trending_searches():
    """Endpoint: GET /api/v1/search/trending/ — real `core.TrendingSearch`
    rows now, not a hardcoded list."""
    return list(TrendingSearch.objects.values_list('term', flat=True))
