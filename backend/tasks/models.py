from django.db import models
from django.conf import settings


class TaskGroup(models.Model):
    name = models.CharField(max_length=200, verbose_name='Название')
    description = models.TextField(blank=True, verbose_name='Описание')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_task_groups',
        verbose_name='Создатель',
    )
    members = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='task_groups',
        blank=True,
        verbose_name='Участники',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Группа задач'
        verbose_name_plural = 'Группы задач'

    def __str__(self):
        return self.name


class Task(models.Model):
    STATUS_NEW = 'new'
    STATUS_IN_PROGRESS = 'in_progress'
    STATUS_REVIEW = 'review'
    STATUS_DONE = 'done'

    STATUS_CHOICES = [
        (STATUS_NEW, 'Поставленная'),
        (STATUS_IN_PROGRESS, 'В работе'),
        (STATUS_REVIEW, 'На проверке'),
        (STATUS_DONE, 'Выполнено'),
    ]

    title = models.CharField(max_length=500, verbose_name='Заголовок')
    description = models.TextField(blank=True, verbose_name='Описание')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='created_tasks',
        verbose_name='Постановщик',
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='assigned_tasks',
        verbose_name='Исполнитель',
    )
    assigned_group = models.ForeignKey(
        TaskGroup,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='group_tasks',
        verbose_name='Группа исполнителей',
    )
    taken_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='taken_tasks',
        verbose_name='Взял в работу',
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_NEW,
        verbose_name='Статус',
    )
    due_date = models.DateField(null=True, blank=True, verbose_name='Срок')
    completed_at = models.DateTimeField(null=True, blank=True, verbose_name='Дата выполнения')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Задача'
        verbose_name_plural = 'Задачи'

    def __str__(self):
        return self.title

    def is_assignee(self, user):
        if self.assigned_to_id == user.id:
            return True
        if self.assigned_group_id and self.assigned_group.members.filter(id=user.id).exists():
            return True
        return False

    def can_reassign(self, user):
        return (
            self.created_by_id == user.id
            or (self.taken_by_id and self.taken_by_id == user.id)
            or user.is_admin
        )


class TaskFile(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='files')
    file = models.FileField(upload_to='task_files/%Y/%m/')
    original_name = models.CharField(max_length=500)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='task_files',
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['uploaded_at']

    def __str__(self):
        return self.original_name
