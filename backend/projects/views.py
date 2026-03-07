import mimetypes

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db.models import Q
from django.utils import timezone
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import PasswordChanged
from core.validators import validate_file_mime, ALLOWED_IMAGES, ALLOWED_PDF, ALLOWED_EXCEL

ALLOWED_PROJECT_FILES = ALLOWED_IMAGES + ALLOWED_PDF + ALLOWED_EXCEL
from tasks.models import Task
from .models import (
    Project, ProjectMember, ProjectPost, PostAttachment,
    ProjectAssignment, AssignmentAttachment, AssignmentSubmission, SubmissionFile,
)
from .serializers import (
    ProjectSerializer, ProjectDetailSerializer, ProjectMemberSerializer,
    ProjectUserSerializer, ProjectPostSerializer, PostAttachmentSerializer,
    ProjectAssignmentSerializer, AssignmentAttachmentSerializer,
    AssignmentSubmissionSerializer,
)

User = get_user_model()


def _append_event(submission, event_type, author, comment=''):
    """Добавить событие в лог сдачи."""
    events = list(submission.events or [])
    events.append({
        'type': event_type,
        'author': f'{author.last_name} {author.first_name}'.strip(),
        'comment': comment,
        'at': timezone.now().isoformat(),
    })
    submission.events = events
    submission.save(update_fields=['events'])


def broadcast_project(project_id, event):
    """Отправить событие всем WebSocket-клиентам проекта."""
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(f'project_{project_id}', event)


def _create_task_for_student(assignment, student, teacher):
    """Создать Task для студента по заданию (если ещё нет) и создать/обновить AssignmentSubmission."""
    # Если submission с task уже есть — не дублируем
    existing = AssignmentSubmission.objects.filter(
        assignment=assignment, student=student
    ).first()
    if existing and existing.task_id:
        return existing

    task = Task.objects.create(
        title=assignment.title,
        description=assignment.description or '',
        created_by=teacher,
        assigned_to=student,
        status=Task.STATUS_NEW,
        due_date=assignment.due_date,
    )

    if existing:
        existing.task = task
        existing.save(update_fields=['task'])
        return existing
    else:
        return AssignmentSubmission.objects.create(
            assignment=assignment,
            student=student,
            task=task,
        )


def _is_member(project, user):
    return user.is_admin or project.members_rel.filter(user=user).exists()


def _is_teacher_in_project(project, user):
    if user.is_admin:
        return True
    return project.members_rel.filter(user=user, role=ProjectMember.ROLE_TEACHER).exists()


def _get_project(pk, user, require_teacher=False):
    try:
        project = Project.objects.get(pk=pk)
    except Project.DoesNotExist:
        return None, Response({'detail': 'Не найдено.'}, status=404)
    if not _is_member(project, user):
        return None, Response({'detail': 'Нет доступа.'}, status=403)
    if require_teacher and not _is_teacher_in_project(project, user):
        return None, Response({'detail': 'Только педагоги могут выполнять это действие.'}, status=403)
    return project, None


# ─── Projects ─────────────────────────────────────────────────────────────────

class ProjectListView(APIView):
    permission_classes = [PasswordChanged]

    def get(self, request):
        project_ids = ProjectMember.objects.filter(
            user=request.user
        ).values_list('project_id', flat=True)
        projects = Project.objects.filter(
            id__in=project_ids
        ).prefetch_related('members_rel__user')
        serializer = ProjectSerializer(projects, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request):
        if not (request.user.is_teacher or request.user.is_admin):
            return Response({'detail': 'Только педагоги могут создавать проекты.'}, status=403)
        name = request.data.get('name', '').strip()
        if not name:
            return Response({'detail': 'Название обязательно.'}, status=400)
        project = Project.objects.create(
            name=name,
            description=request.data.get('description', ''),
            cover_color=request.data.get('cover_color', '#6366f1'),
            created_by=request.user,
        )
        ProjectMember.objects.create(
            project=project, user=request.user, role=ProjectMember.ROLE_TEACHER
        )
        serializer = ProjectDetailSerializer(project, context={'request': request})
        return Response(serializer.data, status=201)


