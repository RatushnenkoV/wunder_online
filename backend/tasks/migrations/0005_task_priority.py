from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tasks', '0004_task_review_comment'),
    ]

    operations = [
        migrations.AddField(
            model_name='task',
            name='priority',
            field=models.CharField(
                choices=[('low', 'Не срочно'), ('medium', 'Средний'), ('high', 'Срочный')],
                default='low',
                max_length=10,
                verbose_name='Приоритет',
            ),
        ),
    ]
