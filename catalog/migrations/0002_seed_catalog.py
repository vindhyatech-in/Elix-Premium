# Seeds Category/Service/ServiceVariant with the exact same 6 categories +
# 12 catalog items that used to live in core/booking_data.py's hardcoded
# get_booking_categories()/get_booking_catalog(). Slugs are unchanged from
# those mock ids on purpose — see catalog/models.py's Service docstring and
# developed.md "Catalog & Bookings models": the marketing site's
# mock_data.py service/package ids must keep matching these slugs, since
# cart entries written from the marketing "Book Now"/"Choose <package>"
# buttons reference them directly.

from django.db import migrations

CATEGORIES = [
    {'slug': 'hair', 'name': 'Hair', 'icon': 'hair'},
    {'slug': 'skin', 'name': 'Skin', 'icon': 'skin'},
    {'slug': 'makeup', 'name': 'Makeup', 'icon': 'makeup'},
    {'slug': 'nails', 'name': 'Nails', 'icon': 'nails'},
    {'slug': 'spa', 'name': 'Spa & Massage', 'icon': 'spa'},
    {'slug': 'package', 'name': 'Packages', 'icon': 'package'},
]

# (service fields..., variant fields)
CATALOG = [
    {
        'slug': 'hair-spa', 'kind': 'service', 'category': 'hair',
        'name': 'Signature Hair Spa',
        'description': 'Deep-conditioning ritual with scalp therapy and keratin finish.',
        'duration_mins': 75, 'price': 1499, 'mrp': 1799,
        'rating': 4.9, 'reviews_count': 812, 'popularity_score': 92,
        'badges': ['Bestseller'], 'available_today': True, 'tone': 'espresso',
        'photo': 'images/service-hair-spa.jpg',
    },
    {
        'slug': 'glow-facial', 'kind': 'service', 'category': 'skin',
        'name': 'Radiance Glow Facial',
        'description': 'Dermat-approved brightening facial with cold-roller finish.',
        'duration_mins': 60, 'price': 1799, 'mrp': None,
        'rating': 4.8, 'reviews_count': 634, 'popularity_score': 87,
        'badges': [], 'available_today': True, 'tone': 'blush',
        'photo': 'images/service-facial.jpg',
    },
    {
        'slug': 'bridal-makeup', 'kind': 'service', 'category': 'makeup',
        'name': 'Editorial Bridal Makeup',
        'description': 'HD airbrush makeup with a dedicated trial session included.',
        'duration_mins': 120, 'price': 8999, 'mrp': 10999,
        'rating': 5.0, 'reviews_count': 501, 'popularity_score': 95,
        'badges': ['Bestseller', 'Premium'], 'available_today': False, 'tone': 'gold',
        'photo': 'images/service-bridal-makeup.jpg',
    },
    {
        'slug': 'gel-manicure', 'kind': 'service', 'category': 'nails',
        'name': 'Gel Luxe Manicure',
        'description': 'Long-wear gel finish with cuticle spa and hand massage.',
        'duration_mins': 45, 'price': 999, 'mrp': None,
        'rating': 4.7, 'reviews_count': 447, 'popularity_score': 78,
        'badges': ['New'], 'available_today': True, 'tone': 'rose',
        'photo': 'images/service-manicure.jpg',
    },
    {
        'slug': 'thai-massage', 'kind': 'service', 'category': 'spa',
        'name': 'Thai Deep-Tissue Massage',
        'description': 'Full-body therapeutic massage with aromatherapy oils.',
        'duration_mins': 90, 'price': 2299, 'mrp': 2599,
        'rating': 4.9, 'reviews_count': 398, 'popularity_score': 88,
        'badges': [], 'available_today': True, 'tone': 'espresso',
        'photo': 'images/service-massage.jpg',
    },
    {
        'slug': 'keratin-smoothing', 'kind': 'service', 'category': 'hair',
        'name': 'Keratin Smoothing',
        'description': 'Frizz-free, salon-smooth finish that lasts up to 4 months.',
        'duration_mins': 150, 'price': 5499, 'mrp': 6299,
        'rating': 4.8, 'reviews_count': 356, 'popularity_score': 84,
        'badges': ['Limited Slots'], 'available_today': True, 'tone': 'blush',
        'photo': 'images/service-keratin.jpg',
    },
    {
        'slug': 'threading-brows', 'kind': 'service', 'category': 'skin',
        'name': 'Threading & Brow Shaping',
        'description': 'Precision threading with brow tint touch-up on request.',
        'duration_mins': 30, 'price': 399, 'mrp': None,
        'rating': 4.6, 'reviews_count': 289, 'popularity_score': 65,
        'badges': [], 'available_today': True, 'tone': 'blush',
        'photo': 'images/portfolio-5.jpg',
    },
    {
        'slug': 'classic-pedicure', 'kind': 'service', 'category': 'nails',
        'name': 'Classic Spa Pedicure',
        'description': 'Foot soak, exfoliation and massage with regular polish finish.',
        'duration_mins': 50, 'price': 899, 'mrp': 1099,
        'rating': 4.7, 'reviews_count': 312, 'popularity_score': 70,
        'badges': [], 'available_today': True, 'tone': 'rose',
        'photo': 'images/portfolio-3.jpg',
    },
    {
        'slug': 'head-shoulder-massage', 'kind': 'service', 'category': 'spa',
        'name': 'Head & Shoulder Massage',
        'description': 'Stress-relief pressure-point massage with warm oil therapy.',
        'duration_mins': 40, 'price': 799, 'mrp': None,
        'rating': 4.6, 'reviews_count': 201, 'popularity_score': 60,
        'badges': ['New'], 'available_today': True, 'tone': 'espresso',
        'photo': 'images/portfolio-4.jpg',
    },
    {
        'slug': 'essential', 'kind': 'package', 'category': 'package',
        'name': 'Essential Package',
        'description': 'A perfect first ritual — choice of 1 signature service, certified beautician.',
        'duration_mins': 75, 'price': 1999, 'mrp': None,
        'rating': 4.7, 'reviews_count': 268, 'popularity_score': 74,
        'badges': [], 'available_today': True, 'tone': 'blush',
        'photo': 'images/portfolio-2.jpg',
    },
    {
        'slug': 'signature', 'kind': 'package', 'category': 'package',
        'name': 'Signature Package',
        'description': 'Our most-loved ritual — any 3 services bundled, senior beautician of your choice.',
        'duration_mins': 180, 'price': 4499, 'mrp': 5299,
        'rating': 4.9, 'reviews_count': 590, 'popularity_score': 90,
        'badges': ['Bestseller'], 'available_today': True, 'tone': 'gold',
        'photo': 'images/portfolio-6.jpg',
    },
    {
        'slug': 'indulgence', 'kind': 'package', 'category': 'package',
        'name': 'Indulgence Package',
        'description': 'The full spa experience — full-day multi-service ritual, two dedicated specialists.',
        'duration_mins': 300, 'price': 8999, 'mrp': 10499,
        'rating': 4.9, 'reviews_count': 174, 'popularity_score': 81,
        'badges': ['Premium'], 'available_today': False, 'tone': 'espresso',
        'photo': 'images/portfolio-1.jpg',
    },
]


