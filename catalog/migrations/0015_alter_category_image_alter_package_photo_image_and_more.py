from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0014_delete_packagevariant'),
    ]

    operations = [
        migrations.AlterField(
            model_name='category',
            name='image',
            field=models.ImageField(blank=True, max_length=255, null=True, upload_to='categories/%Y/%m/'),
        ),
        migrations.AlterField(
            model_name='package',
            name='photo_image',
            field=models.ImageField(blank=True, max_length=255, null=True, upload_to='catalog/%Y/%m/'),
        ),
        migrations.AlterField(
            model_name='service',
            name='photo_image',
            field=models.ImageField(blank=True, max_length=255, null=True, upload_to='catalog/%Y/%m/'),
        ),
    ]
