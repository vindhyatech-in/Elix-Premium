from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Adds 'refunded' to Booking.PAYMENT_STATUS_CHOICES — BUG-02 fix.

    'refunded' (8 chars) fits inside the existing max_length=10, so no
    column alteration is needed on Postgres/SQLite — this is a metadata-only
    migration that updates Django's in-memory choices list and the admin
    dropdown. The DB constraint (if any) is not affected.
    """

    dependencies = [
        ('bookings', '0021_add_user_notification'),
    ]

    operations = [
        migrations.AlterField(
            model_name='booking',
            name='payment_status',
            field=models.CharField(
                choices=[
                    ('pending', 'Pending'),
                    ('paid', 'Paid'),
                    ('failed', 'Failed'),
                    ('refunded', 'Refunded'),
                ],
                default='pending',
                max_length=10,
            ),
        ),
    ]
