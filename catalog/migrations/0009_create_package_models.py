import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Step 1 of the Service/Package split (see developed.md): creates the
    new Package/PackageVariant tables while `Service.kind`/
    `Service.included_services` still exist, so the data migration in
    bookings.0009_migrate_package_data can read the old fields while
    writing the new ones. catalog.0010 removes the old fields once that
    data migration has run.
    """

    dependencies = [
        ('catalog', '0008_remove_category_icon'),
    ]

    operations = [
        migrations.CreateModel(
            name='Package',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('slug', models.SlugField(unique=True)),
                ('name', models.CharField(max_length=140)),
                ('description', models.TextField(blank=True)),
                ('photo', models.CharField(blank=True, help_text="Static path, e.g. 'images/service-hair-spa.jpg' — only used if neither photo below is set.", max_length=200)),
                ('photo_image', models.ImageField(blank=True, null=True, upload_to='catalog/%Y/%m/')),
                ('photo_url', models.URLField(blank=True, max_length=500)),
                ('tone', models.CharField(blank=True, help_text='Fallback gradient class while the photo loads (espresso/blush/gold/rose)', max_length=20)),
                ('rating', models.DecimalField(decimal_places=1, default=0, max_digits=2)),
                ('reviews_count', models.PositiveIntegerField(default=0)),
                ('popularity_score', models.PositiveSmallIntegerField(default=0)),
                ('badges', models.JSONField(blank=True, default=list, help_text='e.g. ["Bestseller", "New"]')),
                ('available_today', models.BooleanField(default=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('category', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='packages', to='catalog.category')),
                ('included_services', models.ManyToManyField(blank=True, help_text='Select single services included in this package', related_name='included_in_packages', to='catalog.service')),
            ],
            options={
                'ordering': ['-popularity_score'],
                'abstract': False,
            },
        ),
        migrations.CreateModel(
            name='PackageVariant',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('label', models.CharField(blank=True, help_text="e.g. '60 min', 'Premium' — blank is fine with only one variant", max_length=60)),
                ('duration_mins', models.PositiveIntegerField()),
                ('price', models.DecimalField(decimal_places=2, max_digits=8)),
                ('mrp', models.DecimalField(blank=True, decimal_places=2, max_digits=8, null=True)),
                ('is_default', models.BooleanField(default=True)),
                ('is_active', models.BooleanField(default=True)),
                ('sort_order', models.PositiveSmallIntegerField(default=0)),
                ('package', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='variants', to='catalog.package')),
            ],
            options={
                'ordering': ['sort_order', 'id'],
                'abstract': False,
            },
        ),
    ]
