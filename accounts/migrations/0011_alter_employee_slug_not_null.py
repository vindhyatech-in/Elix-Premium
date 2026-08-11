from django.db import migrations, models


class Migration(migrations.Migration):
    """Now that 0010 has backfilled every existing Employee's slug,
    it can become required — matches every other model's slug field."""

    dependencies = [
        ('accounts', '0010_backfill_employee_slug'),
    ]

    operations = [
        migrations.AlterField(
            model_name='employee',
            name='slug',
            field=models.SlugField(max_length=110, unique=True, blank=True),
        ),
    ]
