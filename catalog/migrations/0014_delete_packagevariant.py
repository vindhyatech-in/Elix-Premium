from django.db import migrations


class Migration(migrations.Migration):
    """Step 4 (final) — see 0011's docstring. Must run after
    bookings.0016 has dropped the last FK pointing at PackageVariant."""

    dependencies = [
        ('catalog', '0013_alter_package_price_not_null'),
        ('bookings', '0016_remove_bookingitem_package_variant'),
    ]

    operations = [
        migrations.DeleteModel(
            name='PackageVariant',
        ),
    ]
