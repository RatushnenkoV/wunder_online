from django.conf import settings
from django.db import models


class YellowListEntry(models.Model):
    date = models.DateField(verbose_name='Дата')
    student = models.ForeignKey(
        'school.StudentProfile',
        on_delete=models.CASCADE,
        related_name='yellow_entries',
        verbose_name='Ученик',
    )
    fact = models.TextField(verbose_name='Факт')
    lesson = models.CharField(max_length=100, blank=True, verbose_name='На каком уроке')
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='yellow_submitted',
        verbose_name='Кто подал',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    is_read_by_spps = models.BooleanField(default=False, verbose_name='Прочитано СППС')

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Запись жёлтого списка'
        verbose_name_plural = 'Записи жёлтого списка'

    def __str__(self):
        return f'{self.student} — {self.date}'


class YellowListComment(models.Model):
    entry = models.ForeignKey(
        YellowListEntry,
        on_delete=models.CASCADE,
        related_name='comments',
        verbose_name='Запись',
    )
    text = models.TextField(verbose_name='Комментарий')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='yellow_comments',
        verbose_name='Автор',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        verbose_name = 'Комментарий СППС'
        verbose_name_plural = 'Комментарии СППС'

    def __str__(self):
        return f'Комментарий к {self.entry_id}'
