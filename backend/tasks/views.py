import io
import openpyxl
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import IsAdminOrTeacher, PasswordChanged
from .models import Task, TaskFile, TaskGroup
from .serializers import TaskFileSerializer, TaskGroupSerializer, TaskSerializer
from core.validators import validate_file_mime, ALLOWED_IMAGES, ALLOWED_PDF, ALLOWED_EXCEL
from django.core.exceptions import ValidationError

ALLOWED_TASK_FILES = ALLOWED_IMAGES + ALLOWED_PDF + ALLOWED_EXCEL


class TaskPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 200

User = get_user_model()


def _my_tasks_qs(user):
    return (
        Task.objects.filter(
            Q(created_by=user)
            | Q(assigned_to=user)
            | Q(assigned_group__members=user)
        )
        .distinct()
        .select_related('created_by', 'assigned_to', 'assigned_group', 'taken_by')
        .prefetch_related('files')
    )


def _ctx(request):
    return {'request': request}


def _serialize_task(task, request):
    return TaskSerializer(task, context=_ctx(request)).data


def _serialize_tasks(qs, request):
    return TaskSerializer(qs, many=True, context=_ctx(request)).data


def _serialize_groups(qs, request):
    return TaskGroupSerializer(qs, many=True, context=_ctx(request)).data


# ─── Сотрудники ───────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAdminOrTeacher, PasswordChanged])
def staff_list(request):
    users = list(User.objects.filter(
        Q(is_admin=True) | Q(is_teacher=True)
    ).order_by('last_name', 'first_name'))

    # Вычислить загруженность каждого сотрудника по активным задачам
    active_tasks = list(
        Task.objects.filter(
            status__in=[Task.STATUS_NEW, Task.STATUS_IN_PROGRESS, Task.STATUS_REVIEW]
        ).prefetch_related('assigned_group__members')
    )

    # user_id -> {'has_active': bool, 'has_urgent': bool}
    workload_map: dict = {}
    for task in active_tasks:
        uid_set: set = set()
        if task.assigned_to_id:
            uid_set.add(task.assigned_to_id)
        if task.assigned_group_id:
            for m in task.assigned_group.members.all():
                uid_set.add(m.id)
        for uid in uid_set:
            entry = workload_map.setdefault(uid, {'has_active': False, 'has_urgent': False})
            entry['has_active'] = True
            if task.priority == Task.PRIORITY_HIGH:
                entry['has_urgent'] = True

    result = []
    for u in users:
        w = workload_map.get(u.id, {})
        if w.get('has_urgent'):
            load = 'red'
        elif w.get('has_active'):
            load = 'yellow'
        else:
            load = 'green'
        result.append({
            'id': u.id,
            'first_name': u.first_name,
            'last_name': u.last_name,
            'workload': load,
        })
    return Response(result)


# ─── Группы ───────────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated, PasswordChanged])
def group_list_create(request):
    if request.method == 'GET':
        groups = TaskGroup.objects.all().prefetch_related('members')
        return Response(_serialize_groups(groups, request))

    if not request.user.is_admin:
        return Response({'error': 'Только администраторы могут создавать группы'}, status=403)

    serializer = TaskGroupSerializer(data=request.data, context=_ctx(request))
    if serializer.is_valid():
        serializer.save(created_by=request.user)
        return Response(serializer.data, status=201)
    return Response(serializer.errors, status=400)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated, PasswordChanged])
def group_detail(request, group_id):
    group = get_object_or_404(TaskGroup, id=group_id)

    if request.method == 'GET':
        return Response(TaskGroupSerializer(group, context=_ctx(request)).data)

    if not request.user.is_admin:
        return Response({'error': 'Только администраторы могут изменять группы'}, status=403)

    if request.method == 'PUT':
        serializer = TaskGroupSerializer(group, data=request.data, partial=True, context=_ctx(request))
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    group.delete()
    return Response(status=204)


@api_view(['POST'])
@permission_classes([IsAdminOrTeacher, PasswordChanged])
def group_members(request, group_id):
    group = get_object_or_404(TaskGroup, id=group_id)
    action = request.data.get('action')

    if action not in ('add', 'remove'):
        return Response({'error': 'Укажите action (add/remove)'}, status=400)

    if request.user.is_admin:
        user_id = request.data.get('user_id')
        if not user_id:
            return Response({'error': 'Укажите user_id'}, status=400)
        member = get_object_or_404(User, id=user_id)
    else:
        member = request.user

    if action == 'add':
        group.members.add(member)
    else:
        group.members.remove(member)

    return Response(TaskGroupSerializer(group, context=_ctx(request)).data)


