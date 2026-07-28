# Removes the 9 demo single-services + their 5 demo categories (hair, skin,
# makeup, nails, spa) now that real client pricing has started arriving —
# per explicit user decision. The 'package' category + its 3 services
# (essential/signature/indulgence) are deliberately KEPT: none of the real
# data received so far includes any package/bundle service, and the user
# chose to leave the demo packages in place rather than show an empty
# Packages section on the marketing homepage until real package data exists.
#
# Adds 6 new categories + ~38 real services (Threading, Peel-Off Wax, Body
# Wax, Bikini Wax, Basic Facial, Premium Facial) from the client's actual
# price list. See developed.md "Real catalog data" for:
#  - which fields are estimates, not client-provided (all `duration_mins`
#    for Threading/Peel-Off/Body/Bikini Wax — the client's price list had
#    no duration column for these; Basic/Premium Facial durations ARE
#    client-provided)
#  - the placeholder `photo`/`tone` values (no real photos exist yet)
#  - why `rating`/`reviews_count`/`popularity_score` are all 0 (no
#    fabricated ratings for a real business — catalog_card.html/
#    featured_services.html were changed to hide the star badge in this case)
#
# Body Wax and Bikini Wax are this catalog's first genuine multi-variant
# services (different wax types at different prices for the same service) —
# exactly the case ServiceVariant was designed for. Only the cheapest
# variant (Honey Wax) is `is_default=True`; there is still no variant-picker
# UI, so only that price shows on the catalog card today (see
# catalog/models.py's Service.default_variant docstring).

from django.db import migrations

REMOVED_SERVICE_SLUGS = [
    'hair-spa', 'glow-facial', 'bridal-makeup', 'gel-manicure',
    'thai-massage', 'keratin-smoothing', 'threading-brows',
    'classic-pedicure', 'head-shoulder-massage',
]
REMOVED_CATEGORY_SLUGS = ['hair', 'skin', 'makeup', 'nails', 'spa']

NEW_CATEGORIES = [
    {'slug': 'threading', 'name': 'Threading', 'icon': 'threading'},
    {'slug': 'peel-off-wax', 'name': 'Peel-Off Wax', 'icon': 'wax'},
    {'slug': 'body-wax', 'name': 'Body Wax', 'icon': 'wax'},
    {'slug': 'bikini-wax', 'name': 'Bikini Wax', 'icon': 'wax'},
    {'slug': 'basic-facial', 'name': 'Basic Facial', 'icon': 'facial'},
    {'slug': 'premium-facial', 'name': 'Premium Facial', 'icon': 'facial'},
]

# Single-variant services: (slug, name, price, duration_mins)
THREADING = [
    ('threading-eyebrows', 'Eyebrows', 39, 10),
    ('threading-upper-lip', 'Upper Lip', 29, 5),
    ('threading-lower-lip', 'Lower Lip', 19, 5),
    ('threading-chin', 'Chin', 39, 5),
    ('threading-forehead', 'Forehead', 39, 5),
    ('threading-side-locks', 'Side Locks', 69, 10),
    ('threading-neck', 'Neck', 69, 10),
    ('threading-full-face-without-eyebrows', 'Full Face (Without Eyebrows)', 199, 20),
    ('threading-full-face-with-eyebrows', 'Full Face (With Eyebrows)', 239, 25),
]

PEEL_OFF_WAX = [
    ('peel-off-wax-underarms', 'Underarms', 149, 15),
    ('peel-off-wax-upper-lip', 'Upper Lip', 59, 10),
    ('peel-off-wax-lower-lip', 'Lower Lip', 39, 10),
    ('peel-off-wax-chin', 'Chin', 69, 10),
    ('peel-off-wax-forehead', 'Forehead', 69, 10),
    ('peel-off-wax-side-locks', 'Side Locks', 99, 15),
    ('peel-off-wax-neck', 'Neck', 99, 15),
    ('peel-off-wax-full-face', 'Full Face', 389, 35),
]

