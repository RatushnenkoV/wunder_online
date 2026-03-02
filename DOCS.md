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
│   │   │   ├── LessonsPage.tsx           # Уроки: 3 вкладки (Мои/Все/Учебники), иерархия учителей, TextbooksTab
│   │   │   ├── LessonEditorPage.tsx      # Редактор урока (canvas, Фазы 2-3)
│   │   │   ├── LessonPresenterPage.tsx   # Живая презентация (учитель + студент)
│   │   │   ├── ProjectsPage.tsx          # Список проектов
│   │   │   ├── ProjectDetailPage.tsx     # Детали проекта (лента + задания)
│   │   │   └── CuratorReportPage.tsx     # Полностраничная форма кураторской таблицы (/people/curator/:studentId)
│   │   └── components/
│   │       ├── Layout.tsx           # Навбар + обёртка
│   │       ├── TextbookViewer.tsx   # Полноэкранный PDF-читалка (react-pdf, навигация, зум)
│   │       ├── DrawingCanvas.tsx    # Canvas-рисовалка поверх PDF (аннотации, нормализованные coords)
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
│   │       ├── projects/
│       │   ├── ProjectFeed.tsx         # Лента проекта (WebSocket чат)
│       │   └── ProjectAssignments.tsx  # Задания (список + модалы)
│       ├── curator/
│       │   └── CuratorTab.tsx          # Список учеников класса куратора
│       └── school/
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
    ├── lessons/                     # Интерактивные уроки (Nearpod-аналог)
    ├── projects/                    # Проекты (Google Classroom-аналог)
    ├── curator/                     # Кураторская таблица
    ├── yellow_list/                 # Жёлтый список (заявки по ученикам, СППС)
    └── news/                        # Новости (фид, редактор, аудитория)
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
| `/people` | PeoplePage | Сотрудники (staffOnly, readOnly для учителей) |
| `/school` | SchoolPage | Ученики: Классы+Ученики+Родители+Куратор (staffOnly) |
| `/admin/school` | SchoolPage | Алиас /school |
| `/admin/settings` | SettingsPage | Только admin |
| `/account` | AccountPage | Авторизованные |
| `/tasks` | TasksPage | Авторизованные (включая студентов — видят только свои задачи) |
| `/requests` | RequestsPage | Авторизованные |
| `/lessons` | LessonsPage | Авторизованные |
| `/lessons/:id/edit` | LessonEditorPage | Авторизованные |
| `/lessons/sessions/:id/present` | LessonPresenterPage | Авторизованные |
| `/people/curator/:studentId` | CuratorReportPage | Учитель-куратор |
| `/chats` | ChatsPage | Авторизованные |
| `/projects` | ProjectsPage | Авторизованные |
| `/projects/:id` | ProjectDetailPage | Авторизованные (только участники) |
| `/yellow-list` | YellowListPage | Сотрудники (staffOnly); вкладка «Список» — только is_spps |
| `/news` | NewsPage | Все авторизованные; admin — всё; staff (teacher/spps) — for_staff; parent + student — for_parents |

---

## API Backend

### Auth (`/api/auth/`)
- `POST /api/auth/login/` — вход по имени+фамилии+паролю (кастомный бэкенд)
- `POST /api/auth/change-password/` — смена пароля
- `GET /api/auth/me/` — текущий пользователь (для студента доп. поля: `school_class_id`, `school_class_name`; для родителя: `children[].school_class_id`)

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
- `GET/POST /api/tasks/tasks/` — задачи видимые мне / создать (staff). GET фильтр: `?status=`. При создании файлы прикрепляются после — сначала POST /tasks/tasks/, затем POST /tasks/tasks/:id/files/
- `GET/PUT /api/tasks/tasks/:id/` — задача. DELETE — только создатель
- `POST /api/tasks/tasks/:id/status/` — изменить статус `{status}`. `new→in_progress`, `in_progress→review`: только исполнитель. `review→done/in_progress`: только постановщик или admin
- `POST /api/tasks/tasks/:id/reassign/` — переназначить `{assigned_to|assigned_group}`. Сбрасывает статус в `new`, очищает `taken_by`. Доступно: постановщик, взявший в работу, admin
- `POST /api/tasks/tasks/:id/files/` — загрузить файл (multipart: `file`)
- `DELETE /api/tasks/tasks/:id/files/:file_id/` — удалить файл

