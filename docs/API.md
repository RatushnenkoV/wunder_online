# WunderOnline — API-эндпоинты

> Базовый URL: `/api/`
> Аутентификация: `Authorization: Bearer <access_token>` (JWT)
> Все эндпоинты требуют аутентификации, если не указано иное.
> Подробнее об авторизации и ролях: [AUTH.md](AUTH.md)

---

## Авторизация (`/api/auth/`)

| Метод | URL | Доступ | Описание |
|-------|-----|--------|---------|
| POST | `/api/auth/login/` | Публичный | Вход (first_name, last_name, password) |
| POST | `/api/auth/change-password/` | Любой аутентиф. | Смена пароля (new_password) |
| GET | `/api/auth/me/` | Любой аутентиф. | Текущий пользователь + дочерние данные |
| PATCH | `/api/auth/me/` | Любой аутентиф. | Обновить телефон |
| POST | `/api/auth/refresh/` | Публичный | Обновить access-токен (refresh) |

**Ответ `/auth/me/` включает:**
- Основные поля User
- `student_profile` (если is_student) — с классом
- `school_class_id`, `school_class_name` (если is_student) — ID и имя класса
- `class_group_ids` (если is_student) — список ID подгрупп, в которых состоит ученик
- `teacher_profile` (если is_teacher)
- `parent_profile` (если is_parent) — с детьми
- `children` (если is_parent) — список детей с профилями

---

## Пользователи (`/api/`)

| Метод | URL | Доступ | Описание |
|-------|-----|--------|---------|
| GET | `/api/staff/` | admin/teacher | Список сотрудников (с фильтрами) |
| POST | `/api/staff/` | admin | Создать сотрудника |
| GET | `/api/students/` | admin/teacher | Список учеников |
| POST | `/api/students/` | admin | Создать ученика |
| GET | `/api/users/` | admin | Все пользователи |
| GET | `/api/users/<pk>/` | admin | Пользователь по id |
| PUT | `/api/users/<pk>/` | admin | Обновить пользователя |
| DELETE | `/api/users/<pk>/` | admin | Удалить пользователя |
| POST | `/api/users/<pk>/reset-password/` | admin | Сбросить пароль |
| POST | `/api/users/import/` | admin | Пакетный импорт (Excel) |
| GET | `/api/parents/` | admin/teacher | Список родителей |
| POST | `/api/parents/` | admin | Создать родителя |
| GET | `/api/parents/<pk>/` | admin | Родитель по id |
| PUT | `/api/parents/<pk>/` | admin | Обновить родителя |
| DELETE | `/api/parents/<pk>/` | admin | Удалить родителя |
| POST | `/api/parents/<pk>/children/` | admin | Добавить/убрать ребёнка |

---

## Школа и расписание (`/api/school/`)

### Структура школы

| Метод | URL | Доступ | Описание |
|-------|-----|--------|---------|
| GET/POST | `/api/school/grade-levels/` | admin | Параллели |
| DELETE | `/api/school/grade-levels/<pk>/` | admin | Удалить параллель |
| GET/POST | `/api/school/classes/` | admin/teacher | Классы |
| PATCH | `/api/school/classes/<pk>/` | admin | Обновить класс |
| DELETE | `/api/school/classes/<pk>/` | admin | Удалить класс |
| GET/POST | `/api/school/subjects/` | admin | Предметы |
| DELETE | `/api/school/subjects/<pk>/` | admin | Удалить предмет |
| GET/POST | `/api/school/grade-subjects/` | admin | Предметы параллели |
| DELETE | `/api/school/grade-subjects/<pk>/` | admin | Отвязать предмет от параллели |
| GET/POST | `/api/school/rooms/` | admin | Кабинеты |
| DELETE | `/api/school/rooms/<pk>/` | admin | Удалить кабинет |

### Ученики и родители

