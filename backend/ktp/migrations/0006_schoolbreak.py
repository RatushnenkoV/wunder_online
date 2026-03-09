from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ktp', '0005_add_topic_extra_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='SchoolBreak',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200, verbose_name='Название')),
                ('start_date', models.DateField(verbose_name='Начало')),
                ('end_date', models.DateField(verbose_name='Конец')),
            ],
            options={
                'verbose_name': 'Каникулы',
                'verbose_name_plural': 'Каникулы',
                'ordering': ['start_date'],
            },
        ),
    ]
