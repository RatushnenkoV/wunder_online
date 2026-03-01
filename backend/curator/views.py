from datetime import date

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from accounts.permissions import IsAdmin, PasswordChanged
from .models import CuratorSection, CuratorField, CuratorHint, CuratorReport, CuratorReportValue
from .serializers import (
    CuratorSectionSerializer, CuratorHintSerializer,
    CuratorReportSerializer,
)


def get_academic_year(d=None):
    d = d or date.today()
    if d.month >= 9:
        return f'{d.year}-{d.year + 1}'
    return f'{d.year - 1}-{d.year}'


def _check_curator_access(request_user, student):
    """Returns True if request_user is admin or curator of student's class."""
    if request_user.is_admin:
        return True
    try:
        sp = student.student_profile
        return sp.school_class.curator_id == request_user.id
    except Exception:
        return False


@api_view(['GET'])
@permission_classes([IsAuthenticated, PasswordChanged])
def structure_view(request):
    """Структура: разделы + поля + подсказки."""
    sections = CuratorSection.objects.prefetch_related('fields__hints').all()
    return Response(CuratorSectionSerializer(sections, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated, PasswordChanged])
def my_class_view(request):
    """Ученики класса, куратором которого является текущий пользователь."""
    user = request.user
    curated = user.curated_classes.first()
    if not curated:
        return Response({'detail': 'Вы не являетесь куратором'}, status=status.HTTP_403_FORBIDDEN)

    from school.models import StudentProfile
    students_qs = StudentProfile.objects.filter(
        school_class=curated
    ).select_related('user').order_by('user__last_name', 'user__first_name')

    year = get_academic_year()
    total_fields = CuratorField.objects.count()
    students = []
    for sp in students_qs:
        u = sp.user
        report = CuratorReport.objects.filter(student=u, academic_year=year).first()
        filled_count = (
            CuratorReportValue.objects.filter(report=report).exclude(value='').count()
            if report else 0
        )
        students.append({
            'id': u.id,
            'first_name': u.first_name,
            'last_name': u.last_name,
            'student_profile_id': sp.id,
            'has_report': report is not None,
            'updated_at': report.updated_at.isoformat() if report else None,
            'filled_count': filled_count,
            'total_fields': total_fields,
        })

    return Response({
        'class_name': str(curated),
        'class_id': curated.id,
        'academic_year': year,
        'students': students,
    })


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated, PasswordChanged])
def student_report_view(request, student_id):
    """GET/PUT кураторского отчёта по ученику."""
    from accounts.models import User
    try:
        student = User.objects.get(pk=student_id, is_student=True)
    except User.DoesNotExist:
        return Response({'detail': 'Ученик не найден'}, status=status.HTTP_404_NOT_FOUND)

    if not _check_curator_access(request.user, student):
        return Response({'detail': 'Нет доступа'}, status=status.HTTP_403_FORBIDDEN)

    year = request.query_params.get('academic_year') or get_academic_year()

    if request.method == 'GET':
        report = CuratorReport.objects.filter(
            student=student, academic_year=year
        ).prefetch_related('values').first()
        if not report:
            return Response({'id': None, 'student': student_id, 'academic_year': year, 'values': []})
        return Response(CuratorReportSerializer(report).data)

    # PUT — upsert report
    report, _ = CuratorReport.objects.get_or_create(
        student=student, academic_year=year,
        defaults={'created_by': request.user},
    )

    values = request.data.get('values', [])
    for val in values:
        field_id = val.get('field')
        value = val.get('value', '')
        if field_id is None:
            continue
        CuratorReportValue.objects.update_or_create(
            report=report, field_id=field_id,
            defaults={'value': value},
        )

    report.save()  # обновляет updated_at
    report.refresh_from_db()
    return Response(CuratorReportSerializer(report).data)


@api_view(['GET', 'POST'])
@permission_classes([IsAdmin, PasswordChanged])
def hints_list_create(request):
    """GET все подсказки (с фильтром ?field=), POST создать."""
    if request.method == 'GET':
        field_id = request.query_params.get('field')
        hints = CuratorHint.objects.all()
        if field_id:
            hints = hints.filter(field_id=field_id)
        return Response(CuratorHintSerializer(hints, many=True).data)

    serializer = CuratorHintSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    hint = serializer.save()
    return Response(CuratorHintSerializer(hint).data, status=status.HTTP_201_CREATED)


@api_view(['PUT', 'DELETE'])
@permission_classes([IsAdmin, PasswordChanged])
def hint_detail(request, pk):
    try:
        hint = CuratorHint.objects.get(pk=pk)
    except CuratorHint.DoesNotExist:
        return Response({'detail': 'Не найдено'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'DELETE':
        hint.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    serializer = CuratorHintSerializer(hint, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    hint = serializer.save()
    return Response(CuratorHintSerializer(hint).data)