| Метод | URL | Доступ | Описание |
|-------|-----|--------|---------|
| GET | `/api/school/classes/<pk>/students/` | admin/teacher | Ученики класса |
| GET/POST | `/api/school/students/<pk>/parents/` | admin | Родители ученика |
| POST | `/api/school/import-classes/` | admin | Импорт учеников/родителей (Excel) |
| POST | `/api/school/students/import-excel/` | admin | Запустить импорт учеников из Excel → `{task_id}` |
| GET | `/api/school/students/import-excel/status/<task_id>/` | admin | Статус импорта: `{status, processed, total, created, updated, errors?}` |
| GET | `/api/school/teachers/` | admin/teacher | Список учителей |

### Группы и предметы класса

| Метод | URL | Доступ | Описание |
|-------|-----|--------|---------|
| GET/POST | `/api/school/classes/<pk>/groups/` | admin | Подгруппы класса |
| PUT/DELETE | `/api/school/groups/<pk>/` | admin | Подгруппа |
| GET/POST | `/api/school/classes/<pk>/subjects/` | admin | Предметы класса |
| PUT/DELETE | `/api/school/subjects/<pk>/` | admin | Предмет класса |
| GET | `/api/school/classes/<pk>/schedule-subjects/` | teacher | Предметы для расписания |
| GET | `/api/school/class-group-search/` | admin/teacher | Поиск класса/подгруппы по имени (?q=..., мин. 2 символа) → `[{type, id, label, user_ids}]` |

### Расписание

| Метод | URL | Доступ | Описание |
|-------|-----|--------|---------|
| GET | `/api/school/schedule/` | all | Расписание (фильтры: class, teacher, room, weekday) |
| GET | `/api/school/schedule/all/` | admin/teacher | Всё расписание (для конфликтов) |
| POST | `/api/school/schedule/` | admin | Добавить урок |
| PUT/DELETE | `/api/school/schedule/<pk>/` | admin | Урок расписания |
| GET/POST | `/api/school/substitutions/` | admin/teacher | Замены |
| PUT/DELETE | `/api/school/substitutions/<pk>/` | admin | Замена |
| GET | `/api/school/substitutions/export/` | admin | Экспорт замен (Excel, листы по датам) |
| GET/POST | `/api/school/lesson-times/` | admin | Расписание звонков |
| PUT/DELETE | `/api/school/lesson-times/<pk>/` | admin | Слот времени урока |
| POST | `/api/school/schedule/import-preview/` | admin | Предпросмотр импорта расписания |
| POST | `/api/school/schedule/import-confirm/` | admin | Подтвердить импорт |
| POST | `/api/school/aho-request/` | all | Создать АХО-заявку |

---

## КТП (`/api/ktp/`)

| Метод | URL | Доступ | Описание |
|-------|-----|--------|---------|
| GET | `/api/ktp/` | all | Список КТП (своих / публичных) |
| POST | `/api/ktp/` | teacher | Создать КТП |
| GET | `/api/ktp/<pk>/` | all | КТП с темами |
| PUT | `/api/ktp/<pk>/` | teacher (owner) | Обновить КТП (is_public, school_class, subject) |
| DELETE | `/api/ktp/<pk>/` | teacher (owner) | Удалить КТП |
| POST | `/api/ktp/<pk>/topics/` | teacher | Создать тему |
| PUT | `/api/ktp/topics/<pk>/` | teacher | Обновить тему |
| DELETE | `/api/ktp/topics/<pk>/` | teacher | Удалить тему |
| POST | `/api/ktp/topics/bulk-create/` | teacher | Пакетное создание тем |
| POST | `/api/ktp/<pk>/autofill-dates/` | teacher | Автозаполнение дат |
| POST | `/api/ktp/topics/<pk>/files/` | teacher | Загрузить файл к теме |
| DELETE | `/api/ktp/files/<pk>/` | teacher | Удалить файл |
| POST | `/api/ktp/import/` | teacher | Импорт тем (Excel) |
| GET | `/api/ktp/schedule-info/` | teacher | Инфо расписания для класса |

