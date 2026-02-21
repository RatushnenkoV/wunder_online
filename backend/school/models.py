from django.conf import settings
from django.db import models


class GradeLevel(models.Model):
    number = models.PositiveSmallIntegerField('Номер параллели', unique=True)

    class Meta:
        verbose_name = 'Параллель'
        verbose_name_plural = 'Параллели'
        ordering = ['number']

    def __str__(self):
        return f'{self.number} класс'


class SchoolClass(models.Model):
    grade_level = models.ForeignKey(GradeLevel, on_delete=models.CASCADE, related_name='classes')
    letter = models.CharField('Буква класса', max_length=5)

    class Meta:
        verbose_name = 'Класс'
        verbose_name_plural = 'Классы'
        unique_together = ['grade_level', 'letter']
        ordering = ['grade_level__number', 'letter']

    def __str__(self):
        return f'{self.grade_level.number}-{self.letter}'


class Subject(models.Model):
    name = models.CharField('Название предмета', max_length=200, unique=True)

    class Meta:
        verbose_name = 'Предмет'
        verbose_name_plural = 'Предметы'
        ordering = ['name']

    def __str__(self):
        return self.name


class GradeLevelSubject(models.Model):
    grade_level = models.ForeignKey(GradeLevel, on_delete=models.CASCADE, related_name='subjects')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='grade_levels')

    class Meta:
        verbose_name = 'Предмет параллели'
        verbose_name_plural = 'Предметы параллелей'
        unique_together = ['grade_level', 'subject']

    def __str__(self):
        return f'{self.grade_level} — {self.subject}'


class StudentProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='student_profile')
    school_class = models.ForeignKey(SchoolClass, on_delete=models.CASCADE, related_name='students')

    class Meta:
        verbose_name = 'Профиль ученика'
        verbose_name_plural = 'Профили учеников'

    def __str__(self):
        return f'{self.user} ({self.school_class})'


class ParentProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='parent_profile')
    children = models.ManyToManyField(StudentProfile, related_name='parents', blank=True)

    class Meta:
        verbose_name = 'Профиль родителя'
        verbose_name_plural = 'Профили родителей'

    def __str__(self):
        return str(self.user)


class TeacherProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='teacher_profile')

    class Meta:
        verbose_name = 'Профиль учителя'
        verbose_name_plural = 'Профили учителей'

    def __str__(self):
        return str(self.user)


class ClassGroup(models.Model):
    school_class = models.ForeignKey(SchoolClass, on_delete=models.CASCADE, related_name='groups')
    name = models.CharField('Название группы', max_length=100)
    students = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='class_groups',
        blank=True,
    )

    class Meta:
        verbose_name = 'Группа класса'
        verbose_name_plural = 'Группы класса'
        unique_together = ['school_class', 'name']
        ordering = ['name']

    def __str__(self):
        return f'{self.school_class} — {self.name}'


class Room(models.Model):
    name = models.CharField('Название кабинета', max_length=50, unique=True)

    class Meta:
        verbose_name = 'Кабинет'
        verbose_name_plural = 'Кабинеты'
        ordering = ['name']

    def __str__(self):
        return self.name


class ClassSubject(models.Model):
    school_class = models.ForeignKey(SchoolClass, on_delete=models.CASCADE, related_name='class_subjects')
    name = models.CharField('Название предмета', max_length=200)

    class Meta:
        verbose_name = 'Предмет класса'
        verbose_name_plural = 'Предметы класса'
        ordering = ['name']
        unique_together = ['school_class', 'name']

    def __str__(self):
        return f'{self.school_class} — {self.name}'


class ScheduleLesson(models.Model):
    WEEKDAY_CHOICES = [
        (1, 'Понедельник'),
        (2, 'Вторник'),
        (3, 'Среда'),
        (4, 'Четверг'),
        (5, 'Пятница'),
    ]

    school_class = models.ForeignKey(SchoolClass, on_delete=models.CASCADE, related_name='schedule_lessons')
    weekday = models.PositiveSmallIntegerField('День недели', choices=WEEKDAY_CHOICES)
    lesson_number = models.PositiveSmallIntegerField('Номер урока')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='schedule_lessons')
    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='schedule_lessons',
    )
    room = models.ForeignKey(
        Room, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='schedule_lessons',
    )
    group = models.ForeignKey(
        ClassGroup, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='schedule_lessons',
    )

    class Meta:
        verbose_name = 'Урок в расписании'
        verbose_name_plural = 'Уроки в расписании'
        ordering = ['weekday', 'lesson_number']

    def __str__(self):
        return f'{self.school_class} — {self.get_weekday_display()} урок {self.lesson_number}'


class Substitution(models.Model):
    date = models.DateField('Дата')
    lesson_number = models.PositiveSmallIntegerField('Номер урока')
    school_class = models.ForeignKey(
        SchoolClass, on_delete=models.CASCADE, related_name='substitutions', verbose_name='Класс',
    )
    subject = models.ForeignKey(
        Subject, on_delete=models.CASCADE, related_name='substitutions', verbose_name='Предмет',
    )
    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='substitutions', verbose_name='Учитель',
    )
    room = models.ForeignKey(
        Room, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='substitutions', verbose_name='Кабинет',
    )
    original_lesson = models.ForeignKey(
        ScheduleLesson, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='substitutions', verbose_name='Оригинальный урок',
    )
    group = models.ForeignKey(
        ClassGroup, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='substitutions', verbose_name='Группа',
    )

    class Meta:
        verbose_name = 'Замена'
        verbose_name_plural = 'Замены'
        ordering = ['date', 'lesson_number']
        constraints = [
            models.UniqueConstraint(
                condition=models.Q(group__isnull=True),
                fields=['date', 'lesson_number', 'school_class'],
                name='unique_substitution_no_group',
            ),
            models.UniqueConstraint(
                condition=models.Q(group__isnull=False),
                fields=['date', 'lesson_number', 'school_class', 'group'],
                name='unique_substitution_with_group',
            ),
        ]

    def __str__(self):
        return f'{self.school_class} {self.date} урок {self.lesson_number}'
