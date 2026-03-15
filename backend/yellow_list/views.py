from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, BasePermission
from rest_framework.response import Response

from accounts.permissions import PasswordChanged
from school.models import StudentProfile
from tasks.models import Task
from .models import YellowListEntry, YellowListComment
from .serializers import (
    YellowListEntrySerializer,
    YellowListEntryListSerializer,
    YellowListEntryCreateSerializer,
    YellowListCommentSerializer,
)


def _is_curator_of_student(user, student_user_id):
    """Проверяет, является ли user куратором класса ученика с данным user_id."""
    try:
        sp = StudentProfile.objects.select_related('school_class').get(user_id=student_user_id)
        return sp.school_class is not None and sp.school_class.curator_id == user.id
    except StudentProfile.DoesNotExist:
        return False


class IsSPPSOnly(BasePermission):
    """Only users with is_spps flag (admin without is_spps cannot access)."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_spps


class IsAnyStaff(BasePermission):
    """All staff (admin/teacher/spps) can submit entries."""
    def has_permission(self, request, view):
        u = request.user
        return u.is_authenticated and (u.is_admin or u.is_teacher or u.is_spps)


@api_view(['GET'])
@permission_classes([IsAnyStaff, PasswordChanged])
def students_search(request):
    """Search students for yellow list form. Returns compact list."""
    q = request.query_params.get('q', '').strip()
    if not q:
        return Response([])

    qs = StudentProfile.objects.select_related('user', 'school_class', 'school_class__grade_level').filter(
        Q(user__first_name__icontains=q) |
        Q(user__last_name__icontains=q) |
        Q(school_class__letter__icontains=q) |
        Q(school_class__grade_level__number__icontains=q)
    ).order_by('user__last_name', 'user__first_name')[:20]

    results = []
    for sp in qs:
        results.append({
            'id': sp.user_id,
            'student_profile_id': sp.id,
            'first_name': sp.user.first_name,
            'last_name': sp.user.last_name,
            'school_class_name': str(sp.school_class) if sp.school_class else '',
        })
    return Response(results)


@api_view(['GET'])
@permission_classes([IsSPPSOnly, PasswordChanged])
def unread_count(request):
    """Count of unread entries for SPPS badge."""
    count = YellowListEntry.objects.filter(is_read_by_spps=False).count()
    return Response({'count': count})


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated, PasswordChanged])
def entry_list_create(request):
    if request.method == 'GET':
        # Only SPPS (not admin without spps) can see the list
        if not request.user.is_spps:
            return Response({'detail': 'Недостаточно прав.'}, status=status.HTTP_403_FORBIDDEN)
        qs = YellowListEntry.objects.select_related(
            'student__user', 'student__school_class', 'student__school_class__grade_level',
            'submitted_by'
        ).prefetch_related('comments')
        return Response(YellowListEntryListSerializer(qs, many=True).data)

    # POST — all staff can submit
    u = request.user
    if not (u.is_admin or u.is_teacher or u.is_spps):
        return Response({'detail': 'Недостаточно прав.'}, status=status.HTTP_403_FORBIDDEN)

    serializer = YellowListEntryCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    d = serializer.validated_data

    try:
        student = StudentProfile.objects.get(id=d['student_profile_id'])
    except StudentProfile.DoesNotExist:
        return Response({'detail': 'Ученик не найден.'}, status=status.HTTP_404_NOT_FOUND)

    entry = YellowListEntry.objects.create(
        date=d['date'],
        student=student,
        fact=d['fact'],
        lesson=d.get('lesson', ''),
        submitted_by=request.user,
    )
    return Response(YellowListEntrySerializer(entry).data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsSPPSOnly, PasswordChanged])
def entry_detail(request, pk):
    try:
        entry = YellowListEntry.objects.select_related(
            'student__user', 'student__school_class',
            'submitted_by'
        ).prefetch_related('comments__created_by').get(pk=pk)
    except YellowListEntry.DoesNotExist:
        return Response({'detail': 'Не найдено.'}, status=status.HTTP_404_NOT_FOUND)

    # Mark as read automatically
    if not entry.is_read_by_spps:
        entry.is_read_by_spps = True
        entry.save(update_fields=['is_read_by_spps'])

    return Response(YellowListEntrySerializer(entry).data)


@api_view(['POST'])
@permission_classes([IsSPPSOnly, PasswordChanged])
def add_comment(request, pk):
    try:
        entry = YellowListEntry.objects.get(pk=pk)
    except YellowListEntry.DoesNotExist:
        return Response({'detail': 'Не найдено.'}, status=status.HTTP_404_NOT_FOUND)

    text = request.data.get('text', '').strip()
    if not text:
        return Response({'detail': 'Комментарий не может быть пустым.'}, status=status.HTTP_400_BAD_REQUEST)

    comment = YellowListComment.objects.create(entry=entry, text=text, created_by=request.user)
    return Response(YellowListCommentSerializer(comment).data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsSPPSOnly, PasswordChanged])
def create_task_from_entry(request, pk):
    try:
        entry = YellowListEntry.objects.select_related('student__user', 'student__school_class').get(pk=pk)
    except YellowListEntry.DoesNotExist:
        return Response({'detail': 'Не найдено.'}, status=status.HTTP_404_NOT_FOUND)

    student_name = f'{entry.student.user.last_name} {entry.student.user.first_name}'
    school_class = str(entry.student.school_class) if entry.student.school_class else ''

    default_title = f'СППС: {student_name} ({school_class}) — {entry.date}'
    default_description = f'Ученик: {student_name} ({school_class})\nДата: {entry.date}\n'
    if entry.lesson:
        default_description += f'Урок: {entry.lesson}\n'
    default_description += f'\nФакт:\n{entry.fact}'

    title = request.data.get('title', '').strip() or default_title
    due_date = request.data.get('due_date') or None

    assigned_to_id = request.data.get('assigned_to') or None
    assigned_group_id = request.data.get('assigned_group') or None

    task = Task.objects.create(
        title=title,
        description=default_description,
        created_by=request.user,
        due_date=due_date,
        assigned_to_id=int(assigned_to_id) if assigned_to_id else None,
        assigned_group_id=int(assigned_group_id) if assigned_group_id else None,
    )
    return Response({'task_id': task.id, 'title': task.title}, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated, PasswordChanged])
def student_entries(request, student_id):
    """Записи жёлтого списка по конкретному ученику.
    Доступно: СПСС-пользователи и куратор класса этого ученика.
    """
    u = request.user
    if not u.is_spps:
        if not _is_curator_of_student(u, student_id):
            return Response({'detail': 'Нет доступа.'}, status=status.HTTP_403_FORBIDDEN)

    qs = YellowListEntry.objects.filter(
        student__user_id=student_id
    ).select_related(
        'student__user', 'student__school_class',
        'submitted_by'
    ).prefetch_related('comments').order_by('-date', '-created_at')

    return Response(YellowListEntrySerializer(qs, many=True).data)
