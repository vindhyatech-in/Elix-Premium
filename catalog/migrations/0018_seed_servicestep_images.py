from django.db import migrations

STEP_IMAGES = {
    1: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80',  # Setup (spa tools & products laid out)
    2: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=800&q=80',  # Cleansing (face cleansing treatment)
    3: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80',  # Exfoliation (skincare exfoliator)
    4: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=800&q=80',  # Blackhead Extraction (deep pore care & steam)
    5: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80',  # Serum (dropper targeting skin layers)
    6: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=800&q=80',  # Moisturisation (hydrating cream application)
    7: 'https://images.unsplash.com/photo-1560750588-73207b1ef5b8?auto=format&fit=crop&w=800&q=80',  # Mask Application (calming facial mask)
    8: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=800&q=80',  # Massage (relaxing neck & shoulder massage)
    9: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80',  # Sun Protection (SPF sunscreen protection)
}


def populate_step_images(apps, schema_editor):
    ServiceStep = apps.get_model('catalog', 'ServiceStep')
    for sort_order, image_url in STEP_IMAGES.items():
        ServiceStep.objects.filter(sort_order=sort_order).update(image_url=image_url)


def reverse_step_images(apps, schema_editor):
    ServiceStep = apps.get_model('catalog', 'ServiceStep')
    ServiceStep.objects.all().update(image_url='')


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0017_seed_facial_steps'),
    ]

    operations = [
        migrations.RunPython(populate_step_images, reverse_step_images),
    ]
