from django.db import migrations, models


class Migration(migrations.Migration):
    """Step 4 (final) of the Service/Package split — see 0009's
    docstring. Must run after bookings.0013 has moved every real
    kind='package' row (and rewritten the FKs pointing at it) into the
    new Package/PackageVariant tables."""

    dependencies = [
        ('catalog', '0009_create_package_models'),
        ('bookings', '0013_migrate_package_data'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='service',
            name='included_services',
        ),
        migrations.RemoveField(
            model_name='service',
            name='kind',
        ),
        migrations.AlterField(
            model_name='service',
            name='description',
            field=models.TextField(blank=True),
        ),
        migrations.AlterField(
            model_name='service',
            name='photo_image',
            field=models.ImageField(blank=True, null=True, upload_to='catalog/%Y/%m/'),
        ),
    ]
