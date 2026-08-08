from django.db import migrations


class Migration(migrations.Migration):
    """
    Partial/conditional unique indexes rather than field-level unique=True:
    - auth.User.email has no uniqueness constraint at all by default (a
      well-known Django gotcha), and it's Django's own built-in model —
      can't add unique=True to it via AlterField from another app's
      migration, so this goes straight at the DB via RunSQL instead.
    - Both email and phone are blank for plenty of legitimate rows
      (accounts created before a phone was mandatory, admin/employee
      accounts with no phone). Field-level unique=True treats every
      blank string as a value that itself must be unique — the second
      blank row would violate it. A `WHERE column != ''` partial index
      enforces uniqueness only among real values and leaves blanks alone.
    """

    dependencies = [
        ('accounts', '0006_profile_age_profile_phone_verified'),
    ]

    operations = [
        migrations.RunSQL(
            sql="CREATE UNIQUE INDEX accounts_profile_phone_uniq ON accounts_profile(phone) WHERE phone != '';",
            reverse_sql="DROP INDEX accounts_profile_phone_uniq;",
        ),
        migrations.RunSQL(
            sql="CREATE UNIQUE INDEX auth_user_email_uniq ON auth_user(email) WHERE email != '';",
            reverse_sql="DROP INDEX auth_user_email_uniq;",
        ),
    ]
