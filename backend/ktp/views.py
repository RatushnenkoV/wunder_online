from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import IsAdmin, IsAdminOrTeacher, PasswordChanged
from school.models import StudentProfile, ParentProfile
from .models import CTP, Topic, TopicFile, Holiday
from .serializers import (
    CTPListSerializer, CTPDetailSerializer, CTPCreateSerializer,
    TopicSerializer, TopicCreateSerializer, TopicBulkCreateSerializer,
    AutofillDatesSerializer, HolidaySerializer,
    TopicFileSerializer, TopicByDateSerializer,
)
from .services import autofill_dates, import_topics, get_schedule_info, get_required_lessons_count


def _get_user_classes(user):
    """Get class IDs accessible to the user based on their role."""
    if user.is_admin or user.is_teacher:
        return None  # All classes
    class_ids = set()
    if user.is_student and hasattr(user, 'student_profile'):
        class_ids.add(user.student_profile.school_class_id)
    if user.is_parent and hasattr(user, 'parent_profile'):
        for child in user.parent_profile.children.all():
            class_ids.add(child.school_class_id)
    return class_ids


# --- CTP ---

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated, PasswordChanged])
def ctp_list_create(request):
    if request.method == 'GET':
        ctps = CTP.objects.select_related('teacher', 'school_class', 'school_class__grade_level', 'subject')

        class_ids = _get_user_classes(request.user)
        if class_ids is not None:
            ctps = ctps.filter(school_class_id__in=class_ids, is_public=True)

        class_filter = request.query_params.get('school_class')
        if class_filter:
            ctps = ctps.filter(school_class_id=class_filter)

        subject_filter = request.query_params.get('subject')
        if subject_filter:
            ctps = ctps.filter(subject_id=subject_filter)

        return Response(CTPListSerializer(ctps, many=True).data)

    if not (request.user.is_teacher or request.user.is_admin):
        return Response({'detail': 'Только учителя могут создавать КТП'}, status=status.HTTP_403_FORBIDDEN)

    serializer = CTPCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    d = serializer.validated_data

    ctp = CTP.objects.create(
        teacher=request.user,
        school_class_id=d['school_class'],
        subject_id=d['subject'],
        is_public=d['is_public'],
    )
    return Response(CTPListSerializer(ctp).data, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated, PasswordChanged])
