# WunderOnline — Документация проекта

> Система управления школой. Авторизация, расписание, КТП, управление классами и пользователями.

---

## Стек

| Слой | Технологии |
|------|-----------|
| Frontend | React 19, TypeScript, Vite, React Router 7, Axios, Tailwind CSS 4 |
| Backend | Django 5.1, Django REST Framework, simplejwt |
| БД | SQLite (dev), PostgreSQL готов (psycopg2) |
| Запуск | `start.bat` — поднимает оба сервера |
| HTTPS | `@vitejs/plugin-basic-ssl` — самоподписанный сертификат для dev |

Порты: frontend `:5173` (HTTPS), backend `:8000` (HTTP). Vite проксирует `/api`, `/media`, `/ws` на Django.

---

## Структура файлов

```
WunderOnline/
├── start.bat                        # Запуск dev-серверов
├── DOCS.md                          # Эта документация
├── frontend/
│   ├── src/
│   │   ├── App.tsx                  # Роутер
│   │   ├── main.tsx                 # Точка входа
│   │   ├── api/client.ts            # Axios с JWT-интерцептором
│   │   ├── contexts/AuthContext.tsx # Контекст авторизации
│   │   ├── types/index.ts           # TypeScript-интерфейсы всех сущностей
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── ChangePasswordPage.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── AccountPage.tsx      # Аккаунт пользователя (смена пароля, телефон)
│   │   │   ├── TasksPage.tsx        # Таск-менеджер (канбан)
│   │   │   ├── RequestsPage.tsx     # Заявки: АХО-форма + ИТ (заглушка)
│   │   │   ├── KTPListPage.tsx
│   │   │   ├── KTPDetailPage.tsx    # Главный редактор КТП
│   │   │   ├── SchedulePage.tsx     # Расписание + вкладка замен
│   │   │   ├── PeoplePage.tsx       # Управление персоналом/учениками
│   │   │   ├── SchoolPage.tsx       # Структура школы (вкладки: Классы, Ученики, Родители)
│   │   │   ├── SettingsPage.tsx     # Настройки (праздники)
│   │   │   ├── LessonsPage.tsx           # Уроки: папки + список (Фаза 1)
│   │   │   ├── LessonEditorPage.tsx      # Редактор урока (canvas, Фазы 2-3)
│   │   │   └── LessonPresenterPage.tsx   # Живая презентация (учитель + студент)
│   │   └── components/
│   │       ├── Layout.tsx           # Навбар + обёртка
│   │       ├── StaffTab.tsx         # CRUD сотрудников (+ бейджи куратора, birth_date)
│   │       ├── ParentsTab.tsx       # CRUD родителей + привязка детей + кросс-навигация к ученику
│   │       ├── StudentsTab.tsx      # CRUD учеников (список, birth_date, родители, кросс-навигация)
│   │       ├── schedule/
│   │       │   ├── ScheduleGrid.tsx          # Сетка расписания
│   │       │   ├── LessonEditor.tsx          # Редактор урока (модал)
│   │       │   ├── ScheduleImportModal.tsx   # Мастер импорта Excel
│   │       │   ├── SubstitutionsTab.tsx      # Вкладка замен
│   │       │   ├── SubstitutionsGrid.tsx     # Сетка замен с датами
│   │       │   └── SubstitutionEditor.tsx    # Редактор замены (модал)
│   │       └── school/
│   │           ├── ClassesGrid.tsx   # Список классов
│   │           ├── ClassDetail.tsx   # Детали класса (вкладки)
│   │           ├── ClassGroups.tsx   # Управление группами класса
│   │           ├── ClassSubjects.tsx # Предметы класса (без групп)
│   │           └── ClassStudents.tsx # Ученики класса (birth_date, родители, кросс-навигация)
└── backend/
    ├── config/                      # Django settings, urls, wsgi
    ├── accounts/                    # Пользователи, роли, профили
    ├── school/                      # Классы, предметы, кабинеты, расписание
    │   └── schedule_import.py       # Парсер Excel для импорта расписания
    ├── ktp/                         # КТП, темы, файлы, праздники
    └── lessons/                     # Интерактивные уроки (Nearpod-аналог)
```

---

## Маршруты (App.tsx)

| URL | Компонент | Доступ |
|-----|-----------|--------|
| `/login` | LoginPage | Публичный |
| `/change-password` | ChangePasswordPage | После первого входа |
| `/` | DashboardPage | Авторизованные |
| `/ktp` | KTPListPage | Авторизованные |
| `/ktp/:id` | KTPDetailPage | Авторизованные |
| `/schedule` | SchedulePage | Авторизованные |
| `/admin/people` | PeoplePage | Только admin |
| `/admin/school` | SchoolPage | Только admin |
| `/admin/settings` | SettingsPage | Только admin |
| `/account` | AccountPage | Авторизованные |
| `/tasks` | TasksPage | Авторизованные |
| `/requests` | RequestsPage | Авторизованные |
| `/lessons` | LessonsPage | Авторизованные |
| `/lessons/:id/edit` | LessonEditorPage | Авторизованные |
| `/lessons/sessions/:id/present` | LessonPresenterPage | Авторизованные |
| `/chats` | ChatsPage | Авторизованные |

---

## API Backend