---

## Таск-менеджер (`/api/tasks/`)

| Метод | URL | Доступ | Описание |
|-------|-----|--------|---------|
| GET | `/api/tasks/tasks/` | all | Задачи — **пагинация** (page, page_size, max 200); фильтр: ?status= |
| POST | `/api/tasks/tasks/` | admin/teacher | Создать задачу |
| GET | `/api/tasks/tasks/<pk>/` | all | Задача |
| PUT | `/api/tasks/tasks/<pk>/` | all | Обновить задачу |
| DELETE | `/api/tasks/tasks/<pk>/` | admin/creator | Удалить задачу |
| POST | `/api/tasks/tasks/<pk>/status/` | all | Сменить статус |
| POST | `/api/tasks/tasks/<pk>/reassign/` | admin/creator | Переназначить исполнителя |
| POST | `/api/tasks/tasks/<pk>/files/` | all | Загрузить файл |
| DELETE | `/api/tasks/tasks/<pk>/files/<fid>/` | all | Удалить файл |
| GET | `/api/tasks/tasks/count/` | all | Счётчик задач (new, review) |
| GET | `/api/tasks/tasks/report/` | admin | Отчёт по всем задачам (фильтры: date_from, date_to, status, priority, assigned_to, created_by, search; export=excel для xlsx) |
| GET/POST | `/api/tasks/groups/` | all | Группы задач |
| GET/PUT/DELETE | `/api/tasks/groups/<pk>/` | all | Группа задач |
| POST | `/api/tasks/groups/<pk>/members/` | admin/teacher | Добавить/убрать участника |
| GET | `/api/tasks/staff/` | admin/teacher | Список сотрудников + поле `workload` (green/yellow/red) |

**Формат ответа GET `/api/tasks/tasks/`** (пагинация):
```json
{
  "count": 42,
  "next": "http://.../api/tasks/tasks/?page=2",
  "previous": null,
  "results": [...]
}
```
Frontend запрашивает `?page_size=200` для Kanban-доски (все задачи за один запрос).

---

## Уроки (`/api/lessons/`)

### Управление уроками

| Метод | URL | Доступ | Описание |
|-------|-----|--------|---------|
| GET | `/api/lessons/` | all | Уроки (mine/all/public) |
| POST | `/api/lessons/` | teacher | Создать урок |
| GET | `/api/lessons/<pk>/` | all | Урок со слайдами |
| PUT | `/api/lessons/<pk>/` | teacher (owner) | Обновить урок |
| DELETE | `/api/lessons/<pk>/` | teacher (owner) | Удалить урок |
| POST | `/api/lessons/<pk>/duplicate/` | teacher | Дублировать урок |
| GET/POST | `/api/lessons/folders/` | teacher | Папки уроков |
| GET/PUT/DELETE | `/api/lessons/folders/<pk>/` | teacher | Папка |
| GET | `/api/lessons/<pk>/assignments/` | student | Назначенные уроки |

### Слайды

| Метод | URL | Доступ | Описание |
|-------|-----|--------|---------|
| POST | `/api/lessons/<pk>/slides/` | teacher | Добавить слайд |
| GET | `/api/lessons/slides/<pk>/` | all | Слайд |
| PUT | `/api/lessons/slides/<pk>/` | teacher | Обновить слайд |
| DELETE | `/api/lessons/slides/<pk>/` | teacher | Удалить слайд |

### Сессии (интерактивный режим)

| Метод | URL | Доступ | Описание |
|-------|-----|--------|---------|
| GET | `/api/lessons/sessions/?lesson=<id>` | teacher | Все сессии урока |
| POST | `/api/lessons/sessions/` | teacher | Начать сессию |
| GET | `/api/lessons/sessions/<pk>/` | all | Состояние сессии |
| PATCH | `/api/lessons/sessions/<pk>/` | teacher | Перейти к слайду / завершить |
| GET | `/api/lessons/sessions/<pk>/stats/` | teacher | Статистика сессии (форм/квизов) |
| GET | `/api/lessons/sessions/<pk>/leaderboard/` | all | Таблица лидеров (quiz) |