# ─── Задачи ───────────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated, PasswordChanged])
def task_list_create(request):
    if request.method == 'GET':
        tasks = _my_tasks_qs(request.user)
        if request.query_params.get('status'):
            tasks = tasks.filter(status=request.query_params['status'])
        paginator = TaskPagination()
        page = paginator.paginate_queryset(tasks, request)
        if page is not None:
            return paginator.get_paginated_response(_serialize_tasks(page, request))
        return Response(_serialize_tasks(tasks, request))

    if not (request.user.is_admin or request.user.is_teacher):
        return Response({'error': 'Только сотрудники могут создавать задачи'}, status=403)

    serializer = TaskSerializer(data=request.data, context=_ctx(request))
    if serializer.is_valid():
        task = serializer.save(created_by=request.user, status=Task.STATUS_NEW)
        return Response(_serialize_task(task, request), status=201)
    return Response(serializer.errors, status=400)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated, PasswordChanged])
def task_detail(request, task_id):
    task = get_object_or_404(
        Task.objects.select_related('created_by', 'assigned_to', 'assigned_group', 'taken_by')
            .prefetch_related('files'),
        id=task_id,
    )

    can_view = (
        task.created_by_id == request.user.id
        or task.is_assignee(request.user)
        or request.user.is_admin
    )
    if not can_view:
        return Response({'error': 'Нет доступа'}, status=403)

    if request.method == 'GET':
        return Response(_serialize_task(task, request))

    if request.method == 'PUT':
        # Редактировать может создатель или admin
        if task.created_by_id != request.user.id and not request.user.is_admin:
            return Response({'error': 'Нет доступа'}, status=403)
        serializer = TaskSerializer(task, data=request.data, partial=True, context=_ctx(request))
        if serializer.is_valid():
            task = serializer.save()
            return Response(_serialize_task(task, request))
        return Response(serializer.errors, status=400)

    # DELETE — только создатель
    if task.created_by_id != request.user.id:
        return Response({'error': 'Удалить задачу может только её создатель'}, status=403)
    task.delete()
    return Response(status=204)


@api_view(['POST'])
@permission_classes([IsAuthenticated, PasswordChanged])
def task_status_change(request, task_id):
    task = get_object_or_404(Task, id=task_id)
    new_status = request.data.get('status')

    is_creator = task.created_by_id == request.user.id
    is_assignee = task.is_assignee(request.user)
    is_admin = request.user.is_admin

    # new→in_progress и in_progress→review: только исполнитель (не admin, не creator)
    # review→done/in_progress: создатель или admin
    TRANSITIONS = {
        Task.STATUS_NEW: {
            Task.STATUS_IN_PROGRESS: is_assignee,
        },
        Task.STATUS_IN_PROGRESS: {
            Task.STATUS_REVIEW: is_assignee,
        },
        Task.STATUS_REVIEW: {
            Task.STATUS_DONE: is_creator or is_admin,
            Task.STATUS_IN_PROGRESS: is_creator or is_admin,
        },
    }

    allowed = TRANSITIONS.get(task.status, {})

    if new_status not in allowed:
        return Response(
            {'error': f'Переход "{task.status}" → "{new_status}" невозможен'},
            status=400,
        )
    if not allowed[new_status]:
        return Response({'error': 'Недостаточно прав для этого перехода'}, status=403)

    old_status = task.status
    task.status = new_status
    # Фиксируем кто взял в работу
    if new_status == Task.STATUS_IN_PROGRESS and task.taken_by is None:
        task.taken_by = request.user
    # Комментарий при отправке на доработку (review→in_progress); сбрасываем иначе
    if new_status == Task.STATUS_IN_PROGRESS and old_status == Task.STATUS_REVIEW:
        task.review_comment = request.data.get('comment', '')
    else:
        task.review_comment = ''
    # Фиксируем дату выполнения
    if new_status == Task.STATUS_DONE:
        task.completed_at = timezone.now()
    else:
        task.completed_at = None
    task.save()
    return Response(_serialize_task(task, request))


@api_view(['POST'])
@permission_classes([IsAuthenticated, PasswordChanged])
def task_reassign(request, task_id):
    """Переназначить исполнителя. Статус сбрасывается в 'new'."""
    task = get_object_or_404(Task, id=task_id)

    if not task.can_reassign(request.user):
        return Response({'error': 'Нет доступа для переназначения'}, status=403)

    assigned_to_id = request.data.get('assigned_to')
    assigned_group_id = request.data.get('assigned_group')

    if not assigned_to_id and not assigned_group_id:
        return Response({'error': 'Укажите исполнителя или группу'}, status=400)
    if assigned_to_id and assigned_group_id:
        return Response({'error': 'Укажите либо исполнителя, либо группу'}, status=400)

    if assigned_to_id:
        task.assigned_to_id = assigned_to_id
        task.assigned_group = None
    else:
        task.assigned_group_id = assigned_group_id
        task.assigned_to = None

    task.status = Task.STATUS_NEW
    task.taken_by = None
    task.save()
    return Response(_serialize_task(task, request))


