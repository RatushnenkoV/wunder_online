# WunderOnline — Анализ: безопасность, производительность, качество

> Дата анализа: 2026-03-06
> Статус: критические проблемы выявлены, требуют исправления до продакшена

---

## Сводная таблица приоритетов

| # | Проблема | Приоритет | Трудозатраты |
|---|----------|-----------|-------------|
| 1 | Нет лимита размера загружаемых файлов | 🔴 Критично | 1 час |
| 2 | N+1 запрос в списке чатов | 🔴 Критично | 2 часа |
| 3 | Гигантские компоненты (LessonEditor 158KB) | 🔴 Критично | 2-3 недели |
| 4 | Отсутствуют индексы БД | 🔴 Критично | 2 часа |
| 5 | Слишком широкий `except Exception` | 🟠 Высокий | 3 часа |
| 6 | Логирование только в lessons | 🟠 Высокий | 2 часа |
| 7 | Нет rate limiting на API | 🟠 Высокий | 4 часа |
| 8 | Тихое подавление ошибок во фронтенде | 🟠 Высокий | 3 часа |
| 9 | Нет пагинации на ряде эндпоинтов | 🟡 Средний | 4 часа |
| 10 | Смешанный стиль permission-проверок | 🟡 Средний | 1 день |
| 11 | Отсутствует CONN_MAX_AGE | 🟡 Средний | 30 мин |
| 12 | Ротация refresh-токена не реализована | 🟡 Средний | 4 часа |
| 13 | WS-консьюмеры не проверяют членство | 🟡 Средний | 3 часа |

---

## 1. БЕЗОПАСНОСТЬ

### 1.1 Загрузка файлов без ограничения размера 🔴

**Где:** `import_users_view()`, `schedule_import_preview()`, загрузка учебников PDF, загрузка файлов к задачам.

**Проблема:** Злоумышленник может загрузить файл 1GB+, что приведёт к исчерпанию памяти/диска.

**Исправление:**
```python
# backend/config/settings.py
DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024   # 10 MB
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024   # 10 MB

# В view, где нужен дополнительный контроль:
if request.FILES['file'].size > 50 * 1024 * 1024:  # 50 MB для PDF
    return Response({'detail': 'Файл слишком большой'}, status=400)
```

---

### 1.2 Отсутствие rate limiting 🟠

**Где:** Все API-эндпоинты, особенно `/auth/login/`.

**Проблема:** Можно брутфорсить пароли. Атака с множества IP может перегрузить сервер.

**Исправление:**
```python
# backend/config/settings.py
REST_FRAMEWORK = {
    ...
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '20/minute',
        'user': '200/minute',
    }
}

# Для login — отдельный строгий throttle:
class LoginThrottle(AnonRateThrottle):
    rate = '5/minute'
```

---

### 1.3 WebSocket — нет проверки членства 🟡

**Где:** `DiscussionConsumer`, `LessonSessionConsumer` в `backend/lessons/consumers.py`

**Проблема:** Аутентифицированный пользователь может подключиться к чужому слайду/сессии.

**Проверить и добавить:**
```python
async def connect(self):
    user = self.scope['user']
    slide_id = self.scope['url_route']['kwargs']['slide_id']
    # Проверить, что пользователь относится к этому уроку
    slide = await database_sync_to_async(Slide.objects.get)(id=slide_id)
    if not await self._can_access_slide(user, slide):
        await self.close()
        return
    await self.channel_layer.group_add(...)
    await self.accept()
```

---

### 1.4 Ротация refresh-токена 🟡

**Где:** `backend/accounts/views.py` (refresh endpoint от simplejwt)

**Проблема:** При угоне refresh-токена атакующий может получать новые access-токены 7 дней.

**Исправление** (simplejwt настройка):
```python
# settings.py
SIMPLE_JWT = {
    ...
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
}
# + добавить 'rest_framework_simplejwt.token_blacklist' в INSTALLED_APPS
# + миграции
```

---

### 1.5 CORS и заголовки безопасности 🟡

**Текущее состояние:** `CORS_ALLOW_ALL_ORIGINS=True` в `.env` для dev (нормально).

**Для production обязательно:**
```python
# settings.py (production)
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = ['https://yourdomain.com']

# Добавить django-csp или nginx headers:
# Content-Security-Policy: default-src 'self'
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
```

---

### 1.6 Логирование токенов/ошибок входа 🟠

**Проблема:** Нет логов неудачных попыток входа. Невозможно обнаружить атаку брутфорса.