### Auth (`/api/auth/`)
- `POST /api/auth/login/` — вход по имени+фамилии+паролю (кастомный бэкенд)
- `POST /api/auth/change-password/` — смена пароля
- `GET /api/auth/me/` — текущий пользователь

### Пользователи (`/api/admin/`)
- `GET/POST /api/admin/staff/` — сотрудники
- `GET/PUT/DELETE /api/admin/staff/:id/` — конкретный сотрудник
- `GET/POST /api/admin/students/` — ученики (ответ включает `school_class_id`, `school_class_name`, `student_profile_id`)
- `GET/PUT/DELETE /api/admin/students/:id/` — конкретный ученик
- `POST /api/admin/reset-password/:id/` — сброс пароля
- `GET/POST /api/admin/parents/` — родители (пагинация, search)
- `GET/PUT/DELETE /api/admin/parents/:id/` — конкретный родитель
- `POST /api/admin/parents/:id/children/` — `{action: add|remove, student_profile_id}`
- `POST /api/admin/parents/:id/reset-password/` — сброс пароля родителя

### Школа (`/api/school/`)
- Grade levels, school classes, subjects, rooms, class groups, schedule lessons
- `PATCH /api/school/classes/:id/` — обновить класс (curator_id)
- `GET /api/school/students/:id/parents/` — список родителей ученика
- `POST /api/school/students/:id/parents/` — `{action: add|remove, parent_id}` — привязать/отвязать родителя
- `PATCH /api/auth/me/` — обновить профиль (phone)
- `POST /api/school/aho/` — создать заявку АХО (IsAuthenticated)
- `POST /api/school/schedule/import/preview/` — парсинг Excel (multipart: classes_file, teachers_file), возвращает parsed_lessons + missing entities
- `POST /api/school/schedule/import/confirm/` — выполнить импорт с mappings (class/teacher/room) + replace_existing

### Замены (`/api/school/substitutions/`)
- `GET /api/school/substitutions/?date_from=...&date_to=...` — все замены за период
- Фильтры: `school_class=`, `teacher=` (где он новый ИЛИ оригинальный), `room=`
- `POST /api/school/substitutions/` — создать/обновить замену (upsert по date+lesson_number+school_class)
- `PUT/DELETE /api/school/substitutions/:id/` — обновить/удалить замену (IsAdmin)
- `GET /api/school/substitutions/export/?date_from=...&date_to=...` — экспорт в Excel

### Задачи (`/api/tasks/`)
- `GET /api/tasks/staff/` — список сотрудников (admin+teacher) для выбора исполнителя
- `GET /api/tasks/groups/` — все группы (для любого staff); POST — создать (admin)
- `GET/PUT/DELETE /api/tasks/groups/:id/` — группа
- `POST /api/tasks/groups/:id/members/` — `{action: add|remove}`. Admin: + `{user_id}`. Teacher: управляет только своим членством
- `GET /api/tasks/tasks/count/` — счётчик `{new, review, total}` для бейджа в сайдбаре
- `GET/POST /api/tasks/tasks/` — задачи видимые мне / создать (staff). GET фильтр: `?status=`
- `GET/PUT /api/tasks/tasks/:id/` — задача. DELETE — только создатель
- `POST /api/tasks/tasks/:id/status/` — изменить статус `{status}`. `new→in_progress`, `in_progress→review`: только исполнитель. `review→done/in_progress`: только постановщик или admin
- `POST /api/tasks/tasks/:id/reassign/` — переназначить `{assigned_to|assigned_group}`. Сбрасывает статус в `new`, очищает `taken_by`. Доступно: постановщик, взявший в работу, admin
- `POST /api/tasks/tasks/:id/files/` — загрузить файл (multipart: `file`)
- `DELETE /api/tasks/tasks/:id/files/:file_id/` — удалить файл

### Уроки (`/api/lessons/`)
- `GET/POST /api/lessons/folders/` — папки (GET: мои корневые; POST: создать)
- `GET/PUT/DELETE /api/lessons/folders/:id/` — CRUD папки
- `GET /api/lessons/folders/:id/contents/` — содержимое папки (subfolders + lessons)
- `GET /api/lessons/lessons/?tab=mine|all&folder=<id>` — список уроков
- `POST /api/lessons/lessons/` — создать урок
- `GET/PUT/DELETE /api/lessons/lessons/:id/` — CRUD урока
- `POST /api/lessons/lessons/:id/duplicate/` — дублировать урок
- `GET/POST /api/lessons/lessons/:id/slides/` — слайды урока (slide_type: content|form|video|discussion)
- `POST /api/lessons/lessons/:id/slides/reorder/` — {order: [id, ...]} — переставить слайды
- `GET/PUT/DELETE /api/lessons/lessons/:id/slides/:sid/` — CRUD слайда (slide_type: content|form|quiz|video|discussion)
- `POST /api/lessons/lessons/:id/slides/:sid/image/` — загрузить изображение (multipart: image)
- `POST /api/lessons/lessons/:id/upload/` — загрузить медиафайл для блока (multipart: file) → `{id, url, uploaded_at}`
- `GET /api/lessons/sessions/active/` — активные сессии (teacher/admin видят все; студент — только своего класса)
- `POST /api/lessons/sessions/` — создать сессию `{lesson, school_class?}` (только teacher/admin)
- `GET/PATCH/DELETE /api/lessons/sessions/:id/` — CRUD сессии; PATCH: `{is_active, current_slide}`
- `GET /api/lessons/sessions/:id/slides/:sid/form-results/` — результаты формы для учителя (только staff)
- **WebSocket** `ws://…/ws/discussion/<slide_id>/?token=<jwt>` — доска обсуждений (DiscussionConsumer)
- **WebSocket** `ws://…/ws/session/<session_id>/?token=<jwt>` — синхронизация живой презентации (LessonSessionConsumer)
  - **Quiz-команды**: `quiz_start {slide_id, question_idx}` (учитель→сервер), `quiz_answer {slide_id, question_idx, option_index, elapsed_ms}` (студент→сервер), `quiz_show_results {slide_id, question_idx}` (учитель→сервер)
  - **Quiz-события**: `quiz_started {slide_id, question_idx, time_limit_sec}`, `quiz_answer_received {slide_id, question_idx, answered_count}`, `quiz_answer_confirmed {slide_id, question_idx, option_index, points, is_correct}`, `quiz_leaderboard {slide_id, question_idx, correct_index, leaderboard, answer_stats}`

