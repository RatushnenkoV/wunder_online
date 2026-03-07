# WunderOnline — Документация

> Система управления школой. Авторизация, расписание, КТП, уроки, чаты, проекты.
> **AI-агентам:** читать этот файл + нужный раздел из `docs/` вместо анализа всего кода.

---

## Навигация по документации

| Файл | Содержание |
|------|-----------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Стек, структура файлов, команды, WebSocket-архитектура |
| [docs/AUTH.md](docs/AUTH.md) | Авторизация, роли, JWT, permissions, матрица доступа |
| [docs/MODELS.md](docs/MODELS.md) | Все Django-модели всех приложений |
| [docs/API.md](docs/API.md) | Все API-эндпоинты с методами и правами доступа |
| [docs/FRONTEND.md](docs/FRONTEND.md) | Страницы, компоненты, типы, Tiptap, API-клиент |
| [docs/ANALYSIS.md](docs/ANALYSIS.md) | Безопасность, производительность, технический долг |

---

## Быстрый старт

```bash
start.bat          # Запустить frontend (5173) + backend (8000)
```

**Стек:** React 19 + TypeScript + Vite · Django 5.1 + DRF · SQLite (dev) / PostgreSQL (prod) · Redis + Channels

---

## Ключевые пути

| Задача | Файл |
|--------|------|
| Роутер | `frontend/src/App.tsx` |
| API-клиент (Axios + JWT) | `frontend/src/api/client.ts` |
| Типы | `frontend/src/types/index.ts` |
| Контекст авторизации | `frontend/src/contexts/AuthContext.tsx` |
| Django URLs | `backend/config/urls.py` |
| Настройки Django | `backend/config/settings.py` |
| Permissions | `backend/accounts/permissions.py` |
| WebSocket routing | `backend/config/asgi.py` |

---

## Приложения Django

| App | Назначение |
|-----|-----------|
| `accounts/` | Пользователи, роли, JWT-авторизация |
| `school/` | Классы, расписание, замены |
| `ktp/` | Календарно-тематические планы |
| `tasks/` | Таск-менеджер (канбан) |
| `lessons/` | Интерактивные уроки (Nearpod-аналог) |
| `groups/` | Чат / мессенджер |
| `projects/` | Проекты (Google Classroom-аналог) |
| `curator/` | Кураторские отчёты |
| `yellow_list/` | Жёлтый список (поведение) |
| `news/` | Новости с Tiptap-редактором |

---

## Роли пользователей

| Флаг | Роль | Ключевые права |
|------|------|---------------|
| `is_admin` | Администратор | Всё |
| `is_teacher` | Учитель | КТП, уроки, расписание |
| `is_parent` | Родитель | Данные своих детей |
| `is_student` | Ученик | Только назначенный контент |
| `is_spps` | СППС (+ is_teacher) | Жёлтый список |

Вход: `first_name + last_name + password` (не email/username).
JWT: access 12ч / refresh 7д, хранятся в `localStorage`.

---

## Критические проблемы (требуют исправления до продакшена)

1. 🔴 **Нет лимита размера файлов** → DoS через загрузку 1GB+
2. 🔴 **N+1 запрос** в `ChatRoomListView` (~строка 43 groups/views.py)
3. 🔴 **Нет индексов БД** на полях `first_name`, `last_name`, `created_at` и др.
4. 🔴 **Гигантские компоненты** — `LessonEditorPage.tsx` (158KB), `LessonPresenterPage.tsx` (128KB)
5. 🟠 **Нет rate limiting** на `/auth/login/`
6. 🟠 **Нет ротации refresh-токена**

Подробнее: [docs/ANALYSIS.md](docs/ANALYSIS.md)

---

## Рабочий процесс (строго обязательно)

1. **Начало сессии** → прочитать этот файл + нужный раздел из `docs/`
2. **После изменений** → обновить соответствующий файл в `docs/`
3. **Новый маршрут** → обновить `docs/FRONTEND.md` (таблица маршрутов)
4. **Новая модель** → обновить `docs/MODELS.md`
5. **Новый API** → обновить `docs/API.md`
6. **Документировать до коммита, не после**

---

## Метрики проекта

| Метрика | Значение |
|---------|---------|
| Django-приложений | 10 |
| Моделей | ~60 |
| API-эндпоинтов | ~100 |
| Frontend-страниц | 24 |
| WebSocket-консьюмеров | 3 |
| Крупнейший компонент | LessonEditorPage (158KB) |