class ProjectDetailView(APIView):
    permission_classes = [PasswordChanged]

    def get(self, request, pk):
        project, err = _get_project(pk, request.user)
        if err:
            return err
        serializer = ProjectDetailSerializer(project, context={'request': request})
        return Response(serializer.data)

    def put(self, request, pk):
        project, err = _get_project(pk, request.user, require_teacher=True)
        if err:
            return err
        project.name = request.data.get('name', project.name).strip() or project.name
        project.description = request.data.get('description', project.description)
        project.cover_color = request.data.get('cover_color', project.cover_color)
        project.save()
        return Response(ProjectDetailSerializer(project, context={'request': request}).data)

    def delete(self, request, pk):
        project, err = _get_project(pk, request.user, require_teacher=True)
        if err:
            return err
        if not request.user.is_admin and project.created_by_id != request.user.id:
            return Response({'detail': 'Только создатель проекта может его удалить.'}, status=403)
        project.delete()
        return Response(status=204)


# ─── Users search (for invite) ────────────────────────────────────────────────

class ProjectUsersView(APIView):
    permission_classes = [PasswordChanged]

    def get(self, request):
        q = request.query_params.get('q', '').strip()
        exclude_project_id = request.query_params.get('project_id')

        qs = User.objects.filter(
            is_active=True,
        ).filter(
            Q(is_student=True) | Q(is_teacher=True) | Q(is_admin=True)
        ).exclude(id=request.user.id)

        if q:
            qs = qs.filter(Q(last_name__icontains=q) | Q(first_name__icontains=q))

        if exclude_project_id:
            already_in = ProjectMember.objects.filter(
                project_id=exclude_project_id
            ).values_list('user_id', flat=True)
            qs = qs.exclude(id__in=already_in)

        qs = qs.distinct()[:30]
        serializer = ProjectUserSerializer(qs, many=True)
        return Response(serializer.data)


# ─── Members ──────────────────────────────────────────────────────────────────

class ProjectMembersView(APIView):
    permission_classes = [PasswordChanged]

    def get(self, request, pk):
        project, err = _get_project(pk, request.user)
        if err:
            return err
        members = project.members_rel.select_related('user').all()
        serializer = ProjectMemberSerializer(members, many=True)
        return Response(serializer.data)

    def post(self, request, pk):
        project, err = _get_project(pk, request.user, require_teacher=True)
        if err:
            return err
        user_id = request.data.get('user_id')
        role = request.data.get('role', ProjectMember.ROLE_STUDENT)
        if role not in (ProjectMember.ROLE_TEACHER, ProjectMember.ROLE_STUDENT):
            role = ProjectMember.ROLE_STUDENT
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response({'detail': 'Пользователь не найден.'}, status=404)
        member, created = ProjectMember.objects.get_or_create(
            project=project, user=user,
            defaults={'role': role},
        )
        if not created:
            member.role = role
            member.save()
        # Если добавляем студента — создаём Tasks для всех существующих заданий
        if role == ProjectMember.ROLE_STUDENT:
            teacher = project.created_by or request.user
            for assignment in project.assignments.all():
                _create_task_for_student(assignment, user, teacher)
        serializer = ProjectMemberSerializer(member)
        return Response(serializer.data, status=201 if created else 200)


class ProjectMemberDetailView(APIView):
    permission_classes = [PasswordChanged]

    def delete(self, request, pk, uid):
        project, err = _get_project(pk, request.user, require_teacher=True)
        if err:
            return err
        # Нельзя удалить себя если ты единственный учитель
        if str(request.user.id) == str(uid):
            return Response({'detail': 'Нельзя удалить себя из проекта.'}, status=400)
        try:
            member = ProjectMember.objects.get(project=project, user_id=uid)
        except ProjectMember.DoesNotExist:
            return Response({'detail': 'Участник не найден.'}, status=404)
        member.delete()
        return Response(status=204)


# ─── Posts (лента) ─────────────────────────────────────────────────────────────

class ProjectPostListView(APIView):
    permission_classes = [PasswordChanged]

    def get(self, request, pk):
        project, err = _get_project(pk, request.user)
        if err:
            return err
        before = request.query_params.get('before')
        qs = project.posts.select_related('author').prefetch_related('attachments')
        if before:
            try:
                qs = qs.filter(id__lt=int(before))
            except (ValueError, TypeError):
                pass
        posts = list(qs.order_by('-created_at')[:50])
        posts.reverse()
        serializer = ProjectPostSerializer(posts, many=True)
        return Response({'results': serializer.data, 'has_more': qs.count() > 50})

    def post(self, request, pk):
        project, err = _get_project(pk, request.user)
        if err:
            return err
        text = request.data.get('text', '').strip()
        if not text:
            return Response({'detail': 'Текст обязателен.'}, status=400)
        post = ProjectPost.objects.create(project=project, author=request.user, text=text)
        serialized = ProjectPostSerializer(post).data
        broadcast_project(pk, {'type': 'project_post_new', 'post': serialized})
        return Response(serialized, status=201)


