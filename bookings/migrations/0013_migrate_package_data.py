from django.db import migrations


def migrate_packages(apps, schema_editor):
    """
    Step 3 of the Service/Package split (see catalog.0009's docstring) —
    the actual data move. Runs after Package/PackageVariant exist
    (catalog.0009) and BookingItem.package_variant/Review.package exist
    (bookings.0012), but before Service.kind/included_services are
    removed (catalog.0010) — so this can still read the old fields.

    For every old `Service` row with kind='package': create the
    equivalent `Package` + `PackageVariant` row(s), copy the
    included_services M2M, rewrite any `BookingItem`/`Review` that
    pointed at the old service_variant/service to point at the new
    package_variant/package instead, then delete the old row — it would
    otherwise linger as an ambiguous plain "service" the moment
    catalog.0010 removes the `kind` column that used to mark it.
    """
    Service = apps.get_model('catalog', 'Service')
    Package = apps.get_model('catalog', 'Package')
    PackageVariant = apps.get_model('catalog', 'PackageVariant')
    BookingItem = apps.get_model('bookings', 'BookingItem')
    Review = apps.get_model('bookings', 'Review')

    old_packages = list(Service.objects.filter(kind='package'))
    for old_pkg in old_packages:
        new_pkg = Package.objects.create(
            slug=old_pkg.slug,
            name=old_pkg.name,
            category_id=old_pkg.category_id,
            description=old_pkg.description,
            photo=old_pkg.photo,
            photo_image=old_pkg.photo_image,
            photo_url=old_pkg.photo_url,
            tone=old_pkg.tone,
            rating=old_pkg.rating,
            reviews_count=old_pkg.reviews_count,
            popularity_score=old_pkg.popularity_score,
            badges=old_pkg.badges,
            available_today=old_pkg.available_today,
            is_active=old_pkg.is_active,
        )
        # created_at/updated_at are auto_now_add/auto_now — .create() would
        # force them to "now"; .update() bypasses that to preserve history.
        Package.objects.filter(pk=new_pkg.pk).update(
            created_at=old_pkg.created_at, updated_at=old_pkg.updated_at,
        )

        new_pkg.included_services.set(old_pkg.included_services.filter(kind='service'))

        variants_by_old_id = {}
        for old_variant in old_pkg.variants.all():
            new_variant = PackageVariant.objects.create(
                package=new_pkg,
                label=old_variant.label,
                duration_mins=old_variant.duration_mins,
                price=old_variant.price,
                mrp=old_variant.mrp,
                is_default=old_variant.is_default,
                is_active=old_variant.is_active,
                sort_order=old_variant.sort_order,
            )
            variants_by_old_id[old_variant.id] = new_variant

        for old_variant_id, new_variant in variants_by_old_id.items():
            BookingItem.objects.filter(service_variant_id=old_variant_id).update(
                package_variant=new_variant, service_variant=None,
            )

        Review.objects.filter(service_id=old_pkg.id).update(package=new_pkg, service=None)

    Service.objects.filter(id__in=[p.id for p in old_packages]).delete()


def noop_reverse(apps, schema_editor):
    """Not reversible — reconstructing the original Service rows from
    Package would need to fabricate primary keys that don't round-trip
    cleanly. Rolling back this far isn't expected to be routine."""


class Migration(migrations.Migration):

    dependencies = [
        ('bookings', '0012_bookingitem_package_variant_review_package_and_more'),
        ('catalog', '0009_create_package_models'),
    ]

    operations = [
        migrations.RunPython(migrate_packages, noop_reverse),
    ]
