import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    """Step 2 of the Service/Package split — see catalog.0009's docstring."""

    dependencies = [
        ('bookings', '0011_seed_offers'),
        ('catalog', '0009_create_package_models'),
    ]

    operations = [
        migrations.AddField(
            model_name='bookingitem',
            name='package_variant',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='booking_items', to='catalog.packagevariant'),
        ),
        migrations.AddField(
            model_name='review',
            name='package',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='reviews', to='catalog.package'),
        ),
        migrations.AlterField(
            model_name='review',
            name='service',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='reviews', to='catalog.service'),
        ),
    ]