### Чаты (`/api/chat/`)

**Модель прав:** Admin — всё. Teacher — группы (самовступление) + DM учителям/студентам/admin. Student — только назначенные группы + DM своим учителям и куратору. Parent — только DM куратору(ам) детей.

**Файлы вложений**: `MessageAttachmentSerializer.get_file_url()` возвращает **относительный URL** (`/media/chat_files/...`) — Vite-прокси пробрасывает его на Django, работает с любого устройства в сети.

**Уведомления**: браузерные уведомления (`Notification` API) требуют HTTPS и разрешения пользователя. ChatsPage показывает баннер с диагностикой: отсутствие HTTPS (`window.isSecureContext === false`), заблокированное разрешение или неподдерживаемый браузер. AudioContext разблокируется при первом клике/тапе на странице (iOS Safari требует воспроизведения тихого буфера синхронно в жесте).

- `GET /api/chat/rooms/` — мои чаты (с `last_message`, `unread_count`, `other_user`)
- `POST /api/chat/rooms/` — создать группу `{name, member_ids[]}` (только admin)
- `GET/PATCH/DELETE /api/chat/rooms/<id>/` — детали / переименовать / удалить
- `GET /api/chat/rooms/<id>/members/` — список участников
- `POST /api/chat/rooms/<id>/members/` — добавить участника (admin: `{user_id}`, teacher: себя)
- `DELETE /api/chat/rooms/<id>/members/<uid>/` — удалить участника
- `GET /api/chat/rooms/<id>/messages/?before=<id>&limit=50` — история (cursor pagination)
- `DELETE /api/chat/rooms/<id>/messages/<msg_id>/` — soft-delete сообщения
- `POST /api/chat/rooms/<id>/files/` — загрузить файл → создаёт сообщение + вложение
- `POST /api/chat/rooms/<id>/read/` — отметить прочитанным
- `GET /api/chat/users/?q=` — доступные для DM пользователи (фильтруется по правам)
- `POST /api/chat/direct/` — открыть/найти DM `{user_id}` → idempotent, возвращает ChatRoom
- **WebSocket** `ws://.../ws/chat/<room_id>/?token=<jwt>` — ChatConsumer
  - client→server: `send_message {text, reply_to?}`, `mark_read`, `typing`
  - server→client: `message_new {message}`, `message_deleted {message_id}`, `user_typing {user_id, display_name}`, `room_read {user_id, last_read_at}`

### КТП (`/api/ktp/`)
- `GET/POST /api/ktp/ctps/` — список КТП
- `GET/PUT/DELETE /api/ktp/ctps/:id/` — КТП
- `GET/POST /api/ktp/ctps/:id/topics/` — темы
- `POST /api/ktp/ctps/:id/topics/bulk/` — массовое создание тем
- `POST /api/ktp/ctps/:id/topics/import/` — импорт из CSV/XLSX
- `POST /api/ktp/ctps/:id/topics/autofill-dates/` — автозаполнение дат
- `POST /api/ktp/ctps/:id/copy/` — копирование КТП в другой класс

---

## Модели данных

### accounts/
```python
User
  # Расширяет AbstractUser
  is_admin: bool
  is_teacher: bool
  is_parent: bool
  is_student: bool
  must_change_password: bool  # принудительная смена при первом входе
  phone: str
  birth_date: date (null)     # дата рождения (для сотрудников и учеников)

StudentProfile
  user -> User
  school_class -> SchoolClass

TeacherProfile
  user -> User

ParentProfile
  user -> User
  children -> [StudentProfile]  # ученики (M2M)
  telegram: str (blank)         # Telegram-аккаунт
```

