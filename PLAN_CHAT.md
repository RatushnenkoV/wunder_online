# План: Мессенджер (Чаты)

> Переименовать `/groups` → `/chats`. Полноценный мессенджер с групповыми и личными чатами,
> файлами, emoji. Все данные хранятся в своей БД, никаких SaaS-сервисов.

---

## Статус

- [x] Архитектура спроектирована
- [x] Фаза 1: Бэкенд — модели и миграции
- [x] Фаза 2: Бэкенд — WebSocket consumer
- [x] Фаза 3: Бэкенд — REST API и права доступа
- [x] Фаза 4: Фронтенд — установка библиотек
- [x] Фаза 5: Фронтенд — ChatsPage и список чатов
- [x] Фаза 6: Фронтенд — окно чата (сообщения, emoji, файлы)
- [x] Фаза 7: Фронтенд — создание групп и управление участниками
- [x] Фаза 8: Фронтенд — личные сообщения (новый DM)
- [x] Фаза 9: Сайдбар — переименовать пункт + бейдж непрочитанных
- [x] Фаза 10: DOCS.md — обновить документацию

---

## Модель прав доступа

| Кто | Групповые чаты | Личные сообщения (DM) |
|-----|----------------|----------------------|
| Admin | Создаёт, читает, пишет везде | Кому угодно |
| Teacher | Самостоятельно вступает в группы созданные admin | Учителям, студентам, admin |
| Student | Только куда назначит admin | Только своим учителям + куратору класса |
| Parent | Недоступно | Только куратору(ам) своих детей |

**Студенты не могут общаться друг с другом** (ни в DM, ни в группах вместе без учителя).

---

## Архитектура данных

### Новые модели (заменяют весь `backend/groups/`)

```python
ChatRoom
  room_type: 'group' | 'direct'
  name: str           # только для group
  created_by -> User (null для direct)
  is_archived: bool (default False)
  created_at: datetime

ChatMember
  room -> ChatRoom
  user -> User
  role: 'admin' | 'member'   # admin = может управлять участниками
  last_read_at: datetime (null)
  joined_at: datetime
  # unique_together: [room, user]

ChatMessage
  room -> ChatRoom
  sender -> User (null = system message)
  text: str (blank)
  reply_to -> ChatMessage (null, self-ref)
  created_at: datetime
  updated_at: datetime
  is_deleted: bool (default False)

MessageAttachment
  message -> ChatMessage
  file: FileField  # upload_to='chat_files/%Y/%m/'
  original_name: str
  file_size: int
  mime_type: str
```

### Вычисляемые поля (в сериализаторе)

- `ChatRoom.last_message` — последнее сообщение (текст + sender + время)
- `ChatRoom.unread_count` — кол-во сообщений новее `ChatMember.last_read_at`
- `ChatRoom.other_user` — для DM: второй участник (имя + инициалы)

---

## Фаза 1: Бэкенд — модели и миграции

**Файлы к изменению:**
- Удалить `backend/groups/migrations/0001_initial.py`
- Удалить `backend/groups/migrations/0002_*.py`
- Переписать `backend/groups/models.py` — новые 4 модели

**Шаги:**
1. Переписать `models.py` с моделями `ChatRoom`, `ChatMember`, `ChatMessage`, `MessageAttachment`
2. Удалить старые миграции
3. Создать новую миграцию: `python manage.py makemigrations groups`
4. Применить: `python manage.py migrate`

> ⚠️ Данные существующих групп/сообщений будут потеряны — это ожидаемо, сносим всё.

---

## Фаза 2: Бэкенд — WebSocket consumer

**Файл:** `backend/groups/consumers.py`

**Переписать `ChatConsumer`:**

Протокол (client → server):
```json
{ "type": "send_message", "text": "...", "reply_to": null }
{ "type": "mark_read" }
{ "type": "typing" }
```

Протокол (server → client):
```json
{ "type": "message_new", "message": { ...ChatMessageData } }
{ "type": "message_deleted", "message_id": 123 }
{ "type": "user_typing", "user_id": 5, "display_name": "Иван И." }
{ "type": "room_read", "user_id": 5, "last_read_at": "..." }
```

