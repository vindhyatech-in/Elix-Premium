from django.db import migrations
from django.utils.text import slugify


def backfill_employee_slug(apps, schema_editor):
    """Same 'name, lowercased, collision-suffixed' scheme
    core/utils.py::generate_unique_slug uses for every other model —
    reimplemented inline (not imported) since migrations shouldn't
    depend on app code that can change out from under them."""
    Employee = apps.get_model('accounts', 'Employee')
    for employee in Employee.objects.filter(slug__isnull=True):
        base = slugify(employee.name)[:100] or 'employee'
        slug = base
        suffix = 1
        while Employee.objects.filter(slug=slug).exclude(pk=employee.pk).exists():
            suffix += 1
            slug = f'{base}-{suffix}'
        employee.slug = slug
        employee.save(update_fields=['slug'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0009_employee_photo_image_employee_photo_url_and_more'),
    ]

    operations = [
        migrations.RunPython(backfill_employee_slug, noop_reverse),
    ]
