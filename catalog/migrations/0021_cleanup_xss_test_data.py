from django.db import migrations

def remove_xss_test_services(apps, schema_editor):
    Service = apps.get_model('catalog', 'Service')
    Service.objects.filter(name__icontains='XSS').delete()
    Service.objects.filter(slug='img-srcx-onerroralertxss').delete()
    Service.objects.filter(name__startswith='<').delete()

def noop(apps, schema_editor):
    pass

class Migration(migrations.Migration):
    dependencies = [
        ('catalog', '0020_seed_facial_aftercare'),
    ]

    operations = [
        migrations.RunPython(remove_xss_test_services, noop),
    ]