### Уроки (`/api/lessons/`)
- `GET/POST /api/lessons/folders/` — папки (GET: мои корневые; POST: создать)
- `GET/PUT/DELETE /api/lessons/folders/:id/` — CRUD папки
- `GET /api/lessons/folders/:id/contents/` — содержимое папки (subfolders + lessons) — доступно всем авторизованным
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
- `GET /api/lessons/school-overview/` — учителя с уроками `[{teacher_id, teacher_name, folders_count, lessons_count}]`
- `GET /api/lessons/teacher-root/?teacher_id=<id>` — корневые папки + уроки учителя `{teacher_id, teacher_name, folders, lessons}`
- `GET/POST /api/lessons/textbooks/` — учебники (GET: `?grade_level_id=` фильтр; POST: загрузить, только staff, multipart: file, title, subject?, grade_level_ids[])
- `GET /api/lessons/textbooks/grade-levels/` — параллели для учебников (staff: все; ученик: своя; родитель: параллели детей)
- `GET/PUT/DELETE /api/lessons/textbooks/:id/` — CRUD учебника
- `GET /api/lessons/sessions/:id/slides/:sid/textbook-annotations/` — аннотации страниц (текущий студент, все страницы)
- `PUT /api/lessons/sessions/:id/slides/:sid/textbook-annotations/` — сохранить аннотацию `{page_number, strokes}` (PUT = upsert)
- **WebSocket** `ws://…/ws/discussion/<slide_id>/?token=<jwt>` — доска обсуждений (DiscussionConsumer)
- **WebSocket** `ws://…/ws/session/<session_id>/?token=<jwt>` — синхронизация живой презентации (LessonSessionConsumer)
  - **Quiz-команды**: `quiz_start {slide_id, question_idx}` (учитель→сервер), `quiz_answer {slide_id, question_idx, option_index, elapsed_ms}` (студент→сервер), `quiz_show_results {slide_id, question_idx}` (учитель→сервер)
  - **Quiz-события**: `quiz_started {slide_id, question_idx, time_limit_sec}`, `quiz_answer_received {slide_id, question_idx, answered_count}`, `quiz_answer_confirmed {slide_id, question_idx, option_index, points, is_correct}`, `quiz_leaderboard {slide_id, question_idx, correct_index, leaderboard, answer_stats}`

### Чаты (`/api/chat/`)

**Модель прав:** Все видят только те чаты, в которых состоят (включая admin). Teacher — вступает в группы сам; DM учителям/студентам/admin. Student — только назначенные группы + DM своим учителям и куратору. Parent — только DM куратору(ам) детей. Admin создаёт группы и добавляет кого угодно.

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
- `POST /api/chat/rooms/<id>/polls/` — создать опрос `{question, options[], is_multiple}` → создаёт ChatMessage + ChatPoll + ChatPollOption[]
- `POST /api/chat/polls/<poll_id>/vote/` — проголосовать `{option_id}` (single: удаляет старые голоса)
- `POST /api/chat/rooms/<id>/chat-tasks/` — создать задачу в чате `{title, description?, due_date?}` (только teacher/admin) → создаёт Task + ChatMessage
- `POST /api/chat/rooms/<id>/chat-tasks/<task_id>/take/` — взять задачу → создаёт личную копию Task для пользователя + ChatTaskTake запись; несколько участников могут взять одну задачу; повторное нажатие возвращает 400
- `GET /api/chat/users/?q=` — доступные для DM пользователи (фильтруется по правам)
- `POST /api/chat/direct/` — открыть/найти DM `{user_id}` → idempotent, возвращает ChatRoom
- **WebSocket** `ws://.../ws/chat/<room_id>/?token=<jwt>` — ChatConsumer
  - client→server: `send_message {text, reply_to?}`, `mark_read`, `typing`
  - server→client: `message_new {message}`, `message_deleted {message_id}`, `user_typing {user_id, display_name}`, `room_read {user_id, last_read_at}`, `poll_updated {poll_id, options, total_votes}`, `chat_task_taken {task_id, taken_by_id, taken_by_name}`

