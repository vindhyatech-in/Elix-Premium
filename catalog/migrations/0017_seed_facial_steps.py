"""
0017_seed_facial_steps.py
~~~~~~~~~~~~~~~~~~~~~~~~~
Data migration — seeds the 9-step standard facial treatment process for
every existing facial service (both Basic Facial and Premium Facial
categories).

Steps are identical across all facial services for now; owners can
edit/reorder/add images from Django admin at any time after this runs.
"""

from django.db import migrations

# Standard 9-step facial process.
FACIAL_STEPS = [
    {
        'sort_order': 1,
        'title': 'Setup',
        'description': (
            'Your professional arrives with all tools and products sanitised '
            'and neatly laid out before the session begins.'
        ),
        'badge': '5 mins',
        'image_url': 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80',
    },
    {
        'sort_order': 2,
        'title': 'Cleansing',
        'description': (
            'A gentle cleanser is applied using an ultrasonic spatula to '
            'dissolve dirt, sunscreen, and surface impurities. Wiped off with '
            'a damp cotton pad for a fresh, clean base.'
        ),
        'badge': '★ KEY STEP',
        'image_url': 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=800&q=80',
    },
    {
        'sort_order': 3,
        'title': 'Exfoliation',
        'description': (
            'Exfoliating gel is massaged in circular motions to slough away '
            'dead skin cells and refine skin texture, then gently wiped off.'
        ),
        'badge': '',
        'image_url': 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80',
    },
    {
        'sort_order': 4,
        'title': 'Blackhead Extraction',
        'description': (
            'Steam is used to open pores, followed by a sterile blackhead '
            'extractor tool to clear congestion. A soothing toner is applied '
            'to close pores and calm the skin.'
        ),
        'badge': '',
        'image_url': 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=800&q=80',
    },
    {
        'sort_order': 5,
        'title': 'Serum',
        'description': (
            'A targeted serum selected for your skin type is applied and '
            'penetrated deep into the skin layers using an ultrasonic spatula '
            'for maximum absorption.'
        ),
        'badge': '★ KEY STEP',
        'image_url': 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80',
    },
    {
        'sort_order': 6,
        'title': 'Moisturisation',
        'description': (
            "A nourishing moisturising cream is massaged into the face, neck, "
            "and lower neckline to lock in hydration and restore the skin's "
            "moisture barrier."
        ),
        'badge': '',
        'image_url': 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=800&q=80',
    },
    {
        'sort_order': 7,
        'title': 'Mask Application',
        'description': (
            'A skin-type-appropriate mask is applied evenly and left to work. '
            'During this time, a gentle relaxing head massage is performed.'
        ),
        'badge': '',
        'image_url': 'https://images.unsplash.com/photo-1560750588-73207b1ef5b8?auto=format&fit=crop&w=800&q=80',
    },
    {
        'sort_order': 8,
        'title': 'Massage',
        'description': (
            'A 15-minute shoulder and upper-back massage is included to help '
            'you unwind while the treatment takes effect. (Feet not included.)'
        ),
        'badge': '15 mins',
        'image_url': 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=800&q=80',
    },
    {
        'sort_order': 9,
        'title': 'Sun Protection',
        'description': (
            'SPF 30 sunscreen is applied evenly across the face as the final '
            'protective step before the session concludes.'
        ),
        'badge': '',
        'image_url': 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80',
    },
]

FACIAL_CATEGORY_SLUGS = ('basic-facial', 'premium-facial')


def seed_facial_steps(apps, schema_editor):
    Service = apps.get_model('catalog', 'Service')
    ServiceStep = apps.get_model('catalog', 'ServiceStep')

    facial_services = Service.objects.filter(
        category__slug__in=FACIAL_CATEGORY_SLUGS
    )

    steps_to_create = []
    for service in facial_services:
        for step_data in FACIAL_STEPS:
            steps_to_create.append(
                ServiceStep(
                    service=service,
                    sort_order=step_data['sort_order'],
                    title=step_data['title'],
                    description=step_data['description'],
                    badge=step_data['badge'],
                    image_url=step_data.get('image_url', ''),
                )
            )

    ServiceStep.objects.bulk_create(steps_to_create)


def remove_facial_steps(apps, schema_editor):
    ServiceStep = apps.get_model('catalog', 'ServiceStep')
    ServiceStep.objects.filter(
        service__category__slug__in=FACIAL_CATEGORY_SLUGS
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0016_servicestep'),
    ]

    operations = [
        migrations.RunPython(seed_facial_steps, reverse_code=remove_facial_steps),
    ]
