from django.db import migrations, models


class Migration(migrations.Migration):
    """Step 3 (see 0011's docstring) — now that 0012 has backfilled every
    Package's price/duration_mins, they can become required, matching
    ServiceVariant.price/duration_mins (mrp stays optional, same as
    ServiceVariant.mrp)."""

    dependencies = [
        ('catalog', '0012_migrate_packagevariant_data'),
    ]

    operations = [
        migrations.AlterField(
            model_name='package',
            name='price',
            field=models.DecimalField(decimal_places=2, max_digits=8),
        ),
        migrations.AlterField(
            model_name='package',
            name='duration_mins',
            field=models.PositiveIntegerField(),
        ),
    ]