### Проекты (`/api/projects/`)
- `GET/POST /api/projects/` — список проектов, где я участник / создать (только is_teacher/is_admin); admin тоже видит только свои
- `GET/PUT/DELETE /api/projects/:id/` — детали / редактировать / удалить (только teacher проекта)
- `GET /api/projects/users/?q=&project_id=` — поиск пользователей для приглашения
- `GET/POST /api/projects/:id/members/` — участники / добавить участника `{user_id, role}`
- `DELETE /api/projects/:id/members/:uid/` — удалить участника
- `GET/POST /api/projects/:id/posts/?before=` — лента / отправить пост `{text}`
- `DELETE /api/projects/:id/posts/:pid/` — soft-delete поста
- `POST /api/projects/:id/posts/:pid/files/` — загрузить файл к посту
- `GET/POST /api/projects/:id/assignments/` — задания / создать (только teacher); список возвращает `review_count` — кол-во сдач в статусе review
- `GET/PUT/DELETE /api/projects/:id/assignments/:aid/` — задание
- `POST /api/projects/:id/assignments/:aid/files/` — файл к заданию
- `GET/POST /api/projects/:id/assignments/:aid/submissions/` — сдачи / сдать работу (upsert, переводит Task → review)
- `PATCH /api/projects/:id/assignments/:aid/submissions/:sid/` — выставить оценку `{grade}` (опционально, только teacher)
- `POST /api/projects/:id/assignments/:aid/submissions/:sid/accept/` — принять работу (Task → done)
- `POST /api/projects/:id/assignments/:aid/submissions/:sid/send-back/` — вернуть на доработку `{comment}` (Task → in_progress + review_comment; добавляет событие `sent_back` в `submission.events`)
- `POST /api/projects/:id/assignments/:aid/submissions/:sid/files/` — файл к сдаче (переводит Task → review)
- **WebSocket** `ws://.../ws/project/<project_id>/?token=<jwt>` — ProjectConsumer
  - client→server: `send_post {text}`, `typing`
  - server→client: `post_new {post}`, `post_deleted {post_id}`, `post_updated {post}`, `user_typing {user_id, display_name}`

### Кураторская таблица (`/api/curator/`)
- `GET /api/curator/structure/` — разделы + поля + подсказки (все авторизованные)
- `GET /api/curator/my-class/` — ученики класса, куратором которого является текущий учитель
- `GET /api/curator/reports/<student_id>/` — отчёт ученика за текущий (или ?academic_year=) год
- `PUT /api/curator/reports/<student_id>/` — upsert отчёта `{values: [{field, value}, ...], academic_year}`
- `GET /api/curator/hints/` — список подсказок (admin; ?field= для фильтра)
- `POST /api/curator/hints/` — создать подсказку `{field, text}` (admin)
- `PUT /api/curator/hints/<id>/` — обновить подсказку (admin)
- `DELETE /api/curator/hints/<id>/` — удалить подсказку (admin)