# ─── Файлы задач ──────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated, PasswordChanged])
def task_file_upload(request, task_id):
    task = get_object_or_404(Task, id=task_id)

    can_access = (
        task.created_by_id == request.user.id
        or task.is_assignee(request.user)
        or request.user.is_admin
    )
    if not can_access:
        return Response({'error': 'Нет доступа'}, status=403)

    f = request.FILES.get('file')
    if not f:
        return Response({'error': 'Файл не передан'}, status=400)

    try:
        validate_file_mime(f, ALLOWED_TASK_FILES, label='вложение задачи')
    except ValidationError as e:
        return Response({'error': str(e)}, status=400)

    task_file = TaskFile.objects.create(
        task=task,
        file=f,
        original_name=f.name,
        uploaded_by=request.user,
    )
    return Response(TaskFileSerializer(task_file, context=_ctx(request)).data, status=201)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated, PasswordChanged])
def task_file_delete(request, task_id, file_id):
    task = get_object_or_404(Task, id=task_id)
    task_file = get_object_or_404(TaskFile, id=file_id, task=task)

    can_delete = (
        task_file.uploaded_by_id == request.user.id
        or task.created_by_id == request.user.id
        or request.user.is_admin
    )
    if not can_delete:
        return Response({'error': 'Нет доступа'}, status=403)

    task_file.file.delete(save=False)
    task_file.delete()
    return Response(status=204)


# ─── Счётчик ──────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated, PasswordChanged])
def task_report(request):
    """Отчёт по всем задачам — только для администраторов."""
    if not request.user.is_admin:
        return Response({'error': 'Только администраторы'}, status=403)

    qs = (
        Task.objects.all()
        .select_related('created_by', 'assigned_to', 'assigned_group', 'taken_by')
        .prefetch_related('files')
        .order_by('-created_at')
    )

    # Фильтры
    date_from = request.query_params.get('date_from')
    date_to = request.query_params.get('date_to')
    if date_from:
        qs = qs.filter(created_at__date__gte=date_from)
    if date_to:
        qs = qs.filter(created_at__date__lte=date_to)

    status_filter = request.query_params.get('status')
    if status_filter:
        qs = qs.filter(status=status_filter)

    priority_filter = request.query_params.get('priority')
    if priority_filter:
        qs = qs.filter(priority=priority_filter)

    assigned_to_filter = request.query_params.get('assigned_to')
    if assigned_to_filter:
        qs = qs.filter(assigned_to_id=assigned_to_filter)

    created_by_filter = request.query_params.get('created_by')
    if created_by_filter:
        qs = qs.filter(created_by_id=created_by_filter)

    search = request.query_params.get('search')
    if search:
        qs = qs.filter(Q(title__icontains=search) | Q(description__icontains=search))

    # Выгрузка в Excel
    if request.query_params.get('export') == 'excel':
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = 'Задачи'

        priority_labels = {
            Task.PRIORITY_LOW: 'Не срочно',
            Task.PRIORITY_MEDIUM: 'Средний',
            Task.PRIORITY_HIGH: 'Срочный',
        }
        status_labels = {
            Task.STATUS_NEW: 'Поставленная',
            Task.STATUS_IN_PROGRESS: 'В работе',
            Task.STATUS_REVIEW: 'На проверке',
            Task.STATUS_DONE: 'Выполнено',
        }

        ws.append([
            'ID', 'Заголовок', 'Описание', 'Приоритет', 'Статус',
            'Постановщик', 'Исполнитель', 'Взял в работу',
            'Срок', 'Дата создания', 'Дата выполнения',
        ])

        for task in qs:
            if task.assigned_to:
                assignee = f'{task.assigned_to.last_name} {task.assigned_to.first_name}'
            elif task.assigned_group:
                assignee = task.assigned_group.name
            else:
                assignee = ''

            ws.append([
                task.id,
                task.title,
                task.description,
                priority_labels.get(task.priority, task.priority),
                status_labels.get(task.status, task.status),
                f'{task.created_by.last_name} {task.created_by.first_name}' if task.created_by else '',
                assignee,
                f'{task.taken_by.last_name} {task.taken_by.first_name}' if task.taken_by else '',
                str(task.due_date) if task.due_date else '',
                task.created_at.strftime('%d.%m.%Y %H:%M') if task.created_at else '',
                task.completed_at.strftime('%d.%m.%Y %H:%M') if task.completed_at else '',
            ])

        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        response = HttpResponse(
            buf.read(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = 'attachment; filename="tasks_report.xlsx"'
        return response

    # JSON с пагинацией
    paginator = TaskPagination()
    page = paginator.paginate_queryset(qs, request)
    if page is not None:
        return paginator.get_paginated_response(_serialize_tasks(page, request))
    return Response(_serialize_tasks(qs, request))


@api_view(['GET'])
@permission_classes([IsAuthenticated, PasswordChanged])
def tasks_count(request):
    new_count = (
        Task.objects.filter(
            Q(assigned_to=request.user) | Q(assigned_group__members=request.user),
            status=Task.STATUS_NEW,
        )
        .distinct()
        .count()
    )
    review_count = Task.objects.filter(
        created_by=request.user,
        status=Task.STATUS_REVIEW,
    ).count()
    return Response({'new': new_count, 'review': review_count, 'total': new_count + review_count})
