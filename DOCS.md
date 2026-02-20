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
│   │   ├── types/                   # TypeScript-интерфейсы
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── ChangePasswordPage.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── KTPListPage.tsx
│   │   │   ├── KTPDetailPage.tsx    # Главный редактор КТП
│   │   │   ├── SchedulePage.tsx     # Расписание
│   │   │   ├── PeoplePage.tsx       # Управление персоналом/учениками
│   │   │   ├── SchoolPage.tsx       # Структура школы
│   │   │   └── SettingsPage.tsx     # Настройки (праздники)
│   │   └── components/
│   │       ├── Layout.tsx           # Навбар + обёртка
│   │       ├── StaffTab.tsx         # CRUD сотрудников
│   │       ├── StudentsTab.tsx      # CRUD учеников (список + папки)
│   │       ├── ClassesGrid.tsx      # Список классов
│   │       ├── ClassDetail.tsx      # Детали класса
│   │       ├── ScheduleGrid.tsx          # Сетка расписания
│   │       ├── LessonEditor.tsx          # Редактор урока
│   │       ├── SubstitutionsTab.tsx      # Вкладка замен (навигация по неделям)
│   │       ├── SubstitutionsGrid.tsx     # Сетка замен с датами в заголовке
│   │       └── SubstitutionEditor.tsx    # Редактор замены (модал)
└── backend/
    ├── config/                      # Django settings, urls, wsgi
    ├── accounts/                    # Пользователи, роли, профили
    ├── school/                      # Классы, предметы, кабинеты, расписание
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

### Замены (`/api/school/substitutions/`)
- `GET /api/school/substitutions/?date_from=...&date_to=...` — все замены за период
- Фильтры: `school_class=`, `teacher=` (где он новый ИЛИ оригинальный), `room=`
- `POST /api/school/substitutions/` — создать/обновить замену (upsert по date+lesson_number+school_class)
- `PUT/DELETE /api/school/substitutions/:id/` — обновить/удалить замену (IsAdmin)
- `GET /api/school/substitutions/export/?date_from=...&date_to=...` — экспорт в Excel

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
ClassGroup       # группа в классе (для дифференциации)
ClassSubject     # предмет в конкретном классе
Room             # кабинет
ScheduleLesson   # урок в расписании
  school_class -> SchoolClass
  subject -> Subject
  teacher -> User
  room -> Room
  class_group -> ClassGroup (опционально)
  weekday: int (0-6)
  period: int (номер урока)
```

### school/ (дополнительно)
```python
Substitution  # замена на конкретную дату
  date: date
  lesson_number: int
  school_class -> SchoolClass      # класс замены
  subject -> Subject               # предмет замены
  teacher -> User (null)           # учитель замены
  room -> Room (null)              # кабинет замены
  original_lesson -> ScheduleLesson (null)  # оригинальный урок по расписанию
  # unique_together: [date, lesson_number, school_class]
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

---

## Авторизация и роли

- **Аутентификация**: JWT (access 12ч, refresh 7д), токены в `localStorage`
- **Кастомный бэкенд**: вход по `first_name + last_name + password` (не username)
- **Роли**: `is_admin`, `is_teacher`, `is_parent`, `is_student` (несколько одновременно)
- **Permissions DRF**: `IsAuthenticated`, `PasswordChanged`, `IsAdmin`, `IsAdminOrTeacher`
- **Frontend**: `AuthContext` → `ProtectedRoute`, Axios-интерцептор добавляет Bearer-токен

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
- Перемещение уроков
- Дублирование уроков
- Разделение урока на группы / слияние групп
- Сводка часов по предметам

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
