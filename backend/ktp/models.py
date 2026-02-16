from django.conf import settings
from django.db import models
from school.models import SchoolClass, Subject


class Holiday(models.Model):
    date = models.DateField('Дата', unique=True)
    description = models.CharField('Описание', max_length=200, blank=True, default='')

    class Meta:
        verbose_name = 'Выходной'
        verbose_name_plural = 'Выходные'
        ordering = ['date']

    def __str__(self):
        return f'{self.date} — {self.description}' if self.description else str(self.date)


class CTP(models.Model):
    teacher = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='ctps')
    school_class = models.ForeignKey(SchoolClass, on_delete=models.CASCADE, related_name='ctps')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='ctps')
    is_public = models.BooleanField('Публичный', default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'КТП'
        verbose_name_plural = 'КТП'
        ordering = ['-updated_at']

    def __str__(self):
        return f'{self.subject} — {self.school_class} ({self.teacher})'


class Topic(models.Model):
    ctp = models.ForeignKey(CTP, on_delete=models.CASCADE, related_name='topics')
    order = models.PositiveIntegerField('Порядок', default=0)
    title = models.CharField('Тема', max_length=500)
    date = models.DateField('Дата', null=True, blank=True)
    homework = models.TextField('Домашнее задание', blank=True, default='')
    resources = models.JSONField('Ссылки на материалы', default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Тема'
        verbose_name_plural = 'Темы'
        ordering = ['order']

    def __str__(self):
        return self.title


class TopicFile(models.Model):
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name='files')
    file = models.FileField('Файл', upload_to='topic_files/%Y/%m/')
    original_name = models.CharField('Имя файла', max_length=255)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Файл темы'
        verbose_name_plural = 'Файлы тем'
        ordering = ['uploaded_at']

    def __str__(self):
        return self.original_name
