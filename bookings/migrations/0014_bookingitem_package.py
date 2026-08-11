import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    """Step 1 of retargeting BookingItem's package FK from PackageVariant
    to Package directly, alongside the PackageVariant removal (see
    catalog/migrations/0011's docstring). Added as a new field so 0015's
    data migration can still read the old `package_variant` column
    before 0016 drops it."""

    dependencies = [
        ('bookings', '0013_migrate_package_data'),
        ('catalog', '0011_add_package_price_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='bookingitem',
            name='package',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='booking_items', to='catalog.package'),
        ),
    ]