### Жёлтый список (`/api/yellow-list/`)
- `GET /api/yellow-list/students/?q=` — поиск учеников (all staff); поиск по имени, фамилии, классу; возвращает compact-список
- `GET /api/yellow-list/unread-count/` — `{count: N}` непрочитанных заявок (только is_spps)
- `GET /api/yellow-list/` — все заявки (только is_spps), сгруппированы по ученикам на фронте
- `POST /api/yellow-list/` — подать заявку `{date, student_profile_id, fact, lesson}` (все сотрудники: admin/teacher/spps)
- `GET /api/yellow-list/<id>/` — деталь заявки (только is_spps); автоматически помечает как прочитанную (`is_read_by_spps=True`)
- `POST /api/yellow-list/<id>/comments/` — добавить комментарий `{text}` (только is_spps)
- `POST /api/yellow-list/<id>/create-task/` — создать Task из заявки `{title?, due_date?}` (только is_spps; исполнитель не указывается)

### Новости (`/api/news/`)
- `GET /api/news/unread-count/` — `{count: N}` непрочитанных (видимых для текущего пользователя опубликованных)
- `POST /api/news/upload-image/` — загрузить изображение (admin) → `{url}` для встраивания в редакторе
- `GET /api/news/?limit=5&offset=0` — лента новостей с пагинацией → `{results: [...], count: N}`
- `POST /api/news/` — создать черновик `{title, content, for_staff, for_parents}` (только admin)
- `GET/PUT/DELETE /api/news/<id>/` — деталь / обновить / удалить (GET опубликованного: автоматически помечает прочитанным)
- `POST /api/news/<id>/publish/` — переключить публикацию (admin; требует выбранную аудиторию) → `{is_published}`
- `POST /api/news/<id>/read/` — отметить прочитанным вручную

**Права:** admin — всё (включая черновики); staff (teacher/spps) — опубликованные for_staff=True; parent + student — опубликованные for_parents=True.
**Поле `for_parents`:** в UI отображается как «Ученики и родители» — видно и родителям, и студентам.
**Бейдж в сайдбаре:** синяя точка для всех пользователей, если есть непрочитанные. Страница грузит по 5 новостей; при открытии все видимые непрочитанные автоматически помечаются прочитанными.
**Редактор:** Tiptap (шрифт/размер/цвет/bold/italic/underline/strike), маркированный и нумерованный списки, загрузка фото с обтеканием текстом (float left/right/center) + изменение размера (поле «Ширина»), кнопка эмодзи (@emoji-mart/react). CustomEvent `news:read` сбрасывает счётчик в Layout.

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
  is_spps: bool      # СППС (комбинируется с is_teacher)
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

### curator/
```python
CuratorSection      # Сфера развития: name, order
CuratorField        # Что оцениваем: section -> CuratorSection, name, order
CuratorHint         # Подсказка: field -> CuratorField, text
CuratorReport       # Отчёт по ученику: student -> User, academic_year ("2025-2026"), created_by, updated_at
                    # unique_together: [student, academic_year]
CuratorReportValue  # Значение поля: report -> CuratorReport, field -> CuratorField, value: text
                    # unique_together: [report, field]
```

### yellow_list/
```python
YellowListEntry        # Заявка по ученику
  date: date
  student -> StudentProfile
  fact: TextField
  lesson: str (blank)  # на каком уроке
  submitted_by -> User (null)
  created_at: datetime
  is_read_by_spps: bool (default=False)  # True после первого GET от СППС

YellowListComment      # Комментарий СППС к заявке
  entry -> YellowListEntry (related_name='comments')
  text: TextField
  created_by -> User (null)
  created_at: datetime
```