**Исправление:**
```python
# accounts/views.py в login_view
if user is None:
    logger.warning(f'Failed login attempt: {first_name} {last_name} from {request.META.get("REMOTE_ADDR")}')
    return Response({'detail': '...'}, status=401)
```

---

## 2. ПРОИЗВОДИТЕЛЬНОСТЬ

### 2.1 N+1 запрос в списке чатов 🔴

**Где:** `backend/groups/views.py`, функция `ChatRoomListView.get()` (~строка 43)

**Проблема:**
```python
for r in rooms_list:
    last_msg = r.messages.filter(is_deleted=False).last()  # N запросов!
```

**Исправление:**
```python
from django.db.models import Prefetch

rooms = ChatRoom.objects.prefetch_related(
    'members_rel__user',
    Prefetch(
        'messages',
        queryset=ChatMessage.objects.filter(is_deleted=False).order_by('-created_at'),
        to_attr='recent_messages'
    )
).filter(...)

# В сериализаторе:
last_msg = room.recent_messages[0] if room.recent_messages else None
```

---

### 2.2 Отсутствуют индексы БД 🔴

**Поля, по которым идут запросы без индекса:**

| Модель | Поле | Тип запроса |
|--------|------|------------|
| `User` | `first_name`, `last_name` | Поиск при фильтрации |
| `Topic` | `date` | Сортировка/фильтр |
| `ChatMessage` | `created_at` | Сортировка |
| `NewsPost` | `created_at` | Сортировка + пагинация |
| `Substitution` | `date` | Фильтр по дате |
| `YellowListEntry` | `created_at` | Сортировка |

**Исправление:**
```python
# В моделях добавить:
class Meta:
    indexes = [
        models.Index(fields=['created_at']),
        models.Index(fields=['date']),
    ]

# Или на поле:
first_name = models.CharField(max_length=..., db_index=True)
last_name = models.CharField(max_length=..., db_index=True)
```

---

### 2.3 Нет connection pooling для PostgreSQL 🟡

**Где:** `backend/config/settings.py`

**Исправление:**
```python
DATABASES = {
    'default': {
        ...
        'CONN_MAX_AGE': 600,  # Держать соединение 10 минут
    }
}
```

Для высокой нагрузки: PgBouncer или `django-db-geventpool`.

---

### 2.4 Тяжёлые операции в запросах 🟠

**Excel-импорт (accounts/views.py, school/views.py):**
- Парсинг Excel-файла происходит синхронно в основном потоке
- При файле 1000 строк — запрос займёт 5-10 секунд

**Рекомендация:** Вынести в Celery-задачу для production:
```python
# Сейчас:
result = parse_excel(file)  # блокирует

# Будущее:
task = import_users.delay(file_path)
return Response({'task_id': task.id})
```

---

### 2.5 Нет пагинации на крупных эндпоинтах 🟡

**Без пагинации:**
- `GET /api/school/classes/` — вернёт все классы
- `GET /api/school/subjects/` — вернёт все предметы
- `GET /api/tasks/` — вернёт все задачи

**Для production с тысячами записей это проблема.**

**Исправление:**
```python
# settings.py
REST_FRAMEWORK = {
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
}
```

Или добавить DRF `PageNumberPagination` в конкретные views.

---

### 2.6 Redis dump.rdb в корне проекта 🟡

**Проблема:** Файл `dump.rdb` находится в `D:\Документы\WunderOnline\dump.rdb`.
- Может случайно закоммититься
- В production Redis должен быть на отдельном сервере/томе

**Исправление:** Добавить в `.gitignore`:
```
dump.rdb
*.rdb
```

---

## 3. КАЧЕСТВО КОДА И ПОДДЕРЖИВАЕМОСТЬ

### 3.1 Гигантские компоненты (ГЛАВНАЯ ПРОБЛЕМА) 🔴

| Файл | Размер | Строки | Рекомендация |
|------|--------|--------|-------------|
| `LessonEditorPage.tsx` | 158KB | ~3200 | Разбить на 10+ компонентов |
| `LessonPresenterPage.tsx` | 128KB | ~2600 | Разбить на 6+ компонентов |
| `TasksPage.tsx` | 58KB | ~1200 | Разбить на 3+ компонента |
| `LessonsPage.tsx` | 66KB | ~1400 | Разбить на 4+ компонента |

