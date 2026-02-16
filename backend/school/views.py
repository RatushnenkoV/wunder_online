from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from accounts.permissions import IsAdmin, PasswordChanged
from accounts.models import User
from .models import (
    GradeLevel, SchoolClass, Subject, GradeLevelSubject,
    StudentProfile, ParentProfile, TeacherProfile,
    ClassGroup, ClassSubject,
)
from .serializers import (
    GradeLevelSerializer, SchoolClassSerializer, SubjectSerializer,
    GradeLevelSubjectSerializer, StudentProfileSerializer, ParentProfileSerializer,
    ClassGroupSerializer, ClassSubjectSerializer,
)
from .services import import_classes


# --- Grade Levels ---

@api_view(['GET', 'POST'])
@permission_classes([IsAdmin, PasswordChanged])
def grade_level_list_create(request):
    if request.method == 'GET':
        levels = GradeLevel.objects.all()
        return Response(GradeLevelSerializer(levels, many=True).data)

    number = request.data.get('number')
    if not number:
        return Response({'detail': 'Номер параллели обязателен'}, status=status.HTTP_400_BAD_REQUEST)

    level, created = GradeLevel.objects.get_or_create(number=number)
    return Response(GradeLevelSerializer(level).data, status=status.HTTP_201_CREATED if created else 200)


@api_view(['DELETE'])
@permission_classes([IsAdmin, PasswordChanged])
def grade_level_delete(request, pk):
    try:
        GradeLevel.objects.get(pk=pk).delete()
    except GradeLevel.DoesNotExist:
        return Response({'detail': 'Не найдено'}, status=status.HTTP_404_NOT_FOUND)
    return Response(status=status.HTTP_204_NO_CONTENT)


# --- School Classes ---