### news/
```python
NewsPost
  title: str (max_length=255)
  content: TextField (HTML, хранит Tiptap-output)
  author -> User (null, SET_NULL)
  created_at: datetime (auto_now_add)
  updated_at: datetime (auto_now)
  is_published: bool (default=False)
  for_staff: bool (default=False)    # видна сотрудникам (teacher/spps); UI: «Сотрудники»
  for_parents: bool (default=False)  # видна родителям И студентам; UI: «Ученики и родители»
  # Нельзя опубликовать если оба false

NewsImage              # изображения, загружаемые в редакторе
  image: ImageField (upload_to='news_images/%Y/%m/')
  uploaded_by -> User (null, SET_NULL)
  uploaded_at: datetime (auto_now_add)

NewsRead               # отслеживание прочтений
  post -> NewsPost (related_name='reads')
  user -> User
  read_at: datetime (auto_now_add)
  unique_together: [post, user]
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
  slide_type: content | image | poll | quiz | open_question | video | form | discussion | vocab | textbook
  title: str (blank)
  content: JSON  # структура зависит от slide_type:
    # content  → {blocks: [SlideBlock, ...]}
    # form     → {questions: [FormQuestion, ...]}
    # video    → {url, embed_url, caption}
    # discussion → {stickers: [...], strokes: [...]}
    # vocab    → {targetLang, words, tasks, repetitions}
    # textbook → {textbook_id, page_from, page_to}
  image: FileField (null)  # upload_to='lesson_images/%Y/%m/'
  created_at: datetime
  updated_at: datetime

LessonMedia
  lesson -> Lesson
  file: FileField  # upload_to='lesson_media/%Y/%m/'
  uploaded_at: datetime

Textbook
  title: str
  file: FileField  # upload_to='textbooks/%Y/'
  original_name: str (blank)
  file_size: BigInt
  subject -> Subject (null)
  grade_levels -> [GradeLevel] (M2M)
  uploaded_by -> User (null, SET_NULL)
  created_at: datetime

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

TextbookAnnotation  # рисунки ученика поверх страниц учебника (приватные, session-scoped)
  session -> LessonSession
  slide -> Slide
  student -> User
  page_number: PositiveInt
  strokes: JSON     # [AnnotationStroke, ...] — normalized [0-1] coords
  updated_at: datetime (auto_now)
  # unique_together: [session, slide, student, page_number] → upsert
```

