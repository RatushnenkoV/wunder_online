from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('school', '0010_schoolclass_curator_parentprofile_telegram'),
    ]

    operations = [
        migrations.AddField(
            model_name='studentprofile',
            name='personal_file_number',
            field=models.CharField(blank=True, default='', max_length=20, verbose_name='Номер личного дела'),
        ),
    ]