### school/
```python
GradeLevel       # параллель: "1 класс", "2 класс"
SchoolClass      # класс: "1-А", "1-Б" -> GradeLevel
  curator -> User (null, SET_NULL)  # куратор класса
Subject          # предмет глобально: "Математика"
GradeLevelSubject  # предмет в параллели
ClassGroup       # группа в классе: "Группа 1", "Группа 2"
  school_class -> SchoolClass
  name: str
  students -> [User] (M2M, опционально)
ClassSubject     # предмет класса (без привязки к группе)
  school_class -> SchoolClass
  name: str
  # unique_together: [school_class, name]
Room             # кабинет
ScheduleLesson   # урок в расписании
  school_class -> SchoolClass
  subject -> Subject
  teacher -> User (null)
  room -> Room (null)
  group -> ClassGroup (null)  # если урок для конкретной группы
  weekday: int (1-5)
  lesson_number: int
AhoRequest   # заявка в АХО
  name: str
  description: text
  location: str (blank)
  phone: str (blank)
  work_type: furniture|rooms|plumbing|other
  urgency: 1-5 (звёзды, blank)
  importance: 1-5 (звёзды, blank)
  submitted_by -> User (null)
  created_at: datetime

Substitution  # замена на конкретную дату
  date: date
  lesson_number: int
  school_class -> SchoolClass
  subject -> Subject
  teacher -> User (null)
  room -> Room (null)
  group -> ClassGroup (null)
  original_lesson -> ScheduleLesson (null)
  # unique: [date, lesson_number, school_class] (если group=null)
  # unique: [date, lesson_number, school_class, group] (если group задан)
```

### ktp/
```python
CTP              # КТП: teacher + school_class + subject
  is_public: bool

Topic            # тема урока в КТП
  ctp -> CTP
  order: int     # порядок (drag-and-drop)
  date: date
  title: str
  homework: str
  resources: JSON  # [{title, url}]

TopicFile        # прикреплённый файл к теме
  topic -> Topic
  file: FileField

Holiday          # праздник (для автозаполнения дат)
  date: date
```

### lessons/
```python
LessonFolder
  name: str
  owner -> User
  parent -> LessonFolder (null, self-referential)
  created_at: datetime

Lesson
  title: str
  description: str
  owner -> User
  folder -> LessonFolder (null)
  is_public: bool
  cover_color: str  # hex, default '#6366f1'
  created_at: datetime
  updated_at: datetime

Slide
  lesson -> Lesson
  order: int
  slide_type: content | image | poll | quiz | open_question | video | form | discussion
  title: str (blank)
  content: JSON  # структура зависит от slide_type:
    # content  → {blocks: [SlideBlock, ...]}
    # form     → {questions: [FormQuestion, ...]}
    # video    → {url, embed_url, caption}
    # discussion → {stickers: [...], strokes: [...]}
  image: FileField (null)  # upload_to='lesson_images/%Y/%m/'
  created_at: datetime
  updated_at: datetime

LessonMedia
  lesson -> Lesson
  file: FileField  # upload_to='lesson_media/%Y/%m/'
  uploaded_at: datetime

LessonSession
  lesson -> Lesson
  teacher -> User
  school_class -> SchoolClass (null)
  current_slide -> Slide (null)
  is_active: bool (default True)
  started_at: datetime (auto)
  ended_at: datetime (null)

FormAnswer          # ответы студентов на форму-слайд
  session -> LessonSession
  slide -> Slide
  student -> User
  answers: JSON     # [{question_id, value}, ...]
  submitted_at: datetime (auto_now)
  # unique_together: [session, slide, student] → upsert
```

### chat (groups app)/
```python
ChatRoom
  room_type: 'group' | 'direct'
  name: str (blank для direct)
  created_by -> User (null для direct)
  is_archived: bool

ChatMember
  room -> ChatRoom
  user -> User
  role: 'admin' | 'member'
  last_read_at: datetime (null)
  # unique_together: [room, user]

ChatMessage
  room -> ChatRoom
  sender -> User (null = удалён)
  text: str
  reply_to -> ChatMessage (null, self-ref)
  is_deleted: bool (soft delete)

MessageAttachment
  message -> ChatMessage
  file: FileField  # upload_to='chat_files/%Y/%m/'
  original_name: str
  file_size: int
  mime_type: str
```

### tasks/
```python
TaskGroup        # группа сотрудников для задач
  name: str
  description: str
  created_by -> User
  members -> [User] (M2M)

Task             # задача
  title: str
  description: str
  created_by -> User           # постановщик
  assigned_to -> User (null)   # исполнитель-человек
  assigned_group -> TaskGroup (null)  # исполнитель-группа
  taken_by -> User (null)      # кто фактически взял в работу
  status: new | in_progress | review | done
  due_date: date (null)
  completed_at: datetime (null)  # устанавливается при переходе в done, сбрасывается при откате
  # Computed (сериализатор): is_assignee, can_reassign

TaskFile         # файл, прикреплённый к задаче
  task -> Task
  file: FileField  # upload_to='task_files/%Y/%m/'
  original_name: str
  uploaded_by -> User
```

---

## Авторизация и роли

- **Аутентификация**: JWT (access 12ч, refresh 7д), токены в `localStorage`
- **Кастомный бэкенд**: вход по `first_name + last_name + password` (не username)
- **Роли**: `is_admin`, `is_teacher`, `is_parent`, `is_student` (несколько одновременно)
- **Permissions DRF**: `IsAuthenticated`, `PasswordChanged`, `IsAdmin`, `IsAdminOrTeacher`
- **Frontend**: `AuthContext` → `ProtectedRoute`, Axios-интерцептор добавляет Bearer-токен
- **AuthContext**: `updatePhone(phone)` — PATCH `/auth/me/`, обновляет user в state и localStorage; при инициализации: сначала загружает user из localStorage (instant), потом фоновый запрос `/auth/me/` для подхвата актуальных данных

---

## Ключевые фичи