### Учебники

| Метод | URL | Доступ | Описание |
|-------|-----|--------|---------|
| GET | `/api/lessons/textbooks/` | all | Список учебников |
| POST | `/api/lessons/textbooks/upload/` | teacher | Загрузить PDF |
| PUT | `/api/lessons/textbooks/<pk>/` | teacher | Обновить учебник |
| DELETE | `/api/lessons/textbooks/<pk>/` | teacher | Удалить учебник |

### WebSocket уроков

| URL | Протокол | Описание |
|-----|---------|---------|
| `/ws/discussion/<slide_id>/` | WS | Доска обсуждений |
| `/ws/session/<session_id>/` | WS | Синхронизация урока (викторина, формы) |

WS-события сессии: `quiz_start`, `quiz_answer`, `quiz_show_results`, `slide_change`, `session_end`

---

## Чат (`/api/chat/`)

| Метод | URL | Доступ | Описание |
|-------|-----|--------|---------|
| GET | `/api/chat/rooms/` | all | Список чатов |
| POST | `/api/chat/rooms/` | admin | Создать чат |
| GET | `/api/chat/rooms/<pk>/` | member | Чат |
| PATCH | `/api/chat/rooms/<pk>/` | admin | Обновить чат |
| GET | `/api/chat/rooms/<pk>/messages/` | member | Сообщения (?limit=20&before=<id>) |
| PUT | `/api/chat/rooms/<pk>/members/` | admin | Bulk-добавить участников `{user_ids: [...]}` → обновлённый ChatRoom |
| POST | `/api/chat/rooms/<pk>/messages/` | member | Отправить сообщение |
| GET | `/api/chat/restrictions/<student_id>/` | admin/teacher/parent | Ограничения ученика |
| PUT | `/api/chat/restrictions/<student_id>/` | admin/teacher/parent | Установить ограничения |
| GET | `/api/chat/emojis/` | any | Список разрешённых эмодзи-реакций |
| PUT | `/api/chat/emojis/` | admin | Установить список эмодзи-реакций `{emojis:[]}` |
| POST | `/api/chat/messages/<id>/react/` | member | Toggle реакции `{emoji}` → `[{emoji,count,user_reacted}]` |
| POST | `/api/chat/rooms/<pk>/messages/bulk-delete/` | member | Массовое удаление `{ids:[]}` → `{deleted}` |

### WebSocket чата

| URL | Протокол | Описание |
|-----|---------|---------|
| `/ws/chat/<room_id>/` | WS | Чат в реальном времени |

---

## Проекты (`/api/projects/`)

| Метод | URL | Доступ | Описание |
|-------|-----|--------|---------|
| GET | `/api/projects/` | all | Проекты (участником которых является) |
| POST | `/api/projects/` | teacher | Создать проект |
| GET | `/api/projects/<pk>/` | member | Проект |
| PUT | `/api/projects/<pk>/` | owner/teacher | Обновить название/описание/цвет проекта |
| POST | `/api/projects/<pk>/members/` | owner | Добавить участника (возможно добавить нескольких подряд без закрытия модала) |
| POST | `/api/projects/<pk>/members/bulk/` | owner | Добавить сразу несколько участников `{user_ids: [...]}` → `{added: [...]}` |
| DELETE | `/api/projects/<pk>/members/<user_id>/` | owner | Удалить участника |
| GET/POST | `/api/projects/<pk>/assignments/` | member | Задания |
| GET | `/api/projects/assignments/<pk>/` | member | Задание |
| PUT | `/api/projects/assignments/<pk>/` | teacher | Обновить задание |
| DELETE | `/api/projects/assignments/<pk>/` | teacher | Удалить задание |
| GET | `/api/projects/assignments/<pk>/submissions/` | teacher | Сдачи |
| POST | `/api/projects/assignments/<pk>/submissions/` | student | Сдать задание |
| PATCH | `/api/projects/submissions/<pk>/` | teacher | Оценить |