**Логика `connect()`:**
- Проверить JWT (уже есть middleware)
- Проверить что user является `ChatMember` данной комнаты

**WebSocket URL:** `ws://.../ws/chat/<room_id>/?token=<jwt>`

---

## Фаза 3: Бэкенд — REST API и права

**Файл:** `backend/groups/views.py`, `backend/groups/urls.py`

### Эндпоинты

```
GET  /api/chat/rooms/                    — мои комнаты (с last_message, unread_count)
POST /api/chat/rooms/                    — создать группу (только admin)
GET  /api/chat/rooms/<id>/               — детали комнаты
DELETE /api/chat/rooms/<id>/             — удалить (только admin)

GET  /api/chat/rooms/<id>/messages/      — история (?before=<msg_id>&limit=50)
POST /api/chat/rooms/<id>/messages/      — отправить (только если нет WS)
DELETE /api/chat/rooms/<id>/messages/<msg_id>/  — удалить (soft, только свои или admin)

POST /api/chat/rooms/<id>/files/         — загрузить файл → создаёт сообщение
POST /api/chat/rooms/<id>/read/          — отметить прочитанным (обновить last_read_at)

GET  /api/chat/rooms/<id>/members/       — список участников
POST /api/chat/rooms/<id>/members/       — добавить участника (admin или teacher для себя)
DELETE /api/chat/rooms/<id>/members/<uid>/  — удалить участника (admin)

GET  /api/chat/users/                    — список пользователей доступных для DM (с учётом прав)
POST /api/chat/direct/                   — открыть/найти DM с пользователем → возвращает room_id
```

### Функция проверки прав на DM

```python
# backend/groups/permissions.py
def can_start_direct(me, them):
    if me.is_admin:
        return True
    if me.is_teacher:
        return them.is_teacher or them.is_admin or them.is_student
    if me.is_student:
        my_class = me.student_profile.school_class
        teachers = User.objects.filter(
            schedule_lessons__school_class=my_class
        ).distinct()
        curator = my_class.curator if my_class else None
        return them in teachers or them == curator
    if me.is_parent:
        curators = User.objects.filter(
            curated_classes__students__user__parent_profiles__user=me
        ).distinct()
        return them in curators
    return False
```

### Логика `GET /api/chat/users/` (доступные для DM)

- Admin → все пользователи
- Teacher → все учителя + все студенты + admins
- Student → учителя своих предметов + куратор класса
- Parent → кураторы своих детей (может быть 1-2 человека)

---

## Фаза 4: Фронтенд — установка библиотек

```bash
cd frontend
npm install @chatscope/chat-ui-kit-react @chatscope/chat-ui-kit-styles
npm install emoji-mart @emoji-mart/react @emoji-mart/data
```

**Импорт стилей** в `main.tsx`:
```ts
import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css';
```

---

## Фаза 5: Фронтенд — ChatsPage и список чатов

**Файл:** `frontend/src/pages/ChatsPage.tsx` (переименовать из GroupsPage.tsx)

**Структура страницы:**
```
┌─────────────────────────────────────────────────────────┐
│  [🔍 Поиск]           [+ Новый чат ▾]                  │
├──────────────┬──────────────────────────────────────────┤
│              │                                          │
│  Список чатов│  Окно активного чата                    │
│  (GroupChat  │  (ChatWindow компонент)                  │
│   из @chat   │                                          │
│   scope)     │                                          │
│              │                                          │
└──────────────┴──────────────────────────────────────────┘
```

**Компоненты из @chatscope:**
- `<MainContainer>` — общий wrapper
- `<Sidebar>` — панель со списком
- `<ConversationList>` — список чатов
- `<Conversation>` — элемент списка (аватар, имя, last_message, unread badge)
- `<ChatContainer>` — область чата

**Логика списка:**
- Загрузить `GET /api/chat/rooms/` при mount
- Отсортировать по `last_message.created_at` (новые сверху)
- Показать бейдж `unread_count > 0`
- Кнопка "+ Новый чат": выпадашка "Создать группу" / "Личное сообщение"

---

## Фаза 6: Фронтенд — окно чата

**Файл:** `frontend/src/components/chat/ChatWindow.tsx`