### КТП (KTPDetailPage.tsx)
- Drag-and-drop сортировка тем
- Инлайн-редактирование через модал
- Массовое создание/удаление тем
- Импорт тем из Excel/CSV
- Автозаполнение дат (стартовая дата + дни недели + пропуск праздников)
- Загрузка/скачивание файлов на тему
- Ссылки на внешние ресурсы
- Копирование КТП в другой класс
- Публичный/приватный режим

### Расписание (SchedulePage.tsx + ScheduleGrid.tsx)
- Просмотр по классу / учителю / кабинету
- Режимы: неделя / день
- Создание/редактирование/удаление уроков
- Перемещение уроков (drag & drop)
- Дублирование уроков
- Разделение урока на группы / слияние групп
- Сводка часов по предметам
- **Групповые уроки**: в расписании класса ячейка делится на два блока (split view) когда в слоте 2 урока. В расписании учителя/кабинета показывается лейбл «Подгр.»
- **Импорт из Excel** (кнопка "Импорт из Excel", только для admin): `ScheduleImportModal.tsx`
  - Шаг 1: загрузка двух файлов (по классам + по учителям)
  - Шаги 2-4 (опциональные): review missing entities — классы, учителя, кабинеты — создать или связать с существующим
  - Шаг 5: подтверждение (опция "удалить существующее расписание")
  - Шаг 6: результат (создано/пропущено/ошибки)
  - Парсер: `backend/school/schedule_import.py`:
    - `parse_classes_file` — читает Excel по классам (2-col или 3-col на класс)
    - `parse_teachers_file` — читает Excel по учителям
    - `match_teachers` — привязывает учителей к урокам по (weekday, period, room); для групповых уроков заполняет teacher_name и teacher2_name
    - `analyze` — сравнивает с БД, возвращает missing_classes/teachers/rooms
    - `execute_import` — создаёт уроки; для групповых создаёт ClassGroup ("Группа 1"/"Группа 2") и ClassSubject; учителя/кабинеты ищутся сначала в маппингах, затем fallback в БД по фамилии/названию

### Управление людьми (PeoplePage → StaffTab / StudentsTab)
- Список и папочный вид учеников (параллель → класс → ученики)
- Массовое создание пользователей
- Контекстное меню: редактировать, удалить, сбросить пароль
- Фильтрация и сортировка

### Замены (SchedulePage.tsx → вкладка "Замены" → SubstitutionsTab.tsx)
- Вкладки на странице расписания: "Расписание" / "Замены"
- Навигация по неделям (стрелки, кнопка "Сегодня", прыжок к дате)
- Просмотр по классу / учителю / кабинету
- Сетка с конкретными датами в заголовке (SubstitutionsGrid.tsx)
- Ячейки с заменами выделены оранжевым; обычные уроки — белые
- Клик на ячейку открывает SubstitutionEditor.tsx — модал для создания/редактирования замены
- В редакторе: класс, предмет, учитель (только свободные по умолчанию), кабинет (только свободный)
- Toggle: показать всех учителей/кабинеты
- Оригинальный урок показан серым блоком сверху
- Экспорт в Excel всех замен за неделю (кнопка только для admins)

### Dashboard (DashboardPage.tsx)
- Ученик: темы на выбранный день с ДЗ, ресурсами, файлами
- Учитель/Админ: быстрые ссылки на КТП и разделы

### Таск-менеджер (TasksPage.tsx)
- **Три вкладки**: "Задачи" (канбан), "Выполненные" (таблица), "Группы"
- **Канбан** из 4 колонок: Поставленные / В работе / На проверке / Выполнено
- **Drag & Drop** между колонками (кроме "Выполнено" — только через кнопку "Принять")
- **Группы** (вкладка "Группы"): admin создаёт/удаляет группы и назначает участников чекбоксами; teacher вступает/покидает сам
- Задачу создаёт любой staff (admin/teacher): назначается человеку или группе, опционально срок
- **Статусные переходы**: `new→in_progress` и `in_progress→review` — только исполнитель; `review→done/in_progress` — только постановщик или admin
- **taken_by** — фиксируется кто взял задачу в работу, отображается на карточке
- **completed_at** — фиксируется при переходе в `done`, сбрасывается при откате
- **Переназначение** — постановщик или взявший могут переназначить исполнителя; задача сбрасывается в `new`
- **Файлы** — к задаче можно прикрепить любые файлы (хранятся в `media/task_files/`)
- **Ссылки в описании** активны (linkify)
- **Удаление** — только постановщик
- **Скрытие задач в колонке "Выполнено"**: кнопка `×` на карточке скрывает задачу из канбана; список скрытых ID сохраняется в `localStorage`; внизу колонки показывается счётчик скрытых со ссылкой "показать"; вкладка "Выполненные" всегда показывает все задачи независимо от скрытия
- **Вкладка "Выполненные"** — таблица с колонками: Задача, Постановщик, Поставлена, Исполнитель, Выполнена; каждая колонка сортируется; фильтры по постановщику и исполнителю; клик на строку разворачивает описание и файлы
- **Счётчик** в сайдбаре — синий бейдж рядом с "Задачи": `new` задачи мне + `review` задачи от меня; обновляется при каждом переходе по маршрутам

### Навигация (Layout.tsx)
- Фиксированный левый сайдбар (256px) на экранах ≥ 1024px
- На меньших экранах — скрыт, открывается кнопкой-гамбургером в топ-баре
- На мобильных — свайп вправо от левого края (<48px) открывает, свайп влево закрывает
- Аватар пользователя с инициалами в подвале → ссылка на `/account`

