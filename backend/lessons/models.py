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
    TYPE_FORM = 'form'
    TYPE_DISCUSSION = 'discussion'
    TYPE_VOCAB = 'vocab'
    TYPE_TEXTBOOK = 'textbook'

    TYPE_CHOICES = [
        (TYPE_CONTENT, 'Контент'),
        (TYPE_IMAGE, 'Изображение'),
        (TYPE_POLL, 'Опрос'),
        (TYPE_QUIZ, 'Викторина'),
        (TYPE_OPEN_QUESTION, 'Открытый вопрос'),
        (TYPE_VIDEO, 'Видео'),
        (TYPE_FORM, 'Форма'),
        (TYPE_DISCUSSION, 'Доска обсуждений'),
        (TYPE_VOCAB, 'Словарь'),
        (TYPE_TEXTBOOK, 'Учебник'),
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


class LessonSession(models.Model):
    lesson = models.ForeignKey(
        Lesson,
        on_delete=models.CASCADE,
        related_name='sessions',
        verbose_name='Урок',
    )
    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='led_sessions',
        verbose_name='Учитель',
    )
    school_class = models.ForeignKey(
        'school.SchoolClass',
        on_delete=models.SET_NULL,
        null=True,
        verbose_name='Класс',
    )
    current_slide = models.ForeignKey(
        Slide,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        verbose_name='Текущий слайд',
    )
    is_active = models.BooleanField(default=True, verbose_name='Активна')
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    discussion_data = models.JSONField(default=dict, blank=True, verbose_name='Данные досок обсуждений')

    class Meta:
        ordering = ['-started_at']
        verbose_name = 'Сессия урока'
        verbose_name_plural = 'Сессии уроков'

    def __str__(self):
        return f'Сессия "{self.lesson}" — {self.started_at:%d.%m.%Y %H:%M}'


class FormAnswer(models.Model):
    """Ответы студента на вопросы формы в рамках сессии."""
    session = models.ForeignKey(
        LessonSession,
        on_delete=models.CASCADE,
        related_name='form_answers',
        verbose_name='Сессия',
    )
    slide = models.ForeignKey(
        Slide,
        on_delete=models.CASCADE,
        related_name='form_answers',
        verbose_name='Слайд',
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='form_answers',
        verbose_name='Ученик',
    )
    # [{question_id, value}] — value: int | int[] | str | null
    answers = models.JSONField(default=list, verbose_name='Ответы')
    submitted_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['session', 'slide', 'student']
        verbose_name = 'Ответ на форму'
        verbose_name_plural = 'Ответы на формы'

    def __str__(self):
        return f'FormAnswer session={self.session_id} slide={self.slide_id} student={self.student_id}'


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


class Textbook(models.Model):
    """Учебник — загружаемый файл, привязанный к предметам и классам."""
    title = models.CharField(max_length=300, verbose_name='Название')
    file = models.FileField(upload_to='textbooks/%Y/', verbose_name='Файл')
    original_name = models.CharField(max_length=300, blank=True, verbose_name='Оригинальное имя')
    file_size = models.BigIntegerField(default=0, verbose_name='Размер файла (байт)')
    subject = models.ForeignKey(
        'school.Subject',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='textbooks',
        verbose_name='Предмет',
    )
    grade_levels = models.ManyToManyField(
        'school.GradeLevel',
        blank=True,
        related_name='textbooks',
        verbose_name='Параллели',
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='uploaded_textbooks',
        verbose_name='Загрузил',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['title']
        verbose_name = 'Учебник'
        verbose_name_plural = 'Учебники'

    def __str__(self):
        return self.title


class VocabProgress(models.Model):
    """Прогресс ученика по словарному слайду (по каждому слову)."""
    session = models.ForeignKey(
        LessonSession,
        on_delete=models.CASCADE,
        related_name='vocab_progress',
        verbose_name='Сессия',
    )
    slide = models.ForeignKey(
        Slide,
        on_delete=models.CASCADE,
        related_name='vocab_progress',
        verbose_name='Слайд',
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='vocab_progress',
        verbose_name='Ученик',
    )
    word_id = models.CharField(max_length=100, verbose_name='ID слова')
    attempts = models.IntegerField(default=0, verbose_name='Всего попыток')
    correct = models.IntegerField(default=0, verbose_name='Правильных ответов')
    learned = models.BooleanField(default=False, verbose_name='Выучено')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['session', 'slide', 'student', 'word_id']
        verbose_name = 'Прогресс по слову'
        verbose_name_plural = 'Прогресс по словам'

    def __str__(self):
        return f'VocabProgress session={self.session_id} slide={self.slide_id} student={self.student_id} word={self.word_id}'


class TextbookAnnotation(models.Model):
    """Рисунки ученика поверх страниц учебника (приватные, в рамках сессии)."""
    session     = models.ForeignKey(LessonSession, on_delete=models.CASCADE, related_name='textbook_annotations')
    slide       = models.ForeignKey(Slide,         on_delete=models.CASCADE, related_name='textbook_annotations')
    student     = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='textbook_annotations')
    page_number = models.PositiveIntegerField()
    strokes     = models.JSONField(default=list)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['session', 'slide', 'student', 'page_number']
        verbose_name = 'Аннотация учебника'
        verbose_name_plural = 'Аннотации учебника'

    def __str__(self):
        return f'TextbookAnnotation session={self.session_id} slide={self.slide_id} student={self.student_id} page={self.page_number}'


class LessonAssignment(models.Model):
    """Выдача урока классу или конкретному ученику для самостоятельного прохождения."""
    lesson = models.ForeignKey(
        Lesson,
        on_delete=models.CASCADE,
        related_name='assignments',
        verbose_name='Урок',
    )
    school_class = models.ForeignKey(
        'school.SchoolClass',
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='lesson_assignments',
        verbose_name='Класс',
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='lesson_assignments',
        verbose_name='Ученик',
    )
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='given_lesson_assignments',
        verbose_name='Выдал',
    )
    due_date = models.DateTimeField(null=True, blank=True, verbose_name='Срок')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Задание по уроку'
        verbose_name_plural = 'Задания по урокам'
        ordering = ['-created_at']

    def __str__(self):
        target = f'класс {self.school_class}' if self.school_class else str(self.student)
        return f'LessonAssignment lesson={self.lesson_id} → {target}'
