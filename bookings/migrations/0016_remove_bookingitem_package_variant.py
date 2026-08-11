from django.db import migrations


class Migration(migrations.Migration):
    """Step 3 (see 0014's docstring) — drops the old FK now that 0015 has
    copied every value over to `package`. Must run before catalog.0014
    deletes PackageVariant (a live FK to it would block that)."""

    dependencies = [
        ('bookings', '0015_migrate_bookingitem_package_data'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='bookingitem',
            name='package_variant',
        ),
    ]