def ctp_detail(request, pk):
    try:
        ctp = CTP.objects.select_related(
            'teacher', 'school_class', 'school_class__grade_level', 'subject'
        ).prefetch_related('topics', 'topics__files').get(pk=pk)
    except CTP.DoesNotExist:
        return Response({'detail': 'КТП не найдено'}, status=status.HTTP_404_NOT_FOUND)

    # Check access
    class_ids = _get_user_classes(request.user)
    if class_ids is not None:
        if ctp.school_class_id not in class_ids or not ctp.is_public:
            return Response({'detail': 'Нет доступа'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        return Response(CTPDetailSerializer(ctp).data)

    # Only the creating teacher can edit/delete
    if ctp.teacher != request.user:
        return Response({'detail': 'Только автор КТП может его редактировать'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'PUT':
        ctp.is_public = request.data.get('is_public', ctp.is_public)
        ctp.save()
        return Response(CTPDetailSerializer(ctp).data)

    if request.method == 'DELETE':
        ctp.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@permission_classes([IsAuthenticated, PasswordChanged])
def ctp_copy(request, pk):
    """Copy CTP with all topics to another class."""
    try:
        original = CTP.objects.prefetch_related('topics').get(pk=pk)
    except CTP.DoesNotExist:
        return Response({'detail': 'КТП не найдено'}, status=status.HTTP_404_NOT_FOUND)

    if not (request.user.is_teacher or request.user.is_admin):
        return Response({'detail': 'Нет доступа'}, status=status.HTTP_403_FORBIDDEN)

    target_class_id = request.data.get('school_class')
    if not target_class_id:
        return Response({'detail': 'Укажите класс для копирования'}, status=status.HTTP_400_BAD_REQUEST)

    new_ctp = CTP.objects.create(
        teacher=request.user,
        school_class_id=target_class_id,
        subject=original.subject,
        is_public=original.is_public,
    )

    topics = original.topics.order_by('order')
    for topic in topics:
        Topic.objects.create(
            ctp=new_ctp,
            order=topic.order,
            title=topic.title,
            homework=topic.homework,
            resources=topic.resources,
        )

    return Response(CTPDetailSerializer(new_ctp).data, status=status.HTTP_201_CREATED)


# --- Topics ---

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated, PasswordChanged])
def topic_list_create(request, ctp_id):
    try:
        ctp = CTP.objects.get(pk=ctp_id)
    except CTP.DoesNotExist:
        return Response({'detail': 'КТП не найдено'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        topics = ctp.topics.order_by('order')
        return Response(TopicSerializer(topics, many=True).data)

    if ctp.teacher != request.user:
        return Response({'detail': 'Только автор КТП может добавлять темы'}, status=status.HTTP_403_FORBIDDEN)

    serializer = TopicCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    last_order = ctp.topics.count()
    topic = Topic.objects.create(
        ctp=ctp,
        order=last_order,
        title=serializer.validated_data['title'],
    )
    return Response(TopicSerializer(topic).data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated, PasswordChanged])
def topic_bulk_create(request, ctp_id):
    """Create multiple topics at once."""
    try:
        ctp = CTP.objects.get(pk=ctp_id)
    except CTP.DoesNotExist:
        return Response({'detail': 'КТП не найдено'}, status=status.HTTP_404_NOT_FOUND)

    if ctp.teacher != request.user:
        return Response({'detail': 'Нет доступа'}, status=status.HTTP_403_FORBIDDEN)

    serializer = TopicBulkCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    last_order = ctp.topics.count()
    created = []
    for title in serializer.validated_data['titles']:
        topic = Topic.objects.create(ctp=ctp, order=last_order, title=title)
        created.append(topic)
        last_order += 1

    return Response(TopicSerializer(created, many=True).data, status=status.HTTP_201_CREATED)


@api_view(['PUT', 'DELETE'])
@permission_classes([IsAuthenticated, PasswordChanged])
def topic_detail(request, pk):
    try:
        topic = Topic.objects.select_related('ctp').get(pk=pk)
    except Topic.DoesNotExist:
        return Response({'detail': 'Тема не найдена'}, status=status.HTTP_404_NOT_FOUND)

    if topic.ctp.teacher != request.user:
        return Response({'detail': 'Нет доступа'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'PUT':
        topic.title = request.data.get('title', topic.title)
        topic.date = request.data.get('date', topic.date)
        topic.homework = request.data.get('homework', topic.homework)
        topic.resources = request.data.get('resources', topic.resources)
        topic.save()
        return Response(TopicSerializer(topic).data)

    if request.method == 'DELETE':
        topic.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@permission_classes([IsAuthenticated, PasswordChanged])
def topic_reorder(request, ctp_id):
    """Reorder topics. Expects: {"topic_ids": [3, 1, 2, ...]}"""
    try:
        ctp = CTP.objects.get(pk=ctp_id)
    except CTP.DoesNotExist:
        return Response({'detail': 'КТП не найдено'}, status=status.HTTP_404_NOT_FOUND)

    if ctp.teacher != request.user:
        return Response({'detail': 'Нет доступа'}, status=status.HTTP_403_FORBIDDEN)

    topic_ids = request.data.get('topic_ids', [])
    for i, tid in enumerate(topic_ids):
        Topic.objects.filter(pk=tid, ctp=ctp).update(order=i)

    return Response({'detail': 'Порядок обновлён'})


@api_view(['POST'])
@permission_classes([IsAuthenticated, PasswordChanged])
def topic_bulk_delete(request, ctp_id):
    """Delete multiple topics. Expects: {"topic_ids": [1, 2, 3]}"""
    try:
        ctp = CTP.objects.get(pk=ctp_id)
    except CTP.DoesNotExist:
        return Response({'detail': 'КТП не найдено'}, status=status.HTTP_404_NOT_FOUND)

    if ctp.teacher != request.user:
        return Response({'detail': 'Нет доступа'}, status=status.HTTP_403_FORBIDDEN)

    topic_ids = request.data.get('topic_ids', [])
    deleted = Topic.objects.filter(pk__in=topic_ids, ctp=ctp).delete()

    return Response({'deleted_count': deleted[0]})


@api_view(['POST'])
@permission_classes([IsAuthenticated, PasswordChanged])
def topic_duplicate(request, ctp_id):
    """Duplicate topics, inserting copies right after originals. Expects: {"topic_ids": [1, 2, 3]}"""
    try:
        ctp = CTP.objects.get(pk=ctp_id)
    except CTP.DoesNotExist:
        return Response({'detail': 'КТП не найдено'}, status=status.HTTP_404_NOT_FOUND)

    if ctp.teacher != request.user:
        return Response({'detail': 'Нет доступа'}, status=status.HTTP_403_FORBIDDEN)

    topic_ids = request.data.get('topic_ids', [])
    topic_ids_set = set(topic_ids)

    # Get all topics in order
    all_topics = list(ctp.topics.order_by('order'))

    # Build new ordered list with copies inserted after originals
    new_order = []
    created = []
    for t in all_topics:
        new_order.append(t)
        if t.id in topic_ids_set:
            new_topic = Topic.objects.create(
                ctp=ctp,
                order=0,  # Will be set below
                title=t.title,
                homework=t.homework,
                resources=t.resources,
            )
            created.append(new_topic)
            new_order.append(new_topic)

    # Re-number all topics
    for i, t in enumerate(new_order):
        if t.order != i:
            t.order = i
            t.save(update_fields=['order'])

    return Response(TopicSerializer(created, many=True).data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated, PasswordChanged])
@parser_classes([MultiPartParser])
def topic_import(request, ctp_id):
    """Import topics from CSV/XLSX file."""
    try:
        ctp = CTP.objects.get(pk=ctp_id)
    except CTP.DoesNotExist:
        return Response({'detail': 'КТП не найдено'}, status=status.HTTP_404_NOT_FOUND)

    if ctp.teacher != request.user:
        return Response({'detail': 'Нет доступа'}, status=status.HTTP_403_FORBIDDEN)

    file = request.FILES.get('file')
    if not file:
        return Response({'detail': 'Файл не загружен'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        created, errors = import_topics(ctp, file)
    except ValueError as e:
        return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    return Response({
        'created_count': len(created),
        'created': TopicSerializer(created, many=True).data,
        'errors': errors,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated, PasswordChanged])
def topic_autofill_dates(request, ctp_id):
    """Auto-fill dates for topics using schedule data."""
    try:
        ctp = CTP.objects.get(pk=ctp_id)
    except CTP.DoesNotExist:
        return Response({'detail': 'КТП не найдено'}, status=status.HTTP_404_NOT_FOUND)

    if ctp.teacher != request.user:
        return Response({'detail': 'Нет доступа'}, status=status.HTTP_403_FORBIDDEN)

    serializer = AutofillDatesSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    d = serializer.validated_data

    autofill_dates(
        ctp,
        d['start_date'],
        start_from_topic_id=d.get('start_from_topic_id'),
        use_schedule=True,
    )

    topics = ctp.topics.order_by('order')
    return Response(TopicSerializer(topics, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated, PasswordChanged])
def ctp_schedule_info(request, ctp_id):
    """Get schedule info for a CTP: weekdays and lessons count."""
    try:
        ctp = CTP.objects.select_related('school_class', 'subject').get(pk=ctp_id)
    except CTP.DoesNotExist:
        return Response({'detail': 'КТП не найдено'}, status=status.HTTP_404_NOT_FOUND)

    schedule_info = get_schedule_info(ctp)

    # Convert to 1-based weekday names for display
    weekday_names = {0: 'Пн', 1: 'Вт', 2: 'Ср', 3: 'Чт', 4: 'Пт', 5: 'Сб', 6: 'Вс'}
    schedule_display = [
        {'weekday': wd, 'weekday_name': weekday_names.get(wd, '?'), 'lessons_count': count}
        for wd, count in sorted(schedule_info.items())
    ]

    total_per_week = sum(schedule_info.values())

    # Calculate required lessons for the school year (Sept 1 - May 31)
    from datetime import date
    today = date.today()
    if today.month >= 9:
        school_year_start = date(today.year, 9, 1)
    else:
        school_year_start = date(today.year - 1, 9, 1)

    required_count = get_required_lessons_count(ctp, school_year_start)

    return Response({
        'schedule': schedule_display,
        'total_per_week': total_per_week,
        'required_count': required_count,
        'has_schedule': len(schedule_info) > 0,
    })


# --- Topic Files ---

@api_view(['POST'])
@permission_classes([IsAuthenticated, PasswordChanged])
@parser_classes([MultiPartParser])
def topic_file_upload(request, pk):
    """Upload a file to a topic."""
    try:
        topic = Topic.objects.select_related('ctp').get(pk=pk)
    except Topic.DoesNotExist:
        return Response({'detail': 'Тема не найдена'}, status=status.HTTP_404_NOT_FOUND)

    if topic.ctp.teacher != request.user:
        return Response({'detail': 'Нет доступа'}, status=status.HTTP_403_FORBIDDEN)

    file = request.FILES.get('file')
    if not file:
        return Response({'detail': 'Файл не загружен'}, status=status.HTTP_400_BAD_REQUEST)

    topic_file = TopicFile.objects.create(
        topic=topic,
        file=file,
        original_name=file.name,
    )
    return Response(TopicFileSerializer(topic_file).data, status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated, PasswordChanged])
def topic_file_delete(request, pk, file_id):
    """Delete a file from a topic."""
    try:
        topic_file = TopicFile.objects.select_related('topic__ctp').get(pk=file_id, topic_id=pk)
    except TopicFile.DoesNotExist:
        return Response({'detail': 'Файл не найден'}, status=status.HTTP_404_NOT_FOUND)

    if topic_file.topic.ctp.teacher != request.user:
        return Response({'detail': 'Нет доступа'}, status=status.HTTP_403_FORBIDDEN)

    topic_file.file.delete()
    topic_file.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# --- Topics by date ---

@api_view(['GET'])
@permission_classes([IsAuthenticated, PasswordChanged])
def topics_by_date(request):
    """Get topics for a specific date, filtered by user's classes."""
    date = request.query_params.get('date')
    if not date:
        return Response({'detail': 'Параметр date обязателен'}, status=status.HTTP_400_BAD_REQUEST)

    topics = Topic.objects.filter(date=date).select_related('ctp__subject', 'ctp__school_class').prefetch_related('files')

    # Parent requesting topics for a specific child
    student_id = request.query_params.get('student_id')
    if request.user.is_parent and student_id:
        try:
            sp = StudentProfile.objects.get(pk=student_id)
            if not request.user.parent_profile.children.filter(pk=sp.pk).exists():
                return Response({'detail': 'Нет доступа'}, status=403)
            topics = topics.filter(ctp__school_class_id=sp.school_class_id, ctp__is_public=True)
        except StudentProfile.DoesNotExist:
            return Response([], status=200)
    else:
        class_ids = _get_user_classes(request.user)
        if class_ids is not None:
            topics = topics.filter(ctp__school_class_id__in=class_ids, ctp__is_public=True)

    topics = topics.order_by('ctp__subject__name', 'order')
    return Response(TopicByDateSerializer(topics, many=True).data)


# --- Holidays ---

@api_view(['GET', 'POST'])
@permission_classes([IsAdmin, PasswordChanged])
def holiday_list_create(request):
    if request.method == 'GET':
        holidays = Holiday.objects.all()
        return Response(HolidaySerializer(holidays, many=True).data)

    serializer = HolidaySerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([IsAdmin, PasswordChanged])
def holiday_delete(request, pk):
    try:
        Holiday.objects.get(pk=pk).delete()
    except Holiday.DoesNotExist:
        return Response({'detail': 'Не найдено'}, status=status.HTTP_404_NOT_FOUND)
    return Response(status=status.HTTP_204_NO_CONTENT)
