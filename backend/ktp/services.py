from datetime import timedelta

from accounts.services import parse_import_file
from .models import Holiday, Topic


def autofill_dates(ctp, start_date, weekdays, lessons_per_day=1, start_from_topic_id=None):
    """
    Auto-fill dates for topics in a CTP.

    Args:
        ctp: CTP instance
        start_date: date to start from
        weekdays: list of ints (0=Mon, 1=Tue, ..., 6=Sun)
        lessons_per_day: how many lessons per day for this subject
        start_from_topic_id: if set, only fill dates starting from this topic
    """
    holidays = set(Holiday.objects.values_list('date', flat=True))

    topics = list(ctp.topics.order_by('order'))

    if start_from_topic_id:
        start_idx = None
        for i, t in enumerate(topics):
            if t.id == start_from_topic_id:
                start_idx = i
                break
        if start_idx is None:
            return
        topics = topics[start_idx:]

    current_date = start_date
    topic_idx = 0

    while topic_idx < len(topics):
        if current_date.weekday() in weekdays and current_date not in holidays:
            for _ in range(lessons_per_day):
                if topic_idx >= len(topics):
                    break
                topics[topic_idx].date = current_date
                topics[topic_idx].save(update_fields=['date'])
                topic_idx += 1
        current_date += timedelta(days=1)


def import_topics(ctp, file):
    """
    Import topics from CSV/XLSX. Expected columns: тема (or название)
    Topics are appended after existing ones.
    """
    rows = parse_import_file(file)
    last_order = ctp.topics.count()
    created = []
    errors = []

    for i, row in enumerate(rows, start=2):
        title = row.get('тема', row.get('название', '')).strip()
        if not title:
            errors.append(f'Строка {i}: название темы обязательно')
            continue

        topic = Topic.objects.create(
            ctp=ctp,
            order=last_order,
            title=title,
        )
        created.append(topic)
        last_order += 1

    return created, errors
