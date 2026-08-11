from django.db import migrations, models


class Migration(migrations.Migration):
    """Step 1 of removing PackageVariant (2026-08-08) — a package only
    ever has one sellable price in practice (no "60 min vs 90 min" tiers
    the way a wax service has), so its own price/mrp/duration_mins move
    directly onto Package instead of living in a separate variant table
    that could only ever hold one real row per package. `price`/
    `duration_mins` are nullable here only until 0012's data migration
    backfills them from each Package's existing PackageVariant — 0013
    then makes them required, matching ServiceVariant's own fields."""

    dependencies = [
        ('catalog', '0010_remove_service_kind_and_included_services'),
    ]

    operations = [
        migrations.AddField(
            model_name='package',
            name='price',
            field=models.DecimalField(decimal_places=2, max_digits=8, null=True),
        ),
        migrations.AddField(
            model_name='package',
            name='mrp',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=8, null=True),
        ),
        migrations.AddField(
            model_name='package',
            name='duration_mins',
            field=models.PositiveIntegerField(null=True),
        ),
    ]