### Куратор класса (ClassDetail.tsx)
- Над вкладками класса строка "Куратор: ФИО / не назначен"
- Кнопка "Назначить/Изменить" открывает дропдаун с поиском по списку сотрудников
- PATCH `/school/classes/{id}/` с `{curator_id}` — назначить; `null` — снять
- В StaffTab у куратора в колонке "Роли" зелёный бейдж "Куратор 1-А"

### Родители (SchoolPage → вкладка "Родители" → ParentsTab.tsx)
- Таблица: Фамилия, Имя, Телефон, Telegram, Дети, Врем. пароль, меню
- Поиск по имени, пагинация
- Контекстное меню: Изменить, Сбросить пароль, Удалить
- Создание родителя: поля (фамилия, имя, телефон, email, telegram, дата рождения) + поиск и выбор детей
- Редактирование: те же поля + управление детьми (добавить поиском, убрать ×)
- Родитель = User с `is_parent=True` + ParentProfile(children M2M StudentProfile, telegram)
- Одноразовый пароль выдаётся при создании (как у всех)
- Привязка детей также через карточку ученика (StudentsTab → Edit → секция "Родители")

### Дашборд родителя (DashboardPage.tsx)
- Вкладки по детям: "Фамилия Имя (1-А)", "Фамилия Имя (3-Б)"
- Если ребёнок один — без вкладок
- При переключении вкладки: GET `/ktp/topics-by-date/?date=...&student_id={sp.id}`
- Если детей нет — сообщение "Нет привязанных учеников"

### Редактор урока (LessonEditorPage.tsx) — Фазы 2-3
- Страница `/lessons/:id/edit` — двухпанельный интерфейс: шапка + левая панель слайдов + холст
- **npm-зависимости**: `react-rnd` (drag блоков), `@tiptap/react` + `@tiptap/starter-kit` + `@tiptap/extension-text-style` (rich text, цвет, размер шрифта)
- **Фаза 3**: SlideTypePicker (5 типов: content/form/quiz/video/discussion), FormEditor, QuizEditor, VideoEditor, DiscussionBoard (WebSocket)
- **QuizEditor**: редактирование quiz-слайда — список вопросов (QuizQuestion[]), каждый с текстом, 2–6 вариантами (кнопка-буква = правильный), временем (10/15/20/30/45/60с); кнопка "Добавить вопрос"
- **QuizContent**: `{questions: [{id, text, options, correct, time_limit}]}` — НЕ плоская структура
- **FormAnswer.answers**: для quiz — dict по `str(question_idx)`: `{"0": {option_index, elapsed_ms, points}, "1": {...}}`
- **Фикс image-блока**: при перетаскивании пустого image-блока диалог загрузки файла не открывается (отслеживаем mouseDownPos)
- **WS Discussion** (редактор): URL `${proto}://${window.location.host}/ws/discussion/<slide_id>/?token=<jwt>`
- **Иконки типов**: 📄 content, 📋 form, 📹 video, 💬 discussion — отображаются в SlideThumb

#### Шапка
- Кнопка «← Уроки», редактируемый заголовок урока (сохранение на blur)
- Статус «✓ Сохранено / Сохраняю... / Не сохранено» (debounce 400мс)

#### Левая панель (~192px)
- Список слайдов с drag-and-drop сортировкой
- Превью-текст из первого текстового блока, номер слайда
- Удаление через hover-кнопку (confirm)
- Кнопки «+ Добавить слайд» сверху и снизу

#### Холст (960×540, 16:9)
- Масштабируется через `transform: scale` под ширину контейнера (ResizeObserver → `baseScale`)
- Пользовательский зум: кнопки −/+/Fit (множитель `zoomMul`, итоговый `scale = baseScale * zoomMul`)
- Рабочая область 600px вокруг холста — блоки можно выносить за пределы слайда (`overflow: visible`, без `bounds`)
- При открытии слайда холст центрируется в области прокрутки
- Клик по пустому месту холста или рабочей области — снять выделение

#### Блоки (`SlideBlock`)
Все блоки: `<Rnd>` для drag-перемещения, кастомные угловые ручки resize внутри rotation-div.
- **`text`**: Tiptap editor (Bold, Italic, Strike; BulletList, OrderedList; размер шрифта, цвет текста). Двойной клик → режим редактирования, клик мимо → выход + сохранение HTML
- **`image`**: `<img>` с `draggable={false}`; при пустом src — зона загрузки; кнопка «Заменить» при hover
- **`shape`**: SVG-фигуры — rect, circle, triangle, diamond, star, line. `viewBox` совпадает с реальными размерами блока → `strokeWidth` в реальных пикселях без искажений

#### Тулбары (контекстные, над холстом)
- **TiptapToolbar** (при редактировании текста): B / I / S̶ | •≡ / 1≡ | размер шрифта (select) | цвет текста (color-picker + ∅)
- **ShapeToolbar** (при выделении фигуры): заливка (color-swatch + ∅) | граница (color-swatch + ∅) | слайдер толщины 1–30px

