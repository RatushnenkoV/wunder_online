import django.db.models.deletion
import django.db.models
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('school', '0006_substitution'),
    ]

    operations = [
        # Remove old unique_together
        migrations.AlterUniqueTogether(
            name='substitution',
            unique_together=set(),
        ),
        # Add group field
        migrations.AddField(
            model_name='substitution',
            name='group',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='substitutions',
                to='school.classgroup',
                verbose_name='Группа',
            ),
        ),
        # Add new partial unique constraints
        migrations.AddConstraint(
            model_name='substitution',
            constraint=models.UniqueConstraint(
                condition=models.Q(group__isnull=True),
                fields=['date', 'lesson_number', 'school_class'],
                name='unique_substitution_no_group',
            ),
        ),
        migrations.AddConstraint(
            model_name='substitution',
            constraint=models.UniqueConstraint(
                condition=models.Q(group__isnull=False),
                fields=['date', 'lesson_number', 'school_class', 'group'],
                name='unique_substitution_with_group',
            ),
        ),
    ]
