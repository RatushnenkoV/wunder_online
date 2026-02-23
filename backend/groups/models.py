from django.conf import settings
from django.db import models


class Group(models.Model):
    name = models.CharField('Название', max_length=200)
    description = models.TextField('Описание', blank=True, default='')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_groups',
        verbose_name='Создатель',
    )
    members = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='group_memberships',
        blank=True,
        verbose_name='Участники',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Группа'
        verbose_name_plural = 'Группы'
        ordering = ['name']

    def __str__(self):
        return self.name


class GroupMessage(models.Model):
    TYPE_TEXT = 'text'
    TYPE_FILE = 'file'
    TYPE_TASK = 'task'
    MESSAGE_TYPES = [
        (TYPE_TEXT, 'Текст'),
        (TYPE_FILE, 'Файл'),
        (TYPE_TASK, 'Задача'),
    ]

    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='group_messages',
    )
    content = models.TextField('Текст', blank=True, default='')
    message_type = models.CharField(max_length=10, choices=MESSAGE_TYPES, default=TYPE_TEXT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Сообщение'
        verbose_name_plural = 'Сообщения'
        ordering = ['created_at']

    def __str__(self):
        return f'{self.sender} → {self.group}: {self.content[:50]}'


class MessageFile(models.Model):
    message = models.OneToOneField(GroupMessage, on_delete=models.CASCADE, related_name='file')
    file = models.FileField('Файл', upload_to='group_files/%Y/%m/')
    original_filename = models.CharField('Имя файла', max_length=255)
    file_size = models.IntegerField('Размер файла', default=0)

    class Meta:
        verbose_name = 'Файл сообщения'
        verbose_name_plural = 'Файлы сообщений'

    def __str__(self):
        return self.original_filename


class GroupTask(models.Model):
    message = models.OneToOneField(GroupMessage, on_delete=models.CASCADE, related_name='task')
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='tasks')
    title = models.CharField('Название', max_length=300)
    description = models.TextField('Описание', blank=True, default='')
    assignees = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='group_chat_assignee_tasks',
        blank=True,
        verbose_name='Исполнители',
    )
    deadline = models.DateField('Дедлайн', null=True, blank=True)
    is_completed = models.BooleanField('Выполнено', default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='group_chat_created_tasks',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Задача'
        verbose_name_plural = 'Задачи'
        ordering = ['-created_at']

    def __str__(self):
        return self.title
