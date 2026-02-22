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

Порты: frontend `:5173`, backend `:8000`. Vite проксирует `/api` и `/media` на Django.

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
│   │   │   ├── SchoolPage.tsx       # Структура школы
│   │   │   └── SettingsPage.tsx     # Настройки (праздники)
│   │   └── components/
│   │       ├── Layout.tsx           # Навбар + обёртка
│   │       ├── StaffTab.tsx         # CRUD сотрудников
│   │       ├── StudentsTab.tsx      # CRUD учеников (список + папки)
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
│   │           └── ClassStudents.tsx # Ученики класса
└── backend/
    ├── config/                      # Django settings, urls, wsgi
    ├── accounts/                    # Пользователи, роли, профили
    ├── school/                      # Классы, предметы, кабинеты, расписание
    │   └── schedule_import.py       # Парсер Excel для импорта расписания
    └── ktp/                         # КТП, темы, файлы, праздники
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

---

## API Backend

### Auth (`/api/auth/`)
- `POST /api/auth/login/` — вход по имени+фамилии+паролю (кастомный бэкенд)
- `POST /api/auth/change-password/` — смена пароля
- `GET /api/auth/me/` — текущий пользователь

### Пользователи (`/api/admin/`)
- `GET/POST /api/admin/staff/` — сотрудники
- `GET/PUT/DELETE /api/admin/staff/:id/` — конкретный сотрудник
- `GET/POST /api/admin/students/` — ученики
- `GET/PUT/DELETE /api/admin/students/:id/` — конкретный ученик
- `POST /api/admin/reset-password/:id/` — сброс пароля

### Школа (`/api/school/`)
- Grade levels, school classes, subjects, rooms, class groups, schedule lessons
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

StudentProfile
  user -> User
  school_class -> SchoolClass

TeacherProfile
  user -> User

ParentProfile
  user -> User
  children -> [User]  # ученики
```

### school/
```python
GradeLevel       # параллель: "1 класс", "2 класс"
SchoolClass      # класс: "1-А", "1-Б" -> GradeLevel
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

Доступ: `http://localhost:5173` или `http://<local-ip>:5173`

---

## Локализация

- `LANGUAGE_CODE = 'ru'`
- `TIME_ZONE = 'Europe/Moscow'`
- Интерфейс — русский
- Кастомный auth backend — вход по имени и фамилии