### projects/
```python
Project
  name: str
  description: str
  cover_color: str (default '#6366f1')
  created_by -> User (null, SET_NULL)
  created_at, updated_at: datetime

ProjectMember
  project -> Project
  user -> User
  role: 'teacher' | 'student'
  joined_at: datetime
  unique_together: [project, user]

ProjectPost  # сообщение в ленте
  project -> Project
  author -> User (null, SET_NULL)
  text: str
  is_deleted: bool (soft delete)
  created_at, updated_at: datetime

PostAttachment
  post -> ProjectPost
  file: FileField (upload_to='project_posts/%Y/%m/')
  original_name, file_size, mime_type

ProjectAssignment  # задание
  project -> Project
  title: str
  description: str
  due_date: date (null)
  created_by -> User (null, SET_NULL)
  created_at, updated_at: datetime

AssignmentAttachment
  assignment -> ProjectAssignment
  file: FileField (upload_to='project_assignments/%Y/%m/')
  original_name, file_size, mime_type

AssignmentSubmission  # сдача работы студентом
  assignment -> ProjectAssignment
  student -> User
  text: str (blank)
  submitted_at: datetime (auto_now)
  grade: str (null, blank)
  graded_by -> User (null, SET_NULL)
  graded_at: datetime (null)
  unique_together: [assignment, student]  # upsert

SubmissionFile
  submission -> AssignmentSubmission
  file: FileField (upload_to='project_submissions/%Y/%m/')
  original_name, file_size, mime_type
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
  task -> Task (null, FK — задача из чата)
  is_deleted: bool (soft delete)

MessageAttachment
  message -> ChatMessage
  file: FileField  # upload_to='chat_files/%Y/%m/'
  original_name: str
  file_size: int
  mime_type: str

ChatPoll
  message -> ChatMessage (OneToOne)
  question: TextField
  is_multiple: bool

ChatPollOption
  poll -> ChatPoll
  text: str (max 500)
  order: PositiveSmallIntegerField

ChatPollVote
  option -> ChatPollOption
  user -> User
  unique_together: [option, user]

ChatTaskTake  # фиксирует взятие задачи из чата; каждый участник получает личную копию
  message -> ChatMessage
  user -> User
  task -> Task (null, SET_NULL — личная копия задачи)
  taken_at: datetime (auto)
  unique_together: [message, user]
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
- **Доступ**: все авторизованные (включая студентов). Студенты видят только свои задачи (`assigned_to=user` или `assigned_group__members=user`). Кнопка "Создать задачу" скрыта для non-staff.
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

### Проекты (ProjectsPage + ProjectDetailPage) — Google Classroom-аналог
- Страницы `/projects` (список) и `/projects/:id` (детали)
- **Создание**: только педагог или admin → цвет, название, описание
- **Участники**: teacher приглашает любых учеников и педагогов (поиск по имени/фамилии)
- **Роли**: `teacher` (педагог, создаёт задания, оценивает) и `student` (ученик, сдаёт работы)
- **Лента** (`ProjectFeed.tsx`): WebSocket-чат в реальном времени, все участники пишут, поддержка файловых вложений, soft-delete, typing indicator, авто-реконнект
- **Задания** (`ProjectAssignments.tsx`) — интегрированы с Tasks:
  - При создании задания → автоматически создаётся Task (статус `new`) для каждого студента проекта
  - При добавлении нового студента → создаются Tasks для всех существующих заданий
  - Ученик видит статус: "Не сдано" (new) / "На проверке" (review) / "На доработке" (in_progress) / "Принято" (done)
  - Ученик сдаёт текст + файлы → Task переходит в `review`
  - Учитель видит все сдачи: кнопки "Принять" (Task → done) и "На доработку" (вводит комментарий → Task → in_progress + review_comment)
  - **История сдачи** (`events: SubmissionEvent[]`): JSONField на `AssignmentSubmission`; каждое действие (submitted / sent_back / accepted) добавляет запись `{type, author, comment, at}`. Отображается компонентом `EventTimeline` как хронологический список — виден и учителю, и ученику
  - `review_comment` на Task хранит только последний комментарий; полная история — в `events`
  - Задачи проектов видны в TasksPage в канбан-колонках; teacher может вернуть на доработку прямо оттуда
- **WS**: `ws://.../ws/project/<id>/?token=<jwt>` — ProjectConsumer, group `project_<id>`
- **Сайдбар**: пункт "Проекты" (папка) между "Уроки" и "Заявки"

### Чат (ChatWindow.tsx + ChatMessageBubble.tsx)

#### Ссылки в чате
- URL в тексте сообщений автоматически кликабельны (regex `https?://...`)
- У своих сообщений ссылки светло-синие, у чужих — синие; открываются в новой вкладке

#### Опросы в чате
- Кнопка-скрепка заменена меню **"Прикрепить"**: Файл / Опрос / Задача
- **Создание опроса** (`PollCreatorModal`): вопрос, варианты (2–10), чекбокс мультивыбора
- **Карточка опроса**: все варианты серые, прогресс-бар синий (виден на любом варианте); выбранный вариант — галочка слева + синий текст, проценты справа
- **Голосование**: до голосования — клик на вариант; после — кнопки заблокированы, проценты показаны
- **user_voted**: при WS-broadcast `poll_updated` сохраняется из локального state (не перезаписывается данными голосующего); после своего голосования — обновляется из ответа API (правильный `user_voted` для текущего пользователя)
- **Переголосовать**: ПКМ по карточке опроса → контекстное меню → "Переголосовать" (сбрасывает локальное состояние, разрешает выбор снова; бэкенд для single удаляет старый голос)
- **Результаты**: кнопка "Результаты" внизу карточки → модал с прогресс-барами и списком проголосовавших по каждому варианту

