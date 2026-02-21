from django.db import migrations


def deduplicate_class_subjects(apps, schema_editor):
    """Keep only one row per (school_class, name) pair before adding unique constraint."""
    ClassSubject = apps.get_model('school', 'ClassSubject')
    seen = set()
    for obj in ClassSubject.objects.order_by('id'):
        key = (obj.school_class_id, obj.name.lower())
        if key in seen:
            obj.delete()
        else:
            seen.add(key)


class Migration(migrations.Migration):

    dependencies = [
        ('school', '0007_substitution_group'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='classsubject',
            name='group',
        ),
        migrations.RunPython(deduplicate_class_subjects, migrations.RunPython.noop),
        migrations.AlterUniqueTogether(
            name='classsubject',
            unique_together={('school_class', 'name')},
        ),
    ]
