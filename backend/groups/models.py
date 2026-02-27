from django.conf import settings
from django.db import models


class ChatRoom(models.Model):
    TYPE_GROUP = 'group'
    TYPE_DIRECT = 'direct'
    ROOM_TYPES = [
        (TYPE_GROUP, 'Группа'),
        (TYPE_DIRECT, 'Личные сообщения'),
    ]

    room_type = models.CharField(max_length=10, choices=ROOM_TYPES, default=TYPE_GROUP)
    name = models.CharField('Название', max_length=200, blank=True, default='')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_chat_rooms',
        verbose_name='Создатель',
    )
    is_archived = models.BooleanField('Архив', default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Чат'
        verbose_name_plural = 'Чаты'
        ordering = ['-created_at']

    def __str__(self):
        return self.name or f'DM #{self.pk}'


class ChatMember(models.Model):
    ROLE_ADMIN = 'admin'
    ROLE_MEMBER = 'member'
    ROLES = [
        (ROLE_ADMIN, 'Администратор'),
        (ROLE_MEMBER, 'Участник'),
    ]

    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name='members_rel')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='chat_memberships',
    )
    role = models.CharField(max_length=10, choices=ROLES, default=ROLE_MEMBER)
    last_read_at = models.DateTimeField(null=True, blank=True)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Участник чата'
        verbose_name_plural = 'Участники чатов'
        unique_together = [['room', 'user']]

    def __str__(self):
        return f'{self.user} в {self.room}'


class ChatMessage(models.Model):
    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sent_chat_messages',
    )
    text = models.TextField('Текст', blank=True, default='')
    reply_to = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='replies',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False)

    class Meta:
        verbose_name = 'Сообщение'
        verbose_name_plural = 'Сообщения'
        ordering = ['created_at']

    def __str__(self):
        return f'{self.sender} → {self.room}: {self.text[:50]}'


class MessageAttachment(models.Model):
    message = models.ForeignKey(ChatMessage, on_delete=models.CASCADE, related_name='attachments')
    file = models.FileField('Файл', upload_to='chat_files/%Y/%m/')
    original_name = models.CharField('Имя файла', max_length=255)
    file_size = models.IntegerField('Размер', default=0)
    mime_type = models.CharField('MIME-тип', max_length=100, blank=True, default='')

    class Meta:
        verbose_name = 'Вложение'
        verbose_name_plural = 'Вложения'

    def __str__(self):
        return self.original_name
