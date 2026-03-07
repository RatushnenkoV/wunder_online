# WunderOnline — Архитектура

## Стек технологий

| Слой | Технологии |
|------|-----------|
| Frontend | React 19, TypeScript, Vite 6, React Router 7, Axios, Tailwind CSS 4 |
| Backend | Django 5.1, Django REST Framework 3.x, simplejwt |
| БД (dev) | SQLite |
| БД (prod) | PostgreSQL (psycopg2 установлен) |
| Real-time | Django Channels 4.2 + channels-redis 4.2.1 + Daphne 4.1.2 |
| Кэш | Redis |
| Статика | WhiteNoise (со сжатием) |
| Dev-запуск | `start.bat` — поднимает оба сервера |

**Порты:** frontend `:5173` (HTTPS dev), backend `:8000` (HTTP).
Vite проксирует `/api`, `/media`, `/ws` на Django.

---

## Структура проекта

```
WunderOnline/
├── start.bat                        # Запуск dev-серверов
├── DOCS.md                          # Главный индекс документации
├── docs/                            # Разбитая документация
│   ├── ARCHITECTURE.md              # Этот файл
│   ├── AUTH.md                      # Авторизация и роли
│   ├── MODELS.md                    # Все Django-модели
│   ├── API.md                       # Все API-эндпоинты
│   ├── FRONTEND.md                  # Фронтенд: страницы, компоненты
│   └── ANALYSIS.md                  # Безопасность, производительность, качество
├── frontend/
│   ├── vite.config.ts               # Vite + proxy + basicSsl
│   ├── tailwind.config.js
│   ├── src/
│   │   ├── App.tsx                  # React Router — все маршруты
│   │   ├── main.tsx                 # Точка входа
│   │   ├── api/client.ts            # Axios с JWT-интерцептором
│   │   ├── contexts/AuthContext.tsx # Контекст авторизации
│   │   ├── types/index.ts           # TypeScript-интерфейсы всех сущностей
│   │   ├── pages/                   # Страницы (см. FRONTEND.md)
│   │   └── components/              # Переиспользуемые компоненты
└── backend/
    ├── config/
    │   ├── settings.py              # Настройки Django (из .env)
    │   ├── urls.py                  # Корневой роутер
    │   ├── asgi.py                  # ASGI + WebSocket routing
    │   └── wsgi.py
    ├── accounts/                    # Пользователи, роли, авторизация
    ├── school/                      # Классы, расписание, предметы
    ├── ktp/                         # КТП (учебные планы)
    ├── tasks/                       # Таск-менеджер (канбан)
    ├── lessons/                     # Интерактивные уроки (Nearpod-аналог)
    ├── groups/                      # Чаты и мессенджер
    ├── projects/                    # Проекты (Google Classroom-аналог)
    ├── curator/                     # Кураторские отчёты
    ├── yellow_list/                 # Жёлтый список (поведение)
    ├── news/                        # Новости
    └── manage.py
```

---

## Django-приложения

| App | Назначение | Ключевые модели |
|-----|-----------|----------------|
| **accounts** | Пользователи, роли, авторизация | User |
| **school** | Структура школы | GradeLevel, SchoolClass, Subject, Room, ScheduleLesson, Substitution, AhoRequest |
| **ktp** | КТП (учебные планы) | CTP, Topic, TopicFile, Holiday |
| **tasks** | Таск-менеджер | Task, TaskGroup, TaskFile |
| **lessons** | Интерактивные уроки | Lesson, Slide, LessonSession, FormAnswer, Textbook, VocabProgress, LessonAssignment |
| **groups** | Чат/мессенджер | ChatRoom, ChatMessage, ChatPoll, ChatTaskTake |
| **projects** | Проекты | Project, ProjectMember, ProjectAssignment, AssignmentSubmission |
| **curator** | Кураторские отчёты | CuratorSection, CuratorField, CuratorHint, CuratorReport |
| **yellow_list** | Жёлтый список | YellowListEntry, YellowListComment |
| **news** | Новости | NewsPost, NewsImage, NewsRead |

---

## Ключевые файлы для AI-агентов

| Задача | Файл |
|--------|------|
| Добавить маршрут | `frontend/src/App.tsx` |
| Добавить API-вызов | `frontend/src/api/client.ts` |
| Добавить тип | `frontend/src/types/index.ts` |
| Добавить permission | `backend/accounts/permissions.py` |
| Добавить URL | `backend/config/urls.py` → подключить `app/urls.py` |
| Добавить модель | `backend/<app>/models.py` → `makemigrations` → `migrate` |
| WebSocket routing | `backend/config/asgi.py` + `backend/<app>/routing.py` |
| Настройки | `backend/config/settings.py` (читает из `.env`) |

---

## Переменные окружения (.env)

```env
SECRET_KEY=...
DEBUG=True/False
ALLOWED_HOSTS=...
CORS_ALLOW_ALL_ORIGINS=True/False
CORS_ALLOWED_ORIGINS=https://...
DATABASE_URL=postgresql://...  # если не SQLite
```

---

## Команды разработки

```bash
# Dev (из корня проекта)
start.bat              # Поднять frontend (5173) + backend (8000)

# Backend
cd backend
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser

# Frontend
cd frontend
npm install
npm run dev
npm run build
```

---

## WebSocket-архитектура

Все WebSocket-соединения аутентифицируются через JWT-токен в query string:
`ws://.../ws/<path>/?token=<jwt_access_token>`

Middleware: `backend/groups/middleware.py` → `JWTAuthMiddleware`

| Consumer | Маршрут | Назначение |
|----------|---------|-----------|
| `DiscussionConsumer` | `/ws/discussion/<slide_id>/` | Доска обсуждений (стикеры, стрелки) |
| `LessonSessionConsumer` | `/ws/session/<session_id>/` | Синхронизация урока (викторина, формы) |
| `ChatConsumer` | `/ws/chat/<room_id>/` | Чат в реальном времени |

Подробнее: [WEBSOCKETS в MODELS.md](MODELS.md#websockets)

---

## Статические файлы и медиа

- **Dev:** Vite раздаёт `/media` с бэкенда через proxy
- **Prod:** WhiteNoise для `/static/`, Nginx для `/media/`
- `MEDIA_ROOT` = `backend/media/`
- `STATIC_ROOT` = `backend/staticfiles/` (для `collectstatic`)
