from django.conf import settings
from django.db import models


class NewsPost(models.Model):
    title = models.CharField(max_length=255, verbose_name='Заголовок')
    content = models.TextField(blank=True, verbose_name='Содержимое (HTML)')
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='news_posts',
        verbose_name='Автор',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_published = models.BooleanField(default=False, verbose_name='Опубликована')
    for_staff = models.BooleanField(default=False, verbose_name='Для сотрудников')
    for_parents = models.BooleanField(default=False, verbose_name='Для родителей')

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Новость'
        verbose_name_plural = 'Новости'

    def __str__(self):
        return self.title


class NewsImage(models.Model):
    """Images uploaded for embedding in news posts."""
    image = models.ImageField(upload_to='news_images/%Y/%m/', verbose_name='Изображение')
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='news_images',
        verbose_name='Загрузил',
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Изображение новости'
        verbose_name_plural = 'Изображения новостей'

    def __str__(self):
        return f'Image #{self.pk}'


class NewsRead(models.Model):
    """Tracks which users have read which news posts."""
    post = models.ForeignKey(
        NewsPost,
        on_delete=models.CASCADE,
        related_name='reads',
        verbose_name='Новость',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='news_reads',
        verbose_name='Пользователь',
    )
    read_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [['post', 'user']]
        verbose_name = 'Прочитано'
        verbose_name_plural = 'Прочитанные'

    def __str__(self):
        return f'{self.user} прочитал {self.post_id}'