def seed_catalog(apps, schema_editor):
    Category = apps.get_model('catalog', 'Category')
    Service = apps.get_model('catalog', 'Service')
    ServiceVariant = apps.get_model('catalog', 'ServiceVariant')

    categories = {}
    for cat in CATEGORIES:
        categories[cat['slug']] = Category.objects.create(**cat)

    for item in CATALOG:
        service = Service.objects.create(
            slug=item['slug'],
            name=item['name'],
            category=categories[item['category']],
            kind=item['kind'],
            description=item['description'],
            photo=item['photo'],
            tone=item['tone'],
            rating=item['rating'],
            reviews_count=item['reviews_count'],
            popularity_score=item['popularity_score'],
            badges=item['badges'],
            available_today=item['available_today'],
        )
        ServiceVariant.objects.create(
            service=service,
            duration_mins=item['duration_mins'],
            price=item['price'],
            mrp=item['mrp'],
            is_default=True,
        )


def unseed_catalog(apps, schema_editor):
    Category = apps.get_model('catalog', 'Category')
    Service = apps.get_model('catalog', 'Service')
    Service.objects.filter(slug__in=[item['slug'] for item in CATALOG]).delete()
    Category.objects.filter(slug__in=[cat['slug'] for cat in CATEGORIES]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_catalog, unseed_catalog),
    ]
