from django.db import models
from django.conf import settings


class Project(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    cover_color = models.CharField(max_length=7, default='#6366f1')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_projects',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name


class ProjectMember(models.Model):
    ROLE_TEACHER = 'teacher'
    ROLE_STUDENT = 'student'
    ROLE_CHOICES = [
        (ROLE_TEACHER, 'Педагог'),
        (ROLE_STUDENT, 'Ученик'),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='members_rel')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='project_memberships',
    )
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default=ROLE_STUDENT)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [['project', 'user']]

    def __str__(self):
        return f'{self.user} в {self.project} ({self.role})'


class ProjectPost(models.Model):
    """Сообщение в ленте проекта."""
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='posts')
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='project_posts',
    )
    text = models.TextField(blank=True)
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'Пост в {self.project} от {self.author}'


class PostAttachment(models.Model):
    post = models.ForeignKey(ProjectPost, on_delete=models.CASCADE, related_name='attachments')
    file = models.FileField(upload_to='project_posts/%Y/%m/')
    original_name = models.CharField(max_length=500)
    file_size = models.PositiveBigIntegerField(default=0)
    mime_type = models.CharField(max_length=200, blank=True)

    def __str__(self):
        return self.original_name


class ProjectAssignment(models.Model):
    """Задание в проекте."""
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='assignments')
    title = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    due_date = models.DateField(null=True, blank=True)
    lesson = models.ForeignKey(
        'lessons.Lesson',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='project_assignments',
        verbose_name='Урок',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_assignments',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class AssignmentAttachment(models.Model):
    """Файл к заданию."""
    assignment = models.ForeignKey(
        ProjectAssignment, on_delete=models.CASCADE, related_name='attachments'
    )
    file = models.FileField(upload_to='project_assignments/%Y/%m/')
    original_name = models.CharField(max_length=500)
    file_size = models.PositiveBigIntegerField(default=0)
    mime_type = models.CharField(max_length=200, blank=True)

    def __str__(self):
        return self.original_name


class AssignmentSubmission(models.Model):
    """Сдача работы студентом."""
    assignment = models.ForeignKey(
        ProjectAssignment, on_delete=models.CASCADE, related_name='submissions'
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='assignment_submissions',
    )
    task = models.ForeignKey(
        'tasks.Task',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='project_submissions',
    )
    text = models.TextField(blank=True)
    submitted_at = models.DateTimeField(auto_now=True)
    events = models.JSONField(default=list, blank=True)
    grade = models.CharField(max_length=50, null=True, blank=True)
    graded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='graded_submissions',
    )
    graded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [['assignment', 'student']]

    def __str__(self):
        return f'Сдача {self.student} → {self.assignment}'


class SubmissionFile(models.Model):
    """Файл в сдаче студента."""
    submission = models.ForeignKey(
        AssignmentSubmission, on_delete=models.CASCADE, related_name='files'
    )
    file = models.FileField(upload_to='project_submissions/%Y/%m/')
    original_name = models.CharField(max_length=500)
    file_size = models.PositiveBigIntegerField(default=0)
    mime_type = models.CharField(max_length=200, blank=True)

    def __str__(self):
        return self.original_name