**Предлагаемая декомпозиция LessonEditorPage:**
```
LessonEditorPage.tsx      ← оркестратор (~200 строк)
├── SlideCanvas.tsx        ← canvas с блоками
├── SlideList.tsx          ← боковая панель со слайдами
├── BlockToolbar.tsx        ← панель инструментов
├── TextBlock.tsx          ← текстовый блок (Tiptap)
├── ImageBlock.tsx         ← изображение
├── ShapeBlock.tsx         ← фигура
├── SlideTypePicker.tsx    ← выбор типа слайда (уже есть)
├── QuizEditor.tsx         ← редактор викторины (уже есть)
├── FormEditor.tsx         ← редактор формы (уже есть)
└── VideoEditor.tsx        ← редактор видео (уже есть)
```

---

### 3.2 Несогласованный стиль проверки прав 🟡

**Проблема:** В одних местах используются декораторы, в других — inline-проверки:

```python
# Вариант 1 (декоратор — правильно):
@permission_classes([IsAdmin, PasswordChanged])
def view(request): ...

# Вариант 2 (inline — встречается в коде):
def view(request):
    if not request.user.is_admin:
        return Response({'detail': '...'}, status=403)
```

**Исправление:** Стандартизировать на декораторах. Создать базовый ViewSet:
```python
# accounts/permissions.py (добавить):
class BaseStaffPermission(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and not request.user.must_change_password
```

---

### 3.3 Широкий `except Exception` 🟠

**Где:** `accounts/views.py` (~строка 200):
```python
except Exception as e:
    errors.append(f'Запись {i+1}: {str(e)}')
```

**Проблема:** Скрывает реальные ошибки (IntegrityError, ValidationError и т.д.).

**Исправление:**
```python
except (IntegrityError, ValueError) as e:
    errors.append(f'Запись {i+1}: {str(e)}')
except Exception as e:
    logger.exception(f'Unexpected error processing row {i+1}')
    errors.append(f'Запись {i+1}: непредвиденная ошибка')
```

---

### 3.4 Тихое подавление ошибок на фронтенде 🟠

**Где:** `frontend/src/contexts/AuthContext.tsx`:
```typescript
api.get('/auth/me/').catch(() => {})  // Ошибка проглочена
```

**Исправление:**
```typescript
api.get('/auth/me/').catch((err) => {
  console.error('[AuthContext] Failed to load user:', err)
  // или: reportToSentry(err)
})
```

---

### 3.5 Логирование недостаточное 🟠

**Текущее состояние:** логируется только `lessons` app.

**Должно логироваться:**
- Все ошибки аутентификации (failed login)
- Ошибки при импорте Excel
- WebSocket disconnects
- Ошибки при отправке файлов

**Исправление в settings.py:**
```python
LOGGING = {
    'version': 1,
    'handlers': {
        'console': {'class': 'logging.StreamHandler'},
        'file': {
            'class': 'logging.FileHandler',
            'filename': BASE_DIR / 'logs/django.log',
        },
    },
    'loggers': {
        'django': {'handlers': ['console', 'file'], 'level': 'WARNING'},
        'accounts': {'handlers': ['console', 'file'], 'level': 'INFO'},
        'lessons': {'handlers': ['console'], 'level': 'INFO'},
        'groups': {'handlers': ['console'], 'level': 'WARNING'},
    },
}
```

---

### 3.6 TypeScript — потенциальные `any` 🟡

**Где:** В больших компонентах (LessonEditorPage, LessonPresenterPage) вероятны `any`-типы для промежуточных состояний.

**Проверка:**
```bash
cd frontend
npx tsc --strict --noEmit 2>&1 | grep "any"
```

**Правило:** Не использовать `any`. Вместо этого — `unknown` + type guards или конкретные типы из `types/index.ts`.

---

### 3.7 Дублирование логики между приложениями 🟡

**Паттерны, которые повторяются:**
1. Фильтрация пользователей по роли — в каждом app свой код
2. Обработка файловых загрузок — дублирующийся код в tasks, projects, ktp, lessons
3. Проверка `_is_member()` — реализована в projects, но не абстрагирована

**Рекомендация:** Создать `backend/core/` с общими утилитами:
```
backend/core/
├── permissions.py    ← все Permission классы
├── mixins.py         ← FileUploadMixin, MemberCheckMixin
└── utils.py          ← get_user_role(), filter_by_access()
```

---

### 3.8 Отсутствует валидация формата файлов 🟠

**Где:** Все view с загрузкой файлов

**Проблема:** Можно загрузить `evil.exe` как "изображение".

**Исправление:**
```python
ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']

def validate_file_type(file, allowed_types):
    import magic
    mime = magic.from_buffer(file.read(1024), mime=True)
    file.seek(0)
    if mime not in allowed_types:
        raise ValidationError(f'Недопустимый тип файла: {mime}')
```