---

## Куратор (`/api/curator/`)

| Метод | URL | Доступ | Описание |
|-------|-----|--------|---------|
| GET | `/api/curator/reports/<student_id>/` | curator | Отчёт по ученику |
| PUT | `/api/curator/reports/<student_id>/` | curator | Обновить отчёт |
| GET | `/api/curator/settings/` | curator | Настройки полей |
| POST | `/api/curator/settings/` | admin | Добавить настройку |

---

## Жёлтый список (`/api/yellow-list/`)

| Метод | URL | Доступ | Описание |
|-------|-----|--------|---------|
| GET | `/api/yellow-list/` | spps | Все записи (+ фильтр по ученику) |
| POST | `/api/yellow-list/` | any staff | Создать запись |
| GET | `/api/yellow-list/<pk>/comments/` | spps | Комментарии |
| POST | `/api/yellow-list/<pk>/comments/` | spps | Добавить комментарий |
| POST | `/api/yellow-list/<pk>/create-task/` | spps | Создать задачу из записи (title, due_date, assigned_to, assigned_group) |
| GET | `/api/yellow-list/student/<student_id>/` | spps или куратор класса | Записи по конкретному ученику |

---

## Новости (`/api/news/`)

| Метод | URL | Доступ | Описание |
|-------|-----|--------|---------|
| GET | `/api/news/` | all | Список новостей (пагинация: ?limit=5&offset=0) |
| POST | `/api/news/` | teacher/admin | Создать новость (черновик) |
| GET | `/api/news/<pk>/` | all | Новость |
| PUT | `/api/news/<pk>/` | author/admin | Обновить новость |
| DELETE | `/api/news/<pk>/` | author/admin | Удалить новость |
| POST | `/api/news/<pk>/publish/` | author/admin | Опубликовать / снять с публикации |
| POST | `/api/news/<pk>/read/` | all | Отметить новость прочитанной |
| POST | `/api/news/<pk>/react/` | all | Поставить/сменить/убрать реакцию (body: `{emoji}`) |
| GET | `/api/news/unread-count/` | all | Количество непрочитанных новостей |
| POST | `/api/news/images/` | teacher/admin | Загрузить изображение (вернёт URL) |

**Пагинация:** ответ `{results: [...], count: N}`. Каждый запрос GET отмечает непрочитанные как прочитанные.

**Реакции:** `POST /react/` с `{emoji}` ставит реакцию (один из: 👍❤️😂😮😢👏). Повторный POST с тем же emoji убирает реакцию. Возвращает `{reactions: {emoji: count}, my_reaction: emoji|null}`.

---

## Формат ошибок

```json
{
  "detail": "Текст ошибки"
}
```

Коды:
- `400` — ошибка валидации
- `401` — не аутентифицирован / просроченный токен
- `403` — нет прав (или `must_change_password`)
- `404` — не найдено
- `500` — ошибка сервера

---

## Мероприятия (`/api/events/`)

| Метод | URL | Доступ | Описание |
|-------|-----|--------|---------|
| GET | `/api/events/` | admin/teacher/spps | Список (фильтры: date_after, date_before, event_type) |
| POST | `/api/events/` | admin/teacher | Создать |
| GET | `/api/events/<pk>/` | admin/teacher/spps | Деталь |
| PUT/PATCH | `/api/events/<pk>/` | admin/teacher | Обновить |
| DELETE | `/api/events/<pk>/` | admin | Удалить |
| GET | `/api/events/import/` | admin | Получить кол-во мероприятий (для диалога импорта) |
| POST | `/api/events/import/` | admin | Импорт из Excel (file, replace=true/false) |

**Поля запроса импорта:** `file` (xlsx), `replace` (строка "true"/"false")
**Ответ импорта:** `{ created, skipped, replaced }`
