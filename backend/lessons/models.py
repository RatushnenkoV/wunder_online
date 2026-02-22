from django.db import models
from django.conf import settings


class LessonFolder(models.Model):
    name = models.CharField(max_length=200, verbose_name='Название')
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='lesson_folders',
        verbose_name='Владелец',
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='children',
        verbose_name='Родительская папка',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Папка уроков'
        verbose_name_plural = 'Папки уроков'

    def __str__(self):
        return self.name


class Lesson(models.Model):
    title = models.CharField(max_length=300, verbose_name='Название')
    description = models.TextField(blank=True, verbose_name='Описание')
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='lessons',
        verbose_name='Автор',
    )
    folder = models.ForeignKey(
        LessonFolder,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='lessons',
        verbose_name='Папка',
    )
    is_public = models.BooleanField(default=False, verbose_name='Виден всем')
    cover_color = models.CharField(max_length=7, default='#6366f1', verbose_name='Цвет обложки')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        verbose_name = 'Урок'
        verbose_name_plural = 'Уроки'

    def __str__(self):
        return self.title


class Slide(models.Model):
    TYPE_CONTENT = 'content'
    TYPE_IMAGE = 'image'
    TYPE_POLL = 'poll'
    TYPE_QUIZ = 'quiz'
    TYPE_OPEN_QUESTION = 'open_question'
    TYPE_VIDEO = 'video'

    TYPE_CHOICES = [
        (TYPE_CONTENT, 'Контент'),
        (TYPE_IMAGE, 'Изображение'),
        (TYPE_POLL, 'Опрос'),
        (TYPE_QUIZ, 'Викторина'),
        (TYPE_OPEN_QUESTION, 'Открытый вопрос'),
        (TYPE_VIDEO, 'Видео'),
    ]

    lesson = models.ForeignKey(
        Lesson,
        on_delete=models.CASCADE,
        related_name='slides',
        verbose_name='Урок',
    )
    order = models.PositiveIntegerField(default=0, verbose_name='Порядок')
    slide_type = models.CharField(
        max_length=20,
        choices=TYPE_CHOICES,
        default=TYPE_CONTENT,
        verbose_name='Тип',
    )
    title = models.CharField(max_length=300, blank=True, verbose_name='Заголовок')
    content = models.JSONField(default=dict, blank=True, verbose_name='Содержимое')
    image = models.FileField(
        upload_to='lesson_images/%Y/%m/',
        null=True, blank=True,
        verbose_name='Изображение',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order', 'id']
        verbose_name = 'Слайд'
        verbose_name_plural = 'Слайды'

    def __str__(self):
        return f'Слайд {self.order}: {self.title or self.slide_type}'


class LessonMedia(models.Model):
    lesson = models.ForeignKey(
        Lesson,
        on_delete=models.CASCADE,
        related_name='media_files',
        verbose_name='Урок',
    )
    file = models.FileField(upload_to='lesson_media/%Y/%m/', verbose_name='Файл')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-uploaded_at']
        verbose_name = 'Медиафайл урока'
        verbose_name_plural = 'Медиафайлы уроков'

    def __str__(self):
        return f'Media for lesson {self.lesson_id}'
