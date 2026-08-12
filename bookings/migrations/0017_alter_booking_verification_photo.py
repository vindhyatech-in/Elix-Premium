from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('bookings', '0016_remove_bookingitem_package_variant'),
    ]

    operations = [
        migrations.AlterField(
            model_name='booking',
            name='verification_photo',
            field=models.ImageField(blank=True, max_length=255, null=True, upload_to='job_verification/%Y/%m/'),
        ),
    ]
