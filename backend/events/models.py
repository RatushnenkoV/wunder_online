from django.db import models
from django.conf import settings


class SchoolEvent(models.Model):
    EVENT_TYPES = [
        ('holiday', 'Праздник'),
        ('teambuilding', 'Тимбилдинг'),
        ('meta_subject', 'Метапредметный проект'),
        ('cross_subject', 'Межпредметный проект'),
        ('subject', 'Предметный проект'),
        ('training', 'Обучение'),
        ('career_guidance', 'Профориентация'),
        ('other', 'Другое'),
    ]

    APPROVED_CHOICES = [
        ('yes', 'Согласовано'),
        ('no', 'Не согласовано'),
        ('rescheduled', 'Перенесено'),
        ('pending', 'Ожидает'),
    ]

    date_start = models.DateField('Дата начала', db_index=True)
    date_end = models.DateField('Дата окончания', null=True, blank=True, db_index=True)
    time_note = models.CharField('Время', max_length=100, blank=True)
    target_classes = models.CharField('Классы', max_length=300, blank=True)
    organizers = models.CharField('Организаторы', max_length=300, blank=True)
    description = models.TextField('Описание мероприятия')
    responsible = models.CharField('Ответственный', max_length=200, blank=True)
    helper = models.CharField('Помощники', max_length=300, blank=True)
    event_type = models.CharField('Тип', max_length=50, choices=EVENT_TYPES, blank=True)
    approved = models.CharField('Согласовано', max_length=30, choices=APPROVED_CHOICES, blank=True)
    cost = models.CharField('Стоимость', max_length=200, blank=True)
    status = models.CharField('Статус', max_length=200, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_events',
        verbose_name='Создал',
    )

    class Meta:
        ordering = ['date_start']
        verbose_name = 'Мероприятие'
        verbose_name_plural = 'Мероприятия'

    def __str__(self):
        return f'{self.date_start} — {self.description[:50]}'
