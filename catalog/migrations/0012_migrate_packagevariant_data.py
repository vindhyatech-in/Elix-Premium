from django.db import migrations


def migrate_packagevariant_data(apps, schema_editor):
    """Step 2 (see 0011's docstring) — copies each Package's existing
    default PackageVariant price/mrp/duration_mins onto the Package row
    directly, before 0014 deletes PackageVariant. Falls back to any
    active variant if no default is set (shouldn't happen in practice,
    but a package with a variant that just never got is_default=True
    shouldn't end up with a blank price)."""
    Package = apps.get_model('catalog', 'Package')
    PackageVariant = apps.get_model('catalog', 'PackageVariant')

    for pkg in Package.objects.all():
        variant = (
            PackageVariant.objects.filter(package=pkg, is_active=True, is_default=True).first()
            or PackageVariant.objects.filter(package=pkg, is_active=True).order_by('sort_order', 'id').first()
            or PackageVariant.objects.filter(package=pkg).order_by('sort_order', 'id').first()
        )
        if not variant:
            continue
        Package.objects.filter(pk=pkg.pk).update(
            price=variant.price, mrp=variant.mrp, duration_mins=variant.duration_mins,
        )


def noop_reverse(apps, schema_editor):
    """Not reversible — would need to fabricate a PackageVariant row
    with a plausible id, matching 0013's own noop_reverse precedent."""


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0011_add_package_price_fields'),
    ]

    operations = [
        migrations.RunPython(migrate_packagevariant_data, noop_reverse),
    ]
