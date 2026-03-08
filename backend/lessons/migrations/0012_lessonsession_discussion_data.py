from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('lessons', '0011_lessonassignment'),
    ]

    operations = [
        migrations.AddField(
            model_name='lessonsession',
            name='discussion_data',
            field=models.JSONField(blank=True, default=dict, verbose_name='Данные досок обсуждений'),
        ),
    ]