# Multi-variant services: (slug, name, duration_mins, [(label, price), ...])
# Variant order matches the client's table column order; first = cheapest =
# is_default.
BODY_WAX = [
    ('body-wax-underarms', 'Underarms', 15, [('Honey Wax', 49)]),
    ('body-wax-half-arms', 'Half Arms', 20, [('Honey Wax', 99), ('Chocolate Wax', 149), ('Rica Wax', 249)]),
    ('body-wax-full-arms', 'Full Arms', 30, [
        ('Honey Wax', 249), ('Chocolate Wax', 349), ('Rica Wax', 399),
        ('Chocolate Roll-On', 429), ('Rica Roll-On', 469),
    ]),
    ('body-wax-half-legs', 'Half Legs', 30, [('Honey Wax', 249), ('Chocolate Wax', 299), ('Rica Wax', 349)]),
    ('body-wax-full-legs', 'Full Legs', 45, [
        ('Honey Wax', 349), ('Chocolate Wax', 499), ('Rica Wax', 549),
        ('Chocolate Roll-On', 599), ('Rica Roll-On', 649),
    ]),
    ('body-wax-stomach', 'Stomach', 20, [
        ('Honey Wax', 249), ('Chocolate Wax', 299), ('Rica Wax', 369),
        ('Chocolate Roll-On', 429), ('Rica Roll-On', 479),
    ]),
    ('body-wax-full-back', 'Full Back', 30, [
        ('Honey Wax', 299), ('Chocolate Wax', 359), ('Rica Wax', 399),
        ('Chocolate Roll-On', 449), ('Rica Roll-On', 499),
    ]),
    ('body-wax-butt', 'Butt Wax', 15, [('Honey Wax', 249), ('Rica Wax', 389)]),
    ('body-wax-full-body', 'Full Body', 90, [
        ('Honey Wax', 1100), ('Chocolate Wax', 1499), ('Rica Wax', 1699),
        ('Chocolate Roll-On', 1849), ('Rica Roll-On', 2099),
    ]),
]

BIKINI_WAX = [
    ('bikini-line-wax', 'Bikini Line Wax', 15, [('Honey Wax', 249), ('Rica Peel-Off Wax', 349)]),
    ('bikini-wax', 'Bikini Wax', 30, [('Honey Wax', 849), ('Rica Peel-Off Wax', 1199)]),
]

# Facials: (slug, name, description, duration_mins, price)
BASIC_FACIALS = [
    ('facial-vlcc-party-glow', 'Skin Whitening Facial (VLCC Party Glow)', 'Brightens skin, glow', 60, 899),
    ('facial-aroma-magic-fruit', 'Sensitive Skin Aroma Magic Fruit Facial', 'Soothes skin, hydrates & reduces redness', 60, 799),
    ('facial-glow-vitamin-c', 'Glow Facial Vitamin C (FYC)', 'Instant glow, nourishes & improves radiance', 70, 1249),
    ('facial-brightening-cherry-blossom', 'Skin Brightening Facial FYC Cherry Blossom', 'Evens skin tone, reduces dullness & improves texture', 70, 1349),
    ('facial-tan-removal', 'Tan Removal Facial (FYC)', 'Removes tan, brightens skin & restores glow', 65, 1199),
]

# Facials: (slug, name, best_for, benefits, duration_mins, price)
PREMIUM_FACIALS = [
    ('facial-korean-glass-skin', 'Korean Glass Skin Facial (FYC)', 'All Skin Types', 'Deep hydration, glass skin glow', 80, 1449),
    ('facial-hydra-boost-kanpiki', 'Hydra Boost Facial (KANPIKI)', 'Dry, Normal, Combination & Dehydrated Skin', 'Hydration, soft & plump skin', 80, 1649),
    ('facial-o3-shine-glow', 'O3 Shine & Glow', 'All Skin Types', 'Premium glow, smooth texture', 75, 1699),
    ('facial-glass-skin-glow-kanpiki', 'Glass Skin Glow (KANPIKI)', 'Normal, Dry & Dull Skin', 'Glass skin glow, hydration & radiance', 80, 1849),
    ('facial-o3-bridal', 'O3 Bridal Facial (Vitamin C)', 'All Skin Types', 'Instant bridal glow, brightens skin', 85, 2189),
]

