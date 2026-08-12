from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0011_alter_employee_slug_not_null'),
    ]

    operations = [
        migrations.AlterField(
            model_name='employee',
            name='face_photo_bottom',
            field=models.ImageField(blank=True, help_text='Chin up, eyes looking down toward the camera', max_length=255, null=True, upload_to='employee_faces/%Y/%m/'),
        ),
        migrations.AlterField(
            model_name='employee',
            name='face_photo_front',
            field=models.ImageField(blank=True, help_text='Straight-on, looking directly at the camera', max_length=255, null=True, upload_to='employee_faces/%Y/%m/'),
        ),
        migrations.AlterField(
            model_name='employee',
            name='face_photo_left',
            field=models.ImageField(blank=True, help_text='Head turned to show your left profile', max_length=255, null=True, upload_to='employee_faces/%Y/%m/'),
        ),
        migrations.AlterField(
            model_name='employee',
            name='face_photo_right',
            field=models.ImageField(blank=True, help_text='Head turned to show your right profile', max_length=255, null=True, upload_to='employee_faces/%Y/%m/'),
        ),
        migrations.AlterField(
            model_name='employee',
            name='face_photo_top',
            field=models.ImageField(blank=True, help_text='Chin down, eyes looking up toward the camera', max_length=255, null=True, upload_to='employee_faces/%Y/%m/'),
        ),
        migrations.AlterField(
            model_name='employee',
            name='photo_image',
            field=models.ImageField(blank=True, max_length=255, null=True, upload_to='employees/%Y/%m/'),
        ),
    ]