class ProjectPostDetailView(APIView):
    permission_classes = [PasswordChanged]

    def delete(self, request, pk, pid):
        project, err = _get_project(pk, request.user)
        if err:
            return err
        try:
            post = ProjectPost.objects.get(pk=pid, project=project)
        except ProjectPost.DoesNotExist:
            return Response({'detail': 'Не найдено.'}, status=404)
        # Удалить может автор или учитель/admin
        if post.author_id != request.user.id and not _is_teacher_in_project(project, request.user):
            return Response({'detail': 'Нет прав.'}, status=403)
        post.is_deleted = True
        post.text = ''
        post.save()
        broadcast_project(pk, {'type': 'project_post_deleted', 'post_id': pid})
        return Response(status=204)


class ProjectPostFileView(APIView):
    permission_classes = [PasswordChanged]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, pk, pid):
        project, err = _get_project(pk, request.user)
        if err:
            return err
        try:
            post = ProjectPost.objects.get(pk=pid, project=project)
        except ProjectPost.DoesNotExist:
            return Response({'detail': 'Не найдено.'}, status=404)
        if post.author_id != request.user.id:
            return Response({'detail': 'Нет прав.'}, status=403)
        f = request.FILES.get('file')
        if not f:
            return Response({'detail': 'Файл обязателен.'}, status=400)
        try:
            validate_file_mime(f, ALLOWED_PROJECT_FILES, label='вложение поста')
        except ValidationError as e:
            return Response({'detail': str(e)}, status=400)
        mime = mimetypes.guess_type(f.name)[0] or 'application/octet-stream'
        attachment = PostAttachment.objects.create(
            post=post,
            file=f,
            original_name=f.name,
            file_size=f.size,
            mime_type=mime,
        )
        # Обновить пост в WS
        post.refresh_from_db()
        serialized = ProjectPostSerializer(post).data
        broadcast_project(pk, {'type': 'project_post_updated', 'post': serialized})
        return Response(PostAttachmentSerializer(attachment).data, status=201)


# ─── Assignments ───────────────────────────────────────────────────────────────

class ProjectAssignmentListView(APIView):
    permission_classes = [PasswordChanged]

    def get(self, request, pk):
        project, err = _get_project(pk, request.user)
        if err:
            return err
        assignments = project.assignments.select_related('created_by').prefetch_related(
            'attachments', 'submissions__student', 'submissions__files'
        )
        serializer = ProjectAssignmentSerializer(
            assignments, many=True, context={'request': request}
        )
        return Response(serializer.data)

    def post(self, request, pk):
        project, err = _get_project(pk, request.user, require_teacher=True)
        if err:
            return err
        title = request.data.get('title', '').strip()
        if not title:
            return Response({'detail': 'Название обязательно.'}, status=400)
        assignment = ProjectAssignment.objects.create(
            project=project,
            title=title,
            description=request.data.get('description', ''),
            due_date=request.data.get('due_date') or None,
            created_by=request.user,
        )
        # Автоматически создаём Task для каждого студента в проекте
        student_members = project.members_rel.filter(
            role=ProjectMember.ROLE_STUDENT
        ).select_related('user')
        for member in student_members:
            _create_task_for_student(assignment, member.user, request.user)
        serializer = ProjectAssignmentSerializer(assignment, context={'request': request})
        return Response(serializer.data, status=201)