---

## 4. РЕКОМЕНДАЦИИ ДЛЯ AI-АГЕНТОВ

### Что нужно знать перед изменением кода

1. **Читать DOCS.md и docs/** — не анализировать весь код с нуля
2. **Обновлять DOCS.md** после каждого изменения маршрутов, моделей, поведения
3. **Проверять типы в `types/index.ts`** при изменении моделей
4. **Запускать миграции** после изменения моделей
5. **Не создавать файлы** без необходимости — редактировать существующие

### Частые ошибки при модификации кода

| Ошибка | Где встречается | Как избежать |
|--------|----------------|-------------|
| Забыть добавить тип в `types/index.ts` | Любое изменение модели | Всегда проверять синхронизацию |
| Создать URL в app/views.py, забыть в config/urls.py | Новые эндпоинты | Проверять urls.py обоих файлов |
| Использовать `@tiptap/extension-text-style` как default import | News/KTP редакторы | Только named exports! |
| Забыть `PasswordChanged` в permission list | Новые views | Добавлять всегда для защищённых views |
| N+1 запрос в новом QuerySet | Все list-views | Всегда добавлять select_related/prefetch_related |

---

## 5. ТЕКУЩИЙ ТЕХНИЧЕСКИЙ ДОЛГ (backlog)

> Последнее обновление: 2026-03-07

### Критично (до production)
- [x] Лимиты размера файлов (`DATA_UPLOAD_MAX_MEMORY_SIZE`) — **выполнено 2026-03-06**
- [x] Rate limiting на `/auth/login/` — **выполнено 2026-03-06**
- [x] Индексы БД (миграция) — **выполнено 2026-03-06**
- [x] `dump.rdb` в `.gitignore` — **уже было**
- [x] `CONN_MAX_AGE` для PostgreSQL — **выполнено 2026-03-07** (600с по умолчанию, переопределяется через `DB_CONN_MAX_AGE` в .env)

### Высокий приоритет
- [x] Fix N+1 в `ChatRoomListView` — **выполнено 2026-03-06**
- [x] Ротация refresh-токена (`ROTATE_REFRESH_TOKENS=True`) — **выполнено 2026-03-06**
- [x] Frontend: очередь рефреша токенов в `client.ts` — **выполнено 2026-03-06**
- [x] Расширить LOGGING — **выполнено 2026-03-07** (accounts/groups/school/django.request + file handler → `backend/logs/django.log`)
- [x] Заменить широкие `except Exception` на конкретные — **выполнено 2026-03-07** (accounts/views.py: AttributeError для профилей, IntegrityError/ValueError/KeyError для batch-import)
- [x] Проверка MIME-типа файлов при загрузке — **выполнено 2026-03-07** (`backend/core/validators.py` без внешних зависимостей; 14 upload-views покрыты)

### Средний приоритет
- [x] Пагинация на `/api/tasks/` — **выполнено 2026-03-07** (page_size=20, max=200; frontend обновлён; classes/subjects оставлены без пагинации — справочники в 13 местах)
- [x] Логирование неудачных попыток входа — **выполнено 2026-03-07** (logger.warning в login_view)
- [x] Проверка членства в WS-консьюмерах — **выполнено 2026-03-07** (DiscussionConsumer: класс+сессия или назначение; LessonSessionConsumer: класс сессии; код 4403)
- [x] Стандартизация permission-проверок — **выполнено 2026-03-07** (частично: простые случаи заменены на декораторы; views с mixed GET/POST правами оставлены с inline-проверками — это намеренно)

### Долгосрочно (рефакторинг)
- [x] План рефакторинга LessonEditorPage + LessonPresenterPage → `docs/REFACTOR_LESSONS.md` — **выполнено 2026-03-06**
- [x] Декомпозиция `LessonEditorPage.tsx` — **выполнено** (3221 → 239 строк, 16 компонентов в `components/lesson-editor/`)
- [x] Декомпозиция `LessonPresenterPage.tsx` — **выполнено** (2614 → 513 строк, 8 компонентов в `components/lesson-presenter/`)
- [x] Декомпозиция `TasksPage.tsx` — **выполнено 2026-03-07** (1233 → 319 строк, 8 компонентов в `components/tasks/`; TypeScript 0 ошибок)
- [x] Общий `backend/core/` для переиспользуемых утилит — **выполнено 2026-03-07** (`core/validators.py` — MIME-валидация)
- [ ] Celery для тяжёлых операций (Excel импорт)
- [ ] TypeScript strict mode — убрать все `any`
