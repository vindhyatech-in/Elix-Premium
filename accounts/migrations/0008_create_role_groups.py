from django.db import migrations

ROLE_GROUPS = ['owner', 'emp', 'customer']

def create_groups_and_backfill(apps, schema_editor):
    """
    Creates the three role groups and retroactively assigns every
    existing account to the right one — 'emp' for anyone with a linked
    Employee (the only path that ever created a login before this
    migration), 'customer' for everyone else. Superusers get no group;
    is_superuser already grants them everything (see
    core/decorators.py::owner_required, core/middleware.py). 'owner' is
    never assigned automatically — per the design, only a superadmin
    hand-picks who gets it, via the Django admin's Group editor.
    """
    Group = apps.get_model('auth', 'Group')
    User = apps.get_model('auth', 'User')
    Employee = apps.get_model('accounts', 'Employee')

    groups = {name: Group.objects.get_or_create(name=name)[0] for name in ROLE_GROUPS}

    emp_user_ids = set(Employee.objects.filter(user__isnull=False).values_list('user_id', flat=True))

    for user in User.objects.filter(is_superuser=False):
        if user.id in emp_user_ids:
            user.groups.add(groups['emp'])
        else:
            user.groups.add(groups['customer'])


def noop_reverse(apps, schema_editor):
    """Groups/memberships are left in place on reverse — deleting them
    would be a bigger, more surprising side effect than a migration
    rollback should have."""


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0007_unique_email_and_phone'),
    ]

    operations = [
        migrations.RunPython(create_groups_and_backfill, noop_reverse),
    ]