class ProjectAssignmentDetailView(APIView):
    permission_classes = [PasswordChanged]

    def get(self, request, pk, aid):
        project, err = _get_project(pk, request.user)
        if err:
            return err
        try:
            assignment = ProjectAssignment.objects.get(pk=aid, project=project)
        except ProjectAssignment.DoesNotExist:
            return Response({'detail': 'Не найдено.'}, status=404)
        serializer = ProjectAssignmentSerializer(assignment, context={'request': request})
        return Response(serializer.data)

    def put(self, request, pk, aid):
        project, err = _get_project(pk, request.user, require_teacher=True)
        if err:
            return err
        try:
            assignment = ProjectAssignment.objects.get(pk=aid, project=project)
        except ProjectAssignment.DoesNotExist:
            return Response({'detail': 'Не найдено.'}, status=404)
        assignment.title = request.data.get('title', assignment.title).strip() or assignment.title
        assignment.description = request.data.get('description', assignment.description)
        assignment.due_date = request.data.get('due_date') or None
        assignment.save()
        serializer = ProjectAssignmentSerializer(assignment, context={'request': request})
        return Response(serializer.data)

    def delete(self, request, pk, aid):
        project, err = _get_project(pk, request.user, require_teacher=True)
        if err:
            return err
        try:
            assignment = ProjectAssignment.objects.get(pk=aid, project=project)
        except ProjectAssignment.DoesNotExist:
            return Response({'detail': 'Не найдено.'}, status=404)
        assignment.delete()
        return Response(status=204)


class AssignmentFileView(APIView):
    permission_classes = [PasswordChanged]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, pk, aid):
        project, err = _get_project(pk, request.user, require_teacher=True)
        if err:
            return err
        try:
            assignment = ProjectAssignment.objects.get(pk=aid, project=project)
        except ProjectAssignment.DoesNotExist:
            return Response({'detail': 'Не найдено.'}, status=404)
        f = request.FILES.get('file')
        if not f:
            return Response({'detail': 'Файл обязателен.'}, status=400)
        try:
            validate_file_mime(f, ALLOWED_PROJECT_FILES, label='вложение задания')
        except ValidationError as e:
            return Response({'detail': str(e)}, status=400)
        mime = mimetypes.guess_type(f.name)[0] or 'application/octet-stream'
        attachment = AssignmentAttachment.objects.create(
            assignment=assignment,
            file=f,
            original_name=f.name,
            file_size=f.size,
            mime_type=mime,
        )
        return Response(AssignmentAttachmentSerializer(attachment).data, status=201)


# ─── Submissions ───────────────────────────────────────────────────────────────

class AssignmentSubmissionsView(APIView):
    permission_classes = [PasswordChanged]

    def get(self, request, pk, aid):
        project, err = _get_project(pk, request.user)
        if err:
            return err
        try:
            assignment = ProjectAssignment.objects.get(pk=aid, project=project)
        except ProjectAssignment.DoesNotExist:
            return Response({'detail': 'Не найдено.'}, status=404)

        if _is_teacher_in_project(project, request.user):
            # Учитель видит все сдачи
            submissions = assignment.submissions.select_related(
                'student', 'graded_by'
            ).prefetch_related('files')
        else:
            # Студент видит только свою
            submissions = assignment.submissions.filter(
                student=request.user
            ).select_related('student', 'graded_by').prefetch_related('files')

        serializer = AssignmentSubmissionSerializer(
            submissions, many=True, context={'request': request}
        )
        return Response(serializer.data)

    def post(self, request, pk, aid):
        """Студент сдаёт работу (upsert). Переводит Task в статус 'review'."""
        project, err = _get_project(pk, request.user)
        if err:
            return err
        if not request.user.is_student and not request.user.is_admin:
            return Response({'detail': 'Только ученики могут сдавать работы.'}, status=403)
        try:
            assignment = ProjectAssignment.objects.get(pk=aid, project=project)
        except ProjectAssignment.DoesNotExist:
            return Response({'detail': 'Не найдено.'}, status=404)

        text = request.data.get('text', '')
        submission, created = AssignmentSubmission.objects.update_or_create(
            assignment=assignment,
            student=request.user,
            defaults={'text': text},
        )

        # Перевести Task в "На проверке"
        if submission.task and submission.task.status != Task.STATUS_DONE:
            submission.task.status = Task.STATUS_REVIEW
            submission.task.review_comment = ''
            if not submission.task.taken_by:
                submission.task.taken_by = request.user
            submission.task.save(update_fields=['status', 'review_comment', 'taken_by'])

        _append_event(submission, 'submitted', request.user)

        serializer = AssignmentSubmissionSerializer(submission, context={'request': request})
        return Response(serializer.data, status=201 if created else 200)