@api_view(['GET', 'POST'])
@permission_classes([IsAdmin, PasswordChanged])
def school_class_list_create(request):
    if request.method == 'GET':
        classes = SchoolClass.objects.select_related('grade_level').all()
        grade = request.query_params.get('grade_level')
        if grade:
            classes = classes.filter(grade_level_id=grade)
        return Response(SchoolClassSerializer(classes, many=True).data)

    serializer = SchoolClassSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    sc = SchoolClass.objects.create(
        grade_level_id=request.data['grade_level'],
        letter=request.data['letter'].upper(),
    )
    return Response(SchoolClassSerializer(sc).data, status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([IsAdmin, PasswordChanged])
def school_class_delete(request, pk):
    try:
        SchoolClass.objects.get(pk=pk).delete()
    except SchoolClass.DoesNotExist:
        return Response({'detail': 'Не найдено'}, status=status.HTTP_404_NOT_FOUND)
    return Response(status=status.HTTP_204_NO_CONTENT)


# --- Subjects ---

@api_view(['GET', 'POST'])
@permission_classes([IsAdmin, PasswordChanged])
def subject_list_create(request):
    if request.method == 'GET':
        subjects = Subject.objects.all()
        return Response(SubjectSerializer(subjects, many=True).data)

    name = request.data.get('name', '').strip()
    if not name:
        return Response({'detail': 'Название предмета обязательно'}, status=status.HTTP_400_BAD_REQUEST)

    subject, created = Subject.objects.get_or_create(name=name)
    return Response(SubjectSerializer(subject).data, status=status.HTTP_201_CREATED if created else 200)


@api_view(['DELETE'])
@permission_classes([IsAdmin, PasswordChanged])
def subject_delete(request, pk):
    try:
        Subject.objects.get(pk=pk).delete()
    except Subject.DoesNotExist:
        return Response({'detail': 'Не найдено'}, status=status.HTTP_404_NOT_FOUND)
    return Response(status=status.HTTP_204_NO_CONTENT)


# --- Grade Level Subjects ---

@api_view(['GET', 'POST'])
@permission_classes([IsAdmin, PasswordChanged])
def grade_subject_list_create(request):
    if request.method == 'GET':
        links = GradeLevelSubject.objects.select_related('grade_level', 'subject').all()
        grade = request.query_params.get('grade_level')
        if grade:
            links = links.filter(grade_level_id=grade)
        return Response(GradeLevelSubjectSerializer(links, many=True).data)

    grade_id = request.data.get('grade_level')
    subject_id = request.data.get('subject')
    if not grade_id or not subject_id:
        return Response({'detail': 'grade_level и subject обязательны'}, status=status.HTTP_400_BAD_REQUEST)

    link, created = GradeLevelSubject.objects.get_or_create(grade_level_id=grade_id, subject_id=subject_id)
    return Response(GradeLevelSubjectSerializer(link).data, status=status.HTTP_201_CREATED if created else 200)


@api_view(['DELETE'])
@permission_classes([IsAdmin, PasswordChanged])
def grade_subject_delete(request, pk):
    try:
        GradeLevelSubject.objects.get(pk=pk).delete()
    except GradeLevelSubject.DoesNotExist:
        return Response({'detail': 'Не найдено'}, status=status.HTTP_404_NOT_FOUND)
    return Response(status=status.HTTP_204_NO_CONTENT)


# --- Students in class ---

@api_view(['GET'])
@permission_classes([IsAdmin, PasswordChanged])
def class_students(request, class_id):
    students = StudentProfile.objects.filter(school_class_id=class_id).select_related('user')
    return Response(StudentProfileSerializer(students, many=True).data)


# --- Parents of student ---

@api_view(['GET'])
@permission_classes([IsAdmin, PasswordChanged])
def student_parents(request, student_id):
    parents = ParentProfile.objects.filter(children__id=student_id).select_related('user')
    return Response(ParentProfileSerializer(parents, many=True).data)


# --- Import classes ---

@api_view(['POST'])
@permission_classes([IsAdmin, PasswordChanged])
@parser_classes([MultiPartParser])
def import_classes_view(request):
    file = request.FILES.get('file')
    if not file:
        return Response({'detail': 'Файл не загружен'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        result = import_classes(file)
    except ValueError as e:
        return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    return Response({
        'students_count': len(result['students']),
        'parents_count': len(result['parents']),
        'errors': result['errors'],
    })


# --- Class Groups ---

@api_view(['GET', 'POST'])
@permission_classes([IsAdmin, PasswordChanged])
def class_group_list_create(request, class_id):
    try:
        sc = SchoolClass.objects.get(pk=class_id)
    except SchoolClass.DoesNotExist:
        return Response({'detail': 'Класс не найден'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        groups = ClassGroup.objects.filter(school_class=sc).prefetch_related('students')
        return Response(ClassGroupSerializer(groups, many=True).data)

    name = request.data.get('name', '').strip()
    if not name:
        return Response({'detail': 'Название группы обязательно'}, status=status.HTTP_400_BAD_REQUEST)

    group = ClassGroup.objects.create(school_class=sc, name=name)
    student_ids = request.data.get('students', [])
    if student_ids:
        group.students.set(student_ids)
    return Response(ClassGroupSerializer(group).data, status=status.HTTP_201_CREATED)


@api_view(['PUT', 'DELETE'])
@permission_classes([IsAdmin, PasswordChanged])
def class_group_detail(request, pk):
    try:
        group = ClassGroup.objects.get(pk=pk)
    except ClassGroup.DoesNotExist:
        return Response({'detail': 'Группа не найдена'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'DELETE':
        group.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    name = request.data.get('name', '').strip()
    if name:
        group.name = name

    student_ids = request.data.get('students')
    if student_ids is not None:
        group.students.set(student_ids)

    group.save()
    return Response(ClassGroupSerializer(group).data)


# --- Class Subjects ---

@api_view(['GET', 'POST'])
@permission_classes([IsAdmin, PasswordChanged])
def class_subject_list_create(request, class_id):
    try:
        sc = SchoolClass.objects.get(pk=class_id)
    except SchoolClass.DoesNotExist:
        return Response({'detail': 'Класс не найден'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        subjects = ClassSubject.objects.filter(school_class=sc).select_related('teacher', 'group')
        return Response(ClassSubjectSerializer(subjects, many=True).data)

    # Batch create
    entries = request.data if isinstance(request.data, list) else [request.data]
    created = []
    errors = []
    for i, entry in enumerate(entries):
        name = (entry.get('name') or '').strip()
        if not name:
            errors.append(f'Запись {i+1}: название обязательно')
            continue
        cs = ClassSubject.objects.create(
            school_class=sc,
            name=name,
            teacher_id=entry.get('teacher') or None,
            group_id=entry.get('group') or None,
        )
        created.append(cs)

    return Response({
        'created': ClassSubjectSerializer(created, many=True).data,
        'errors': errors,
    }, status=status.HTTP_201_CREATED)


@api_view(['PUT', 'DELETE'])
@permission_classes([IsAdmin, PasswordChanged])
def class_subject_detail(request, pk):
    try:
        cs = ClassSubject.objects.get(pk=pk)
    except ClassSubject.DoesNotExist:
        return Response({'detail': 'Предмет не найден'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'DELETE':
        cs.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    name = request.data.get('name', '').strip()
    if name:
        cs.name = name
    if 'teacher' in request.data:
        cs.teacher_id = request.data['teacher'] or None
    if 'group' in request.data:
        cs.group_id = request.data['group'] or None

    cs.save()
    return Response(ClassSubjectSerializer(cs).data)


# --- Teachers list (lightweight) ---

@api_view(['GET'])
@permission_classes([IsAdmin, PasswordChanged])
def teacher_list(request):
    teachers = User.objects.filter(is_teacher=True).order_by('last_name', 'first_name')
    data = [{'id': t.id, 'first_name': t.first_name, 'last_name': t.last_name} for t in teachers]
    return Response(data)
