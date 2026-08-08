from django.db import migrations

# The three coupon codes that were hardcoded in bookings/views.py's
# COUPON_RATES dict (and mirrored client-side in booking.js's COUPONS
# object — that mirror is unchanged, see its own comment) before Offer
# existed — seeded here so nothing already advertised in marketing copy
# silently stops working once checkout starts reading from the DB.
SEED_OFFERS = [
    {
        'code': 'GLAM10',
        'title': '10% off your first booking',
        'description': 'Applies to any single service or package. New customers only.',
        'discount_pct': 10,
    },
    {
        'code': 'WEEKDAY15',
        'title': '15% off Monday-Thursday slots',
        'description': 'Book a regular (non-urgent) weekday appointment and save.',
        'discount_pct': 15,
    },
    {
        'code': 'BUNDLE20',
        'title': '20% off when you book 2+ services',
        'description': 'Add any two catalog items to your cart to unlock this automatically.',
        'discount_pct': 20,
    },
]


def seed_offers(apps, schema_editor):
    Offer = apps.get_model('bookings', 'Offer')
    for data in SEED_OFFERS:
        Offer.objects.get_or_create(code=data['code'], defaults=data)


def unseed_offers(apps, schema_editor):
    Offer = apps.get_model('bookings', 'Offer')
    Offer.objects.filter(code__in=[d['code'] for d in SEED_OFFERS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('bookings', '0010_offer'),
    ]

    operations = [
        migrations.RunPython(seed_offers, unseed_offers),
    ]
