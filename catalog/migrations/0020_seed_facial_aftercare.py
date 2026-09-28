"""
0020_seed_facial_aftercare.py

Data migration — seeds the Facial After-Care Tips section for all facial services
(both Basic Facial and Premium Facial categories) using the single-box newline format.
"""

from django.db import migrations

FACIAL_CATEGORY_SLUGS = ('basic-facial', 'premium-facial')

FACIAL_AFTERCARE_TITLE = 'Facial After-Care Tips'

FACIAL_AFTERCARE_TIPS = """Avoid using any **face wash or soap** for at least 24 hours.
Do not apply **makeup** immediately to let your pores breathe.
Stay away from **direct sunlight** and **heavy sweat or steam** for a day.
Keep yourself **hydrated** by drinking plenty of water."""


def seed_facial_aftercare(apps, schema_editor):
    Service = apps.get_model('catalog', 'Service')
    ServiceAfterCare = apps.get_model('catalog', 'ServiceAfterCare')

    facial_services = Service.objects.filter(
        category__slug__in=FACIAL_CATEGORY_SLUGS
    )

    for service in facial_services:
        ServiceAfterCare.objects.update_or_create(
            service=service,
            defaults={
                'title': FACIAL_AFTERCARE_TITLE,
                'tips': FACIAL_AFTERCARE_TIPS,
            }
        )


def remove_facial_aftercare(apps, schema_editor):
    ServiceAfterCare = apps.get_model('catalog', 'ServiceAfterCare')
    ServiceAfterCare.objects.filter(
        service__category__slug__in=FACIAL_CATEGORY_SLUGS
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0019_serviceaftercare'),
    ]

    operations = [
        migrations.RunPython(seed_facial_aftercare, reverse_code=remove_facial_aftercare),
    ]
