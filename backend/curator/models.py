from django.conf import settings
from django.db import models


class CuratorSection(models.Model):
    name = models.CharField('Название сферы', max_length=200)
    order = models.PositiveSmallIntegerField('Порядок', default=0)

    class Meta:
        verbose_name = 'Сфера развития'
        verbose_name_plural = 'Сферы развития'
        ordering = ['order']

    def __str__(self):
        return self.name


class CuratorField(models.Model):
    section = models.ForeignKey(CuratorSection, on_delete=models.CASCADE, related_name='fields')
    name = models.CharField('Что оцениваем', max_length=200)
    order = models.PositiveSmallIntegerField('Порядок', default=0)

    class Meta:
        verbose_name = 'Поле оценки'
        verbose_name_plural = 'Поля оценки'
        ordering = ['section__order', 'order']

    def __str__(self):
        return f'{self.section} → {self.name}'


class CuratorHint(models.Model):
    field = models.ForeignKey(CuratorField, on_delete=models.CASCADE, related_name='hints')
    text = models.CharField('Текст подсказки', max_length=500)

    class Meta:
        verbose_name = 'Подсказка'
        verbose_name_plural = 'Подсказки'

    def __str__(self):
        return self.text


class CuratorReport(models.Model):
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='curator_reports', verbose_name='Ученик',
    )
    academic_year = models.CharField('Учебный год', max_length=9)  # "2025-2026"
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='created_curator_reports',
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Кураторский отчёт'
        verbose_name_plural = 'Кураторские отчёты'
        unique_together = ['student', 'academic_year']

    def __str__(self):
        return f'{self.student} ({self.academic_year})'


class CuratorReportValue(models.Model):
    report = models.ForeignKey(CuratorReport, on_delete=models.CASCADE, related_name='values')
    field = models.ForeignKey(CuratorField, on_delete=models.CASCADE, related_name='values')
    value = models.TextField('Значение', blank=True, default='')

    class Meta:
        verbose_name = 'Значение поля'
        verbose_name_plural = 'Значения полей'
        unique_together = ['report', 'field']

    def __str__(self):
        return f'{self.report} → {self.field}: {self.value[:50]}'