#### Задачи из чата
- **Создание** (`TaskCreatorModal`, только teacher/admin): название, описание, срок → создаётся Task-шаблон (без исполнителя, status=new) + ChatMessage
- **Карточка задачи**: заголовок, описание, срок, разделитель, кнопка «Взять задачу» + секция «Ещё никто не взял» / «Взяли (N): [бейджи]»
- **Взятие задачи (новая логика)**:
  - **Первый берёт** → оригинальная задача обновляется (assigned_to=user, taken_by=user, status=in_progress), не клонируется
  - **Следующие берут** → создаётся личная копия Task для каждого (assigned_to=user, status=in_progress)
  - В обоих случаях: запись ChatTaskTake; повторное нажатие заблокировано
- **Твой бейдж** — синий с галочкой, остальные — белые с синей рамкой
- **WS**: `chat_task_taken` → обновляет список `takers` у всех в комнате в реальном времени

#### Доступ к /tasks
- Маршрут `/tasks` открыт всем авторизованным (включая студентов)
- Студенты видят только задачи, где `assigned_to=user` или `assigned_group__members=user`
- Пункт «Задачи» показывается в сайдбаре всем

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
- **Фаза 5 (Учебник)**: SlideTypePicker расширен до 7 типов (+vocab, +textbook). TextbookSlideEditor: выбор учебника из списка + диапазон страниц (page_from/page_to), debounced save 400мс
- **QuizEditor**: редактирование quiz-слайда — список вопросов (QuizQuestion[]), каждый с текстом, 2–6 вариантами (кнопка-буква = правильный), временем (10/15/20/30/45/60с); кнопка "Добавить вопрос"
- **QuizContent**: `{questions: [{id, text, options, correct, time_limit}]}` — НЕ плоская структура
- **FormAnswer.answers**: для quiz — dict по `str(question_idx)`: `{"0": {option_index, elapsed_ms, points}, "1": {...}}`
- **Фикс image-блока**: при перетаскивании пустого image-блока диалог загрузки файла не открывается (отслеживаем mouseDownPos)
- **WS Discussion** (редактор): URL `${proto}://${window.location.host}/ws/discussion/<slide_id>/?token=<jwt>`
- **Иконки типов**: 📄 content, 📋 form, 📹 video, 💬 discussion, 📖 textbook — отображаются в SlideThumb

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
- `textbook` → `TextbookSlideView`: react-pdf `<Document>/<Page>` + DrawingCanvas (только для студентов), собственная навигация по страницам (page_from..page_to), аннотации сохраняются через PUT textbook-annotations с debounce 800мс

#### DrawingCanvas (`frontend/src/components/DrawingCanvas.tsx`)
- Props: `{ width, height, strokes, onStrokesChange, readOnly? }`
- Хранит strokes нормализованными [0–1] → аннотации не зависят от размера экрана
- Инструменты: 5 цветов (чёрный/красный/синий/зелёный/оранжевый), ластик (destination-out), отменить (Undo), очистить всё
- Touch-события: onTouchStart/Move/End с `e.preventDefault()`, `touchAction: none`

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

### Уроки (LessonsPage.tsx) — Фазы 1-5
- Страница `/lessons` — интерактивные уроки в стиле Nearpod + учебники
- **Три вкладки**: «Мои уроки» / «Все уроки» / «Учебники». Default: staff → «Мои уроки», студент/родитель → «Учебники»

