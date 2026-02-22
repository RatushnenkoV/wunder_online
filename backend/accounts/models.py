from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    def create_user(self, first_name, last_name, password=None, **extra_fields):
        if not first_name or not last_name:
            raise ValueError('Имя и фамилия обязательны')
        user = self.model(first_name=first_name, last_name=last_name, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, first_name, last_name, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_admin', True)
        extra_fields.setdefault('username', f'{first_name}_{last_name}')
        return self.create_user(first_name, last_name, password, **extra_fields)


class User(AbstractUser):
    username = models.CharField(max_length=150, unique=True)
    email = models.EmailField(blank=True, default='')
    phone = models.CharField('Телефон', max_length=20, blank=True, default='')

    is_admin = models.BooleanField('Администратор', default=False)
    is_teacher = models.BooleanField('Учитель', default=False)
    is_parent = models.BooleanField('Родитель', default=False)
    is_student = models.BooleanField('Ученик', default=False)

    birth_date = models.DateField('Дата рождения', null=True, blank=True)

    must_change_password = models.BooleanField(default=True)
    temp_password = models.CharField(max_length=50, blank=True, default='')

    objects = UserManager()

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['first_name', 'last_name']

    class Meta:
        verbose_name = 'Пользователь'
        verbose_name_plural = 'Пользователи'

    def __str__(self):
        return f'{self.last_name} {self.first_name}'

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.is_student and (self.is_admin or self.is_teacher or self.is_parent):
            raise ValidationError('Ученик не может иметь другие роли')

    def save(self, *args, **kwargs):
        if self.is_student:
            self.is_admin = False
            self.is_teacher = False
            self.is_parent = False
        if not self.username:
            base = f'{self.first_name}_{self.last_name}'.lower()
            username = base
            counter = 1
            while User.objects.filter(username=username).exclude(pk=self.pk).exists():
                username = f'{base}_{counter}'
                counter += 1
            self.username = username
        super().save(*args, **kwargs)

    @property
    def roles(self):
        result = []
        if self.is_admin:
            result.append('admin')
        if self.is_teacher:
            result.append('teacher')
        if self.is_parent:
            result.append('parent')
        if self.is_student:
            result.append('student')
        return result
