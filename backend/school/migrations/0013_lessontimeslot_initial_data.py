from django.db import migrations


INITIAL_TIMES = [
    (1, '8:15', '9:00'),
    (2, '9:05', '9:50'),
    (3, '10:05', '10:50'),
    (4, '11:05', '11:50'),
    (5, '11:55', '12:40'),
    (6, '13:00', '13:45'),
    (7, '14:05', '14:50'),
]


def create_initial_times(apps, schema_editor):
    LessonTimeSlot = apps.get_model('school', 'LessonTimeSlot')
    for lesson_number, time_start, time_end in INITIAL_TIMES:
        LessonTimeSlot.objects.get_or_create(
            lesson_number=lesson_number,
            defaults={'time_start': time_start, 'time_end': time_end},
        )


class Migration(migrations.Migration):

    dependencies = [
        ('school', '0012_lessontimeslot'),
    ]

    operations = [
        migrations.RunPython(create_initial_times, migrations.RunPython.noop),
    ]
