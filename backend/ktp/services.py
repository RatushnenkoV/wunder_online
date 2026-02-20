from datetime import timedelta
from collections import Counter

from accounts.services import parse_import_file
from school.models import ScheduleLesson
from .models import Holiday, Topic


def get_schedule_info(ctp):
    """
    Get schedule info for a CTP: which weekdays and how many lessons per day.
    Returns dict: {weekday_number(0=Mon): lessons_count, ...}

    ScheduleLesson.weekday uses 1=Mon..5=Fri, we convert to Python's 0=Mon..4=Fri.
    """
    lessons = ScheduleLesson.objects.filter(
        school_class=ctp.school_class,
        subject=ctp.subject,
    )

    weekday_counts = Counter()
    for lesson in lessons:
        # Convert 1-based weekday to 0-based (Python convention)
        weekday_counts[lesson.weekday - 1] += 1

    return dict(weekday_counts)


def get_required_lessons_count(ctp, start_date, end_date=None):
    """
    Calculate how many lessons are required based on schedule,
    from start_date to end_date (defaults to May 31 of school year).
    """
    if end_date is None:
        # End of school year: May 31
        if start_date.month >= 9:
            end_date = start_date.replace(year=start_date.year + 1, month=5, day=31)
        else:
            end_date = start_date.replace(month=5, day=31)

    schedule_info = get_schedule_info(ctp)
    if not schedule_info:
        return 0

    holidays = set(Holiday.objects.values_list('date', flat=True))

    count = 0
    current_date = start_date
    while current_date <= end_date:
        weekday = current_date.weekday()
        if weekday in schedule_info and current_date not in holidays:
            count += schedule_info[weekday]
        current_date += timedelta(days=1)

    return count


def autofill_dates(ctp, start_date, weekdays=None, lessons_per_day=1,
                   start_from_topic_id=None, use_schedule=True):
    """
    Auto-fill dates for topics in a CTP.

    Args:
        ctp: CTP instance
        start_date: date to start from
        weekdays: list of ints (0=Mon, 1=Tue, ..., 6=Sun) - used if use_schedule=False
        lessons_per_day: how many lessons per day - used if use_schedule=False
        start_from_topic_id: if set, only fill dates starting from this topic
        use_schedule: if True, use schedule data for weekdays and lessons_per_day
    """
    holidays = set(Holiday.objects.values_list('date', flat=True))

    # Get schedule-based weekday info: {weekday: lessons_count}
    if use_schedule:
        schedule_info = get_schedule_info(ctp)
        if not schedule_info:
            return
    else:
        # Legacy mode: use provided weekdays with uniform lessons_per_day
        if not weekdays:
            return
        schedule_info = {d: lessons_per_day for d in weekdays}

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
        weekday = current_date.weekday()
        if weekday in schedule_info and current_date not in holidays:
            for _ in range(schedule_info[weekday]):
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