#### Плавающая панель (над выделенным блоком)
Показывается когда блок выделен и не в режиме редактирования текста:
- ↻ Вращение: тянуть = свободное, Shift = привязка к 15°; показывает текущий угол + кнопку сброса
- ⬆ ↑ ↓ ⬇ — управление z-index (на передний / выше / ниже / на задний план)
- ⧉ Копировать блок (также Ctrl+C)
- 🗑 Удалить блок

#### Вращение (rotation)
- `rotation` хранится в блоке в градусах
- CSS `transform: rotate()` применяется на **внутреннем div** внутри `<Rnd>` (не на самом Rnd) — react-draggable не перезаписывает
- Угловые ручки resize находятся тоже внутри rotation-div → визуально вращаются вместе с блоком

#### Resize (кастомный)
`enableResizing={false}` на Rnd, ручки реализованы вручную. Математика с учётом угла поворота:
- При drag угловой ручки противоположный угол остаётся неподвижным
- Смещение мыши переводится в локальное пространство блока через `R(-angle)`
- Новый центр блока пересчитывается: `fixedWorld + R(angle) * halfLocal`
- Обновление `block.x/y/w/h` на каждый `mousemove` → фигуры перерисовываются в реальном времени

#### Копирование/вставка
- `Ctrl+C` — копирует выделенный блок в `copiedBlockRef`
- `Ctrl+V` — вставляет копию со сдвигом +20px, новым id, zIndex+1
- Кнопка ⧉ в плавающей панели — аналог Ctrl+C
- Не перехватывается когда активно редактирование текста (`editingId !== null`)

#### Медиафайлы (`LessonMedia`)
- `POST /api/lessons/lessons/:id/upload/` (multipart: `file`) → `{url}` — используется для блоков `image`
- Файлы хранятся в `media/lesson_media/%Y/%m/`

#### DiscussionBoard (редактор и презентер — общие паттерны)
- **Стикеры**: создаются кликом по цветному квадрату в тулбаре (6 пастельных цветов). Drag — только свой стикер. Кнопка `×` — только свой, admin/teacher — любой
- **Стрелки между стикерами**: при наведении на стикер появляются 4 синие точки (N/S/E/W). Drag от точки рисует пунктирную стрелку; отпустить на другом стикере — создаёт связь. Клик по стрелке (или × в середине) — удаляет. Hover — красная подсветка
- **Реалтайм перерисовка стрелок**: `onDrag(x,y)` в `StickerItem`/`DiscussionStickerItem` обновляет `dragPositions` в родителе → SVG стрелки используют `dragPositions[id] ?? sticker.x/y` и перерисовываются при каждом `mousemove`. При `onMove` (mouseup) `dragPositions` очищается
- **WS-протокол** (client→server): `add_sticker`, `update_sticker`, `delete_sticker`, `add_arrow`, `delete_arrow`, `update_topic`
- **WS-протокол** (server→client): `init`, `sticker_added`, `sticker_updated`, `sticker_deleted`, `arrow_added`, `arrow_deleted`, `topic_updated`

### Живая презентация (LessonPresenterPage.tsx)
- Страница `/lessons/sessions/:id/present` — fullscreen-режим для учителя и студентов
- **WS**: `${proto}://${window.location.host}/ws/session/<session_id>/?token=<jwt>` → группа `lesson_session_<id>`
- **Авто-реконнект**: при обрыве (код ≠ 1000/4001/4403) reconnect через 2с. StrictMode-safe: `if (wsRef.current === ws) wsRef.current = null`

#### Роли и поведение
| | Учитель (`isPresenter`) | Студент |
|---|---|---|
| WS-команды | `set_slide`, `end_session`, `video_control`, `quiz_start`, `quiz_show_results` | `form_answer`, `quiz_answer` |
| Форма | `FormResultsView` — статистика ответов | `FormAnswerView` — заполнить и отправить |
| Видео | Оверлей ▶/⏸, управляет синхронизацией | Получает `video_control` → postMessage в iframe |
| Викторина | `QuizPresenterView` — "Начать вопрос N/N", счётчик ответов, "Показать результаты" | `QuizAnswerView` — таймер, кнопки вариантов |
| Рейтинг | `QuizLeaderboardView` — правильный ответ + статистика + рейтинг + "Следующий вопрос →" | То же (без кнопки) |
| Конец урока | — | Показывает топ-3 из последнего quiz-рейтинга |
| Навигация | Стрелки ←/→, клавиши ArrowLeft/Right/Space | Нет |
| Доска | Может редактировать и удалять любые стикеры | Только свои |

#### Слайды в презентере (`SlideView`)
- `content` → рендер блоков только для чтения; `overflow: hidden` — блоки вне 960×540 не видны
- `form` → `FormResultsView` (учитель) или `FormAnswerView` (студент)
- `video` → `VideoSlideView` с YouTube postMessage API (`enablejsapi=1`)
- `discussion` → `DiscussionSlideView` (WS Discussion, те же стикеры/стрелки)

#### FormResultsView (вкладка «Общий план»)
- Для single/multiple: полосы с кол-вом выборов (A/B/C нейтральные буквы, синие полосы) — правильные ответы **не подсвечиваются**
- Счётчик `✓ N` в заголовке вопроса показывает кол-во правильных ответов (без раскрытия какой вариант правильный)
- Для text: только `Ответили: N` — индивидуальные ответы студентов **не показываются**
- Для scale: среднее значение и распределение по баллам
- Вкладка «Детально»: таблица студент×вопрос — полные ответы с правильностью (✓/✗)

