from django.db import migrations


def migrate_bookingitem_package(apps, schema_editor):
    """Step 2 (see 0014's docstring) — repoints every existing
    BookingItem from its old package_variant to that variant's Package
    directly, before 0016 drops the package_variant column and
    catalog.0014 deletes PackageVariant entirely."""
    BookingItem = apps.get_model('bookings', 'BookingItem')
    for item in BookingItem.objects.filter(package_variant__isnull=False).select_related('package_variant'):
        item.package_id = item.package_variant.package_id
        item.save(update_fields=['package'])


def noop_reverse(apps, schema_editor):
    """Not reversible — the original package_variant row's identity
    (which of possibly several variants a booking pointed at) isn't
    recoverable from the Package alone."""


class Migration(migrations.Migration):

    dependencies = [
        ('bookings', '0014_bookingitem_package'),
    ]

    operations = [
        migrations.RunPython(migrate_bookingitem_package, noop_reverse),
    ]