**Компоненты из @chatscope:**
- `<MessageList>` — прокручиваемый список
- `<Message>` — пузырь сообщения (свои справа, чужие слева)
- `<MessageInput>` — поле ввода
- `<Avatar>` — инициалы пользователя

**Дополнительная логика:**
- WebSocket подключение при смене активного чата (аналог текущего GroupChat.tsx)
- Пагинация: `IntersectionObserver` в начале списка → загружать `?before=<first_id>`
- Файлы: кнопка скрепки → `<input type="file">` → POST на `/api/chat/rooms/<id>/files/`
- Emoji: кнопка 😊 → попап `<Picker>` из `emoji-mart` → вставить в MessageInput

**Отображение вложений:**
- Изображения (image/*) — inline превью
- Остальные файлы — иконка + имя + размер + кнопка скачать

**Отметка прочитанного:**
- POST `/api/chat/rooms/<id>/read/` при открытии чата и при получении нового сообщения (если чат активен)
- Обновить `unread_count` в списке на 0

---

## Фаза 7: Фронтенд — создание группы и участники

**Файлы:**
- `frontend/src/components/chat/CreateGroupModal.tsx`
- `frontend/src/components/chat/ChatMembersPanel.tsx`

**CreateGroupModal:**
- Поле "Название группы"
- Мультиселект участников (только учителя + admin, т.к. студентов admin добавляет отдельно)
- POST `/api/chat/rooms/`

**ChatMembersPanel (боковая панель):**
- Список участников с аватарами
- Кнопка "Добавить" (для admin)
- Кнопка "Покинуть группу" (для teacher)
- Удаление участника (только admin)

---

## Фаза 8: Фронтенд — личные сообщения

**Файл:** `frontend/src/components/chat/NewDirectModal.tsx`

**Логика:**
1. GET `/api/chat/users/` — список доступных для DM (бэкенд фильтрует по правам)
2. Поиск по имени
3. При выборе → POST `/api/chat/direct/` → получить `room_id`
4. Если комната уже существует — вернуть существующую (idempotent)
5. Открыть чат

---

## Фаза 9: Сайдбар

**Файл:** `frontend/src/components/Layout.tsx`

**Изменения:**
- Переименовать пункт "Группы" → "Чаты"
- Обновить иконку (💬 или speech-bubble)
- Добавить бейдж с суммарным `unread_count` (аналог бейджа задач)
- Бейдж обновляется при навигации (GET `/api/chat/rooms/` → sum of unread_count)

---

## Фаза 10: Документация

- Обновить `DOCS.md`:
  - Маршрут `/groups` → `/chats`
  - Новые модели `ChatRoom`, `ChatMember`, `ChatMessage`, `MessageAttachment`
  - Все API эндпоинты
  - WS протокол
  - Таблица прав доступа
- Обновить `MEMORY.md` в `.claude/projects/`

---

## Технические заметки

### Маршрут
- URL остаётся `/groups` или меняется на `/chats`? → **Менять на `/chats`**
- Обновить `App.tsx` и `Layout.tsx`

### WS routing
- Текущий: `ws/groups/<group_id>/` (в `groups/routing.py`)
- Новый: `ws/chat/<room_id>/` — прямое переименование

### `config/routing.py` (ASGI)
- Проверить что новый путь добавлен в `application`

### Сериализатор unread_count
```python
def get_unread_count(self, obj):
    request = self.context.get('request')
    if not request:
        return 0
    member = obj.members_rel.filter(user=request.user).first()
    if not member or not member.last_read_at:
        return obj.messages.filter(is_deleted=False).count()
    return obj.messages.filter(
        created_at__gt=member.last_read_at,
        is_deleted=False
    ).exclude(sender=request.user).count()
```

---

## Порядок выполнения (рекомендуемый)

```
Фаза 1 → Фаза 2 → Фаза 3   (бэкенд целиком)
    ↓
Фаза 4                       (npm install)
    ↓
Фаза 5 → Фаза 6             (основной UI)
    ↓
Фаза 7 → Фаза 8             (дополнительный UI)
    ↓
Фаза 9 → Фаза 10            (интеграция + документация)
```

Каждая фаза — отдельная рабочая сессия. Бэкенд можно тестировать через curl/DRF browser до фронтенда.