# Placeholder photos — reused from existing marketing stock (see
# static/images/CREDITS.md) since no real photos of this client's actual
# work exist yet. Swap for real photography before launch, same as every
# other placeholder noted in developed.md.
PHOTOS = {
    'threading': 'images/portfolio-5.jpg',
    'peel-off-wax': 'images/portfolio-3.jpg',
    'body-wax': 'images/service-massage.jpg',
    'bikini-wax': 'images/portfolio-4.jpg',
    'basic-facial': 'images/service-facial.jpg',
    'premium-facial': 'images/compare-facial-after.jpg',
}
TONES = {
    'threading': 'blush',
    'peel-off-wax': 'rose',
    'body-wax': 'espresso',
    'bikini-wax': 'rose',
    'basic-facial': 'blush',
    'premium-facial': 'gold',
}


def add_real_catalog(apps, schema_editor):
    Category = apps.get_model('catalog', 'Category')
    Service = apps.get_model('catalog', 'Service')
    ServiceVariant = apps.get_model('catalog', 'ServiceVariant')

    # Remove demo single-services first (Category has on_delete=PROTECT from
    # Service, so categories can't go until nothing references them).
    Service.objects.filter(slug__in=REMOVED_SERVICE_SLUGS).delete()
    Category.objects.filter(slug__in=REMOVED_CATEGORY_SLUGS).delete()

    categories = {cat['slug']: Category.objects.create(**cat) for cat in NEW_CATEGORIES}

    def make_single(cat_slug, slug, name, price, duration, badges=None):
        service = Service.objects.create(
            slug=slug, name=name, category=categories[cat_slug], kind='service',
            description=name, photo=PHOTOS[cat_slug], tone=TONES[cat_slug],
            badges=badges or [],
        )
        ServiceVariant.objects.create(service=service, duration_mins=duration, price=price, is_default=True)

    for slug, name, price, duration in THREADING:
        make_single('threading', slug, name, price, duration)
    for slug, name, price, duration in PEEL_OFF_WAX:
        make_single('peel-off-wax', slug, name, price, duration)

    def make_multi(cat_slug, slug, name, duration, variants):
        service = Service.objects.create(
            slug=slug, name=name, category=categories[cat_slug], kind='service',
            description=name, photo=PHOTOS[cat_slug], tone=TONES[cat_slug],
        )
        for i, (label, price) in enumerate(variants):
            ServiceVariant.objects.create(
                service=service, label=label, duration_mins=duration, price=price,
                is_default=(i == 0), sort_order=i,
            )

    for slug, name, duration, variants in BODY_WAX:
        make_multi('body-wax', slug, name, duration, variants)
    for slug, name, duration, variants in BIKINI_WAX:
        make_multi('bikini-wax', slug, name, duration, variants)

    for slug, name, description, duration, price in BASIC_FACIALS:
        service = Service.objects.create(
            slug=slug, name=name, category=categories['basic-facial'], kind='service',
            description=description, photo=PHOTOS['basic-facial'], tone=TONES['basic-facial'],
        )
        ServiceVariant.objects.create(service=service, duration_mins=duration, price=price, is_default=True)

    for slug, name, best_for, benefits, duration, price in PREMIUM_FACIALS:
        service = Service.objects.create(
            slug=slug, name=name, category=categories['premium-facial'], kind='service',
            description=f'{best_for} — {benefits}', photo=PHOTOS['premium-facial'],
            tone=TONES['premium-facial'], badges=['Premium'],
        )
        ServiceVariant.objects.create(service=service, duration_mins=duration, price=price, is_default=True)


def remove_real_catalog(apps, schema_editor):
    """
    Partial reverse: removes what this migration added. Does NOT restore the
    9 demo services/5 demo categories this migration deleted — reversing a
    delete isn't attempted here (acceptable for a content migration; re-run
    migration 0002's logic by hand if the demo catalog is ever needed again).
    """
    Category = apps.get_model('catalog', 'Category')
    Category.objects.filter(slug__in=[c['slug'] for c in NEW_CATEGORIES]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0003_alter_category_options'),
    ]

    operations = [
        migrations.RunPython(add_real_catalog, remove_real_catalog),
    ]
