# WunderOnline — Авторизация и роли

---

## Способ входа

Авторизация по **имени + фамилии + паролю** (не по username/email).

```
POST /api/auth/login/
{
  "first_name": "Иван",
  "last_name": "Иванов",
  "password": "secret"
}
```

Реализовано в: `backend/accounts/backends.py` → `NameAuthBackend`

**Логика при тёзках:** итерируется по всем пользователям с таким именем, проверяет пароль — берёт первого совпавшего.

---

## JWT-токены

| Токен | Срок | Хранение |
|-------|------|---------|
| `access` | 12 часов | `localStorage['accessToken']` |
| `refresh` | 7 дней | `localStorage['refreshToken']` |

**Автообновление:**
Interceptor в `frontend/src/api/client.ts`:
1. Запрос вернул 401
2. Запрашивает `POST /api/auth/refresh/` с `refreshToken`
3. Если успех — подставляет новый `access`, повторяет исходный запрос
4. Если refresh тоже 401 — очищает оба токена, редиректит на `/login`

---

## Роли пользователей

| Поле | Название | Описание |
|------|---------|---------|
| `is_admin` | Администратор | Полный доступ ко всему |
| `is_teacher` | Учитель | Управление уроками, КТП, расписанием |
| `is_parent` | Родитель | Просмотр данных своих детей |
| `is_student` | Ученик | Только просмотр назначенного контента |
| `is_spps` | СППС | Доп. роль: жёлтый список, комментарии |

**Важные правила:**
- `is_student=True` → автоматически снимаются все другие флаги (в `User.save()`)
- СППС = `is_teacher=True` + `is_spps=True` (комбинация)
- Роли могут комбинироваться (кроме student): учитель может быть родителем

---

## Django Permissions (backend/accounts/permissions.py)

| Класс | Условие доступа |
|-------|----------------|
| `IsAdmin` | `user.is_admin` |
| `IsTeacher` | `user.is_teacher` |
| `IsParent` | `user.is_parent` |
| `IsStudent` | `user.is_student` |
| `IsSPPS` | `user.is_spps OR user.is_admin` |
| `IsAdminOrTeacher` | `user.is_admin OR user.is_teacher` |
| `PasswordChanged` | `NOT user.must_change_password` |

**Использование в views:**
```python
@api_view(['GET'])
@permission_classes([IsAdmin, PasswordChanged])
def my_view(request):
    ...
```

Все permission классы — AND-логика (все должны быть True).

---

## must_change_password (принудительная смена)

При создании пользователя администратором:
1. `User.must_change_password = True`
2. `User.temp_password` = сгенерированный временный пароль
3. После успешного входа → принудительный редирект на `/change-password`
4. После смены → `must_change_password = False`

Пока `must_change_password = True`:
- Большинство API недоступны (permission `PasswordChanged` отказывает)
- Только `/auth/me/` и `/auth/change-password/` работают

---

## Матрица доступа к функциям

| Функция | admin | teacher | parent | student | spps |
|---------|-------|---------|--------|---------|------|
| Дашборд | ✓ | ✓ | ✓ | ✓ | ✓ |
| Расписание (просмотр) | ✓ | ✓ | ✓ | ✓ | ✓ |
| КТП (просмотр) | ✓ | ✓ | - | ✓* | - |
| КТП (редактирование) | ✓ | только свои | - | - | - |
| Управление школой | ✓ | частично | - | - | - |
| Таск-менеджер | ✓ | ✓ | ✓ | - | ✓ |
| Чаты | ✓ | ✓ | ✓ | ✓ | ✓ |
| Уроки (просмотр) | ✓ | ✓ | - | назначенные | - |
| Уроки (редактирование) | ✓ | только свои | - | - | - |
| Проекты | ✓ | ✓ | - | участники | - |
| Жёлтый список (просмотр полный) | - | - | - | - | ✓ |
| Жёлтый список (подача заявки) | ✓ | ✓ | - | - | ✓ |
| Новости (создание) | ✓ | ✓ | - | - | ✓ |
| Новости (просмотр for_staff) | ✓ | ✓ | - | - | ✓ |
| Новости (просмотр for_parents) | ✓ | - | ✓ | ✓ | - |
| Кураторский отчёт | куратор класса | - | - | - | - |
| Настройки (полей куратора) | ✓ | - | - | - | - |

*КТП для ученика — только публичные (`is_public=True`) для своего класса.

---

## Аутентификация WebSocket

Токен передаётся в query string:
```
ws://.../ws/chat/42/?token=<jwt_access_token>
```

Middleware: `backend/groups/middleware.py` → `JWTAuthMiddleware`
- Достаёт токен из URL
- Аутентифицирует пользователя
- Устанавливает `scope['user']`

---

## Типичные ошибки авторизации

| Ситуация | Ответ API |
|----------|-----------|
| Неверный логин/пароль | `401 Unauthorized` |
| Токен истёк | `401` → frontend обновляет автоматически |
| Нет прав (роль) | `403 Forbidden` |
| `must_change_password` | `403` с `detail: 'Необходимо сменить пароль'` |
| Не участник ресурса | `403` или `404` |