#### Вкладка «Мои уроки» / «Все уроки»
- **Папочная навигация**: иерархические папки, breadcrumbs, переход внутрь по клику
- **Карточки папок**: название, счётчик вложенных папок и уроков, контекстное меню (переименовать, удалить)
- **Карточки уроков**: цветная шапка (cover_color), название, автор (в «Все»), кол-во слайдов; меню (открыть, дублировать, удалить)
- **«Все уроки»**: корень — карточки учителей (`TeacherCard`, `GET /lessons/school-overview/`); клик → корневые папки и уроки учителя (`GET /lessons/teacher-root/?teacher_id=`); далее — стандартная папочная навигация через `/lessons/folders/:id/contents/`
- **Drag-and-drop**: папки и уроки перетаскиваются в другие папки (HTML5 DnD). Drop на FolderCard — перемещение внутрь. Drop на breadcrumbs — перемещение вверх по иерархии. Бэкенд: PUT с `{folder: id}` для урока, `{parent: id}` для папки.
- **Удаление папок**: проверяется рекурсивно — если в папке или подпапках есть уроки, удаление запрещено (400 от бэкенда), ошибка показывается пользователю
- **Создание папки**: модал с вводом названия
- **Создание урока**: модал с названием, описанием и выбором цвета → редирект в редактор
- **Дублирование**: копия урока создаётся в той же папке
- Пункт «Уроки» добавлен в сайдбар с иконкой монитора

#### Вкладка «Учебники»
- Учебники сгруппированы по **параллелям** (GradeLevel): папки «5 класс», «6 класс» и т.д.
- **Ролевой доступ к параллелям** (`GET /lessons/textbooks/grade-levels/`): staff — все; ученик — своя параллель (авто-вход); родитель с 1 ребёнком — авто-вход; с несколькими — список карточек с именами детей
- **Карточки учебников** (`TextbookCard`): цветная шапка, название, предмет, размер файла
  - PDF: кнопка «Открыть» на hover → открывает `TextbookViewer`; кнопка «Скачать»
  - Не-PDF: только «Скачать»
- **Загрузка** (только staff): multipart: `file`, `title`, `subject?`, `grade_level_ids[]` → `POST /lessons/textbooks/`
- **TextbookViewer** (`components/TextbookViewer.tsx`): полноэкранный PDF-ридер (z-50):
  - Библиотека: `react-pdf` v10 + `pdfjs-dist` v5, воркер: `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`
  - Навигация: кнопки ←/→, ввод номера страницы, клавиши ←→ и Escape
  - Зум: 0.5× – 3× (шаг 0.25), ResponsiveObserver для ширины
  - Тулбар: название, навигация, зум, кнопка скачать, закрыть
  - Нижняя панель: «В начало», прогресс-бар, «В конец», процент

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

---

## Подготовка к продакшену

### Конфигурация через переменные окружения

`settings.py` использует `python-decouple`. Файл конфига — `backend/.env` (не коммитится в git).

| Переменная | Dev-значение | Prod-значение |
|---|---|---|
| `SECRET_KEY` | insecure-ключ | длинный случайный ключ |
| `DEBUG` | `True` | `False` |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1` | `yourdomain.com` |
| `CORS_ALLOW_ALL_ORIGINS` | `True` | `False` |
| `CORS_ALLOWED_ORIGINS` | — | `https://yourdomain.com` |
| `DB_ENGINE` | sqlite3 (default) | `django.db.backends.postgresql` |
| `DB_NAME/USER/PASSWORD/HOST/PORT` | — | данные PostgreSQL |
| `REDIS_URL` | `redis://127.0.0.1:6379` | `redis://127.0.0.1:6379` |

Шаблон: `backend/.env.example`. Для dev скопировать как `backend/.env`.

### Статические файлы

- `STATIC_ROOT = BASE_DIR / 'staticfiles'` — папка для `collectstatic`
- `whitenoise` в MIDDLEWARE — раздача статики без Nginx (опционально)
- `backend/staticfiles/` исключён из git

### Архитектура продакшена

```
Браузер → HTTPS (443) → Nginx
    ├── /static/   → backend/staticfiles/
    ├── /media/    → backend/media/
    └── /api/ /ws/ → Daphne :8001 (ASGI)
                         ↓
                    Django + DRF
                         ↓
                 PostgreSQL    Redis
```

### Команды деплоя (на сервере)

```bash
# Backend
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput

# Запуск
daphne -b 0.0.0.0 -p 8001 config.asgi:application

# Frontend
npm install && npm run build
# → dist/ раздаётся Nginx как статика
```
