import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('school', '0005_schedulelesson_group'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Substitution',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField(verbose_name='Дата')),
                ('lesson_number', models.PositiveSmallIntegerField(verbose_name='Номер урока')),
                ('school_class', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='substitutions',
                    to='school.schoolclass',
                    verbose_name='Класс',
                )),
                ('subject', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='substitutions',
                    to='school.subject',
                    verbose_name='Предмет',
                )),
                ('teacher', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='substitutions',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='Учитель',
                )),
                ('room', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='substitutions',
                    to='school.room',
                    verbose_name='Кабинет',
                )),
                ('original_lesson', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='substitutions',
                    to='school.schedulelesson',
                    verbose_name='Оригинальный урок',
                )),
            ],
            options={
                'verbose_name': 'Замена',
                'verbose_name_plural': 'Замены',
                'ordering': ['date', 'lesson_number'],
            },
        ),
        migrations.AlterUniqueTogether(
            name='substitution',
            unique_together={('date', 'lesson_number', 'school_class')},
        ),
    ]