class AssignmentSubmissionDetailView(APIView):
    permission_classes = [PasswordChanged]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def patch(self, request, pk, aid, sid):
        """Учитель ставит оценку (опционально, не меняет статус задачи)."""
        project, err = _get_project(pk, request.user, require_teacher=True)
        if err:
            return err
        try:
            submission = AssignmentSubmission.objects.get(
                pk=sid, assignment__project=project, assignment_id=aid
            )
        except AssignmentSubmission.DoesNotExist:
            return Response({'detail': 'Не найдено.'}, status=404)

        grade = request.data.get('grade')
        if grade is not None:
            submission.grade = str(grade).strip() or None
            submission.graded_by = request.user
            submission.graded_at = timezone.now()
            submission.save()

        serializer = AssignmentSubmissionSerializer(submission, context={'request': request})
        return Response(serializer.data)


class AcceptSubmissionView(APIView):
    """Учитель принимает работу: Task → done."""
    permission_classes = [PasswordChanged]
    parser_classes = [JSONParser]

    def post(self, request, pk, aid, sid):
        project, err = _get_project(pk, request.user, require_teacher=True)
        if err:
            return err
        try:
            submission = AssignmentSubmission.objects.select_related('task').get(
                pk=sid, assignment__project=project, assignment_id=aid
            )
        except AssignmentSubmission.DoesNotExist:
            return Response({'detail': 'Не найдено.'}, status=404)

        if submission.task:
            submission.task.status = Task.STATUS_DONE
            submission.task.review_comment = ''
            submission.task.completed_at = timezone.now()
            submission.task.save(update_fields=['status', 'review_comment', 'completed_at'])

        # Опциональная оценка
        grade = request.data.get('grade')
        if grade is not None:
            submission.grade = str(grade).strip() or None
            submission.graded_by = request.user
            submission.graded_at = timezone.now()
            submission.save()

        _append_event(submission, 'accepted', request.user)

        serializer = AssignmentSubmissionSerializer(submission, context={'request': request})
        return Response(serializer.data)


class SendBackSubmissionView(APIView):
    """Учитель отправляет на доработку с комментарием: Task → in_progress + review_comment."""
    permission_classes = [PasswordChanged]
    parser_classes = [JSONParser]

    def post(self, request, pk, aid, sid):
        project, err = _get_project(pk, request.user, require_teacher=True)
        if err:
            return err
        try:
            submission = AssignmentSubmission.objects.select_related('task').get(
                pk=sid, assignment__project=project, assignment_id=aid
            )
        except AssignmentSubmission.DoesNotExist:
            return Response({'detail': 'Не найдено.'}, status=404)

        comment = request.data.get('comment', '').strip()

        if submission.task:
            submission.task.status = Task.STATUS_IN_PROGRESS
            submission.task.review_comment = comment
            submission.task.completed_at = None
            submission.task.save(update_fields=['status', 'review_comment', 'completed_at'])

        _append_event(submission, 'sent_back', request.user, comment)

        serializer = AssignmentSubmissionSerializer(submission, context={'request': request})
        return Response(serializer.data)


class SubmissionFileView(APIView):
    permission_classes = [PasswordChanged]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, pk, aid, sid):
        """Студент загружает файл к сдаче. Переводит Task в 'review'."""
        project, err = _get_project(pk, request.user)
        if err:
            return err
        try:
            submission = AssignmentSubmission.objects.select_related('task').get(
                pk=sid, student=request.user, assignment__project=project, assignment_id=aid
            )
        except AssignmentSubmission.DoesNotExist:
            return Response({'detail': 'Не найдено или нет прав.'}, status=404)
        f = request.FILES.get('file')
        if not f:
            return Response({'detail': 'Файл обязателен.'}, status=400)
        try:
            validate_file_mime(f, ALLOWED_PROJECT_FILES, label='файл сдачи')
        except ValidationError as e:
            return Response({'detail': str(e)}, status=400)
        mime = mimetypes.guess_type(f.name)[0] or 'application/octet-stream'
        sub_file = SubmissionFile.objects.create(
            submission=submission,
            file=f,
            original_name=f.name,
            file_size=f.size,
            mime_type=mime,
        )
        # Перевести Task в "На проверке"
        if submission.task and submission.task.status != Task.STATUS_DONE:
            submission.task.status = Task.STATUS_REVIEW
            submission.task.review_comment = ''
            if not submission.task.taken_by:
                submission.task.taken_by = request.user
            submission.task.save(update_fields=['status', 'review_comment', 'taken_by'])

        _append_event(submission, 'submitted', request.user)

        from .serializers import SubmissionFileSerializer
        return Response(SubmissionFileSerializer(sub_file).data, status=201)