#### FormAnswerView (студент)
- Все вопросы на одной странице, `required` блокирует отправку
- После отправки — зелёное «✓ Ответы отправлены» + ссылка «Изменить»
- Ответы хранятся локально (`formAnswers[slideId]`) — при смене слайда и возврате форма восстанавливается

#### Видео-синхронизация (VideoSlideView)
- Учитель: кнопка ▶/⏸ поверх iframe (только YouTube), отправляет WS `video_control {action: play|pause}`
- Студент: получает `video_control` → `iframe.contentWindow.postMessage({event:'command', func:'playVideo'/'pauseVideo'}, '*')`
- YouTube URL автоматически получает `?enablejsapi=1` для поддержки postMessage

#### WS-протокол сессии
- client→server: `set_slide {slide_id}`, `end_session`, `form_answer {slide_id, answers}`, `video_control {action}`
- server→client: `init {session_id, current_slide_id, is_active}`, `slide_changed {slide_id}`, `session_ended`, `form_results_updated {slide_id, results}`, `video_control {action}`
- `form_answer` обрабатывается **до** проверки `is_presenter` (студенты могут отправлять); остальные — только presenter/admin

#### Начальная загрузка результатов формы
- Когда учитель переходит на form-слайд: `GET /lessons/sessions/:id/slides/:sid/form-results/` (если ещё не загружено)
- Живые обновления: WS `form_results_updated` → `setFormResults(prev => ({...prev, [slide_id]: results}))`

### Уроки (LessonsPage.tsx) — Фаза 1
- Страница `/lessons` — интерактивные уроки в стиле Nearpod
- **Вкладки**: «Мои уроки» (созданные мной) / «Все уроки» (все в школе, только staff/admin)
- **Папочная навигация**: иерархические папки, breadcrumbs, переход внутрь по клику
- **Карточки папок**: название, счётчик вложенных папок и уроков, контекстное меню (переименовать, удалить)
- **Карточки уроков**: цветная шапка (cover_color), название, автор (в «Все»), кол-во слайдов; меню (открыть, дублировать, удалить)
- **Drag-and-drop**: папки и уроки перетаскиваются в другие папки (HTML5 DnD). Drop на FolderCard — перемещение внутрь. Drop на breadcrumbs — перемещение вверх по иерархии. Бэкенд: PUT с `{folder: id}` для урока, `{parent: id}` для папки.
- **Удаление папок**: проверяется рекурсивно — если в папке или подпапках есть уроки, удаление запрещено (400 от бэкенда), ошибка показывается пользователю
- **Создание папки**: модал с вводом названия
- **Создание урока**: модал с названием, описанием и выбором цвета → редирект в редактор
- **Дублирование**: копия урока создаётся в той же папке
- Пункт «Уроки» добавлен в сайдбар с иконкой монитора

### Аккаунт (AccountPage.tsx)
- Карточка профиля: аватар (инициалы), имя, роли
- Редактирование телефона: поле сохраняется через `PATCH /api/auth/me/`, кнопка активна только при изменении
- Смена пароля: валидация (≥6 символов, совпадение), состояния загрузки/успеха/ошибки

### Заявки (RequestsPage.tsx)
- Две вкладки: "Заявки в АХО" и "Заявки в ИТ" (заглушка "в разработке")
- **АХО-форма** (`AhoTab`): имя (предзаполняется из профиля), описание задачи, местоположение (кабинеты из БД + список именованных помещений), телефон (предзаполняется из профиля), вид работ (мебель/помещения/сантехника/прочее), срочность и важность (звёздочки 1-5), согласие с правилами
- После отправки: экран успеха с кнопкой "Отправить ещё одну" (имя и телефон сохраняются, остальное сбрасывается)
- Валидация: имя, описание, вид работ и согласие — обязательны

---

## Паттерны кода

### Frontend
- **Оптимистичное обновление UI** — обновляем state до ответа API
- **Контекстные меню** — правая кнопка мыши на строке таблицы
- **Модальные формы** — все создание/редактирование через модалы
- **Пагинация** — кастомные хуки/утилиты в view-слое
- **Типизация** — все сущности имеют интерфейсы в `src/types/`

### Backend
- **ViewSets / Function-based views** — смешанный стиль (больше FBV)
- **Пагинация** — кастомные утилиты в views
- **Батч-операции** — API для создания/удаления множества объектов
- **Мультифильтрация** — имя, email, телефон, роль

---

## Запуск

```bat
start.bat
```
Скрипт автоматически:
1. Находит Python 3.10/3.11/3.12
2. Запускает Django на `0.0.0.0:8000`
3. Запускает Vite на `0.0.0.0:5173`
4. Определяет IP в локальной сети и выводит URL

Доступ: `https://localhost:5173` или `https://<local-ip>:5173`

**Примечание про HTTPS**: Vite запускается с самоподписанным сертификатом (`@vitejs/plugin-basic-ssl`). При первом заходе с телефона браузер покажет предупреждение «Ненадёжный сертификат» — нажать «Дополнительно» → «Перейти». Это нужно один раз. HTTPS обязателен для работы браузерных уведомлений и ряда других API.

---

## Локализация

- `LANGUAGE_CODE = 'ru'`
- `TIME_ZONE = 'Europe/Moscow'`
- Интерфейс — русский
- Кастомный auth backend — вход по имени и фамилии
