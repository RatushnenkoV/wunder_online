from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('school', '0011_alter_substitution_date'),
    ]

    operations = [
        migrations.CreateModel(
            name='LessonTimeSlot',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('lesson_number', models.PositiveSmallIntegerField(unique=True, verbose_name='Номер урока')),
                ('time_start', models.CharField(max_length=5, verbose_name='Начало')),
                ('time_end', models.CharField(max_length=5, verbose_name='Конец')),
            ],
            options={
                'verbose_name': 'Время урока',
                'verbose_name_plural': 'Время уроков',
                'ordering': ['lesson_number'],
            },
        ),
    ]
