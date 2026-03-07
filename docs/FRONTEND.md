# WunderOnline — Фронтенд

> React 19 + TypeScript + Vite 6 + Tailwind CSS 4 + React Router 7

---

## Маршрутизация (App.tsx)

| Маршрут | Компонент | Доступ | Описание |
|---------|-----------|--------|---------|
| `/` | `DashboardPage` | all | Главная / дашборд |
| `/login` | `LoginPage` | anon | Вход |
| `/change-password` | `ChangePasswordPage` | must_change | Принудительная смена пароля |
| `/account` | `AccountPage` | all | Настройки аккаунта |
| `/schedule` | `SchedulePage` | all | Расписание |
| `/ktp` | `KTPListPage` | teacher | Список КТП |
| `/ktp/:id` | `KTPDetailPage` | teacher | Редактор КТП |
| `/people` → `/school` | Redirect | admin | Перенаправление |
| `/school` | `SchoolPage` | admin/teacher | Управление школой |
| `/school/students` | `SchoolPage` (tab) | admin | Вкладка учеников |
| `/school/staff` | `SchoolPage` (tab) | admin | Вкладка персонала |
| `/tasks` | `TasksPage` | all | Таск-менеджер |
| `/requests` | `RequestsPage` | all | Заявки (АХО / ИТ) |
| `/lessons` | `LessonsPage` | teacher | Библиотека уроков |
| `/lessons/:id/edit` | `LessonEditorPage` | teacher | Canvas-редактор урока |
| `/lessons/:id/present` | `LessonPresenterPage` | teacher | Интерактивный показ |
| `/lessons/:id/view` | `SelfPacedLessonPage` | student/parent | Самостоятельное прохождение |
| `/chats` | `ChatsPage` | all | Мессенджер |
| `/chats/:id` | `ChatsPage` (open) | member | Конкретный чат |
| `/projects` | `ProjectsPage` | all | Проекты |
| `/projects/:id` | `ProjectDetailPage` | member | Детали проекта |
| `/curator/:studentId` | `CuratorReportPage` | curator | Отчёт куратора |
| `/settings` | `SettingsPage` | admin | Настройки (куратор) |
| `/yellow-list` | `YellowListPage` | spps/staff | Жёлтый список |
| `/news` | `NewsPage` | all | Новости |

---

## Страницы

### Малые страницы (< 10KB)

| Файл | Описание |
|------|---------|
| `LoginPage.tsx` (2.7KB) | Форма входа (first_name, last_name, password) |
| `ChangePasswordPage.tsx` (2.8KB) | Принудительная смена пароля |
| `AccountPage.tsx` (7.5KB) | Смена пароля + телефон |
| `RequestsPage.tsx` (5.5KB) | АХО-заявка + ИТ-заглушка |
| `CuratorReportPage.tsx` (2KB) | Таблица отчёта куратора |
| `SchoolPage.tsx` (2.4KB) | Обёртка для вкладок StaffTab/StudentsTab |
| `SettingsPage.tsx` (121B) | Настройки кураторских полей |

### Средние страницы (10-40KB)

| Файл | Размер | Описание |
|------|--------|---------|
| `KTPListPage.tsx` | 11KB | Список КТП, фильтры по классу/предмету |
| `SchedulePage.tsx` | 18KB | Расписание неделя/день + замены |
| `ProjectsPage.tsx` | 7.9KB | Список проектов (карточки) |
| `ProjectDetailPage.tsx` | 13KB | Задания проекта + лента + сдача |
| `SelfPacedLessonPage.tsx` | 25KB | Самостоятельный режим урока |
| `YellowListPage.tsx` | 23KB | Жёлтый список (двухпанельный layout) |
| `ChatsPage.tsx` | 25KB | Мессенджер + WebSocket |
| `DashboardPage.tsx` | 30KB | Дашборд (темы на день / ссылки учителя) |
| `NewsPage.tsx` | 32KB | Лента новостей + Tiptap-редактор |
| `KTPDetailPage.tsx` | 33KB | Редактор КТП (drag-drop тем, файлы) |

### Большие страницы (ТРЕБУЮТ РЕФАКТОРИНГА)

| Файл | Размер | Проблема |
|------|--------|---------|
| `TasksPage.tsx` | 58KB | Канбан + множество состояний |
| `LessonsPage.tsx` | 66KB | Библиотека с папками |

### Рефакторированные страницы

| Файл | До | После | Компоненты |
|------|-----|-------|-----------|
| `LessonEditorPage.tsx` | 158KB (3221 стр.) | ~6KB (239 стр.) | `lesson-editor/` |
| `LessonPresenterPage.tsx` | 128KB (2614 стр.) | ~13KB (513 стр.) | `lesson-presenter/` |

---

## Компоненты

```
frontend/src/components/
├── Layout.tsx              # Обёртка с сайдбаром + хедером
├── DrawingCanvas.tsx       # SVG-холст для рисования (учебник)
├── StartSessionDialog.tsx  # Диалог запуска сессии
├── chat/
│   ├── MessageBubble.tsx
│   ├── PollDisplay.tsx
│   └── TaskTakeButton.tsx
├── curator/
│   └── CuratorTable.tsx
├── groups/
│   └── GroupSelector.tsx
├── lesson-editor/          # Компоненты редактора уроков
│   ├── SlideCanvas.tsx         # Canvas с блоками (react-rnd + Tiptap); export emptyContent()
│   ├── SlideThumb.tsx          # Миниатюра слайда в сайдбаре
│   ├── SlideTypePicker.tsx     # Модал выбора типа слайда
│   ├── DiscussionBoard.tsx     # Доска обсуждений (стикеры + стрелки + WS)
│   ├── TextbookSlideEditor.tsx # Редактор учебника (react-pdf)
│   ├── FormEditor.tsx          # Редактор формы
│   ├── QuizEditor.tsx          # Редактор викторины
│   ├── VideoEditor.tsx         # Редактор видео
│   ├── VocabEditor.tsx         # Редактор словаря
│   ├── VocabWordCard.tsx       # Карточка слова
│   ├── TiptapToolbar.tsx       # Тулбар Tiptap-редактора
│   ├── TextBlock.tsx           # Текстовый блок
│   ├── ImageBlock.tsx          # Блок изображения
│   ├── BgColorButton.tsx       # Кнопка фона слайда
│   ├── ShapeSvg.tsx            # SVG-фигуры (редактор)
│   └── ShapeToolbar.tsx        # Тулбар фигур
├── lesson-presenter/       # Компоненты показа урока
│   ├── SlideView.tsx           # Оркестратор: выбирает нужный вид по slide_type
│   ├── QuizViews.tsx           # QuizAnswerView, QuizPresenterView, QuizLeaderboardView
│   ├── FormViews.tsx           # FormAnswerView, FormResultsView
│   ├── VideoSlideView.tsx      # Видео-слайд (YouTube и др.)
│   ├── DiscussionSlideView.tsx # Доска обсуждений (просмотр)
│   ├── TextbookSlideView.tsx   # Учебник (react-pdf + DrawingCanvas)
│   ├── VocabStudentView.tsx    # Словарь: режим ученика
│   └── VocabTeacherView.tsx    # Словарь: режим учителя
├── projects/
│   ├── AssignmentCard.tsx
│   └── SubmissionView.tsx
├── schedule/
│   ├── WeekView.tsx
│   └── DayView.tsx
└── school/
    ├── StaffTab.tsx
    └── StudentsTab.tsx
```

---

## Контексты и хуки

### AuthContext (`contexts/AuthContext.tsx`)

Состояние:
```typescript
{
  user: User | null,
  loading: boolean,
  login(firstName, lastName, password): Promise<void>,
  logout(): void,
  updateUser(data: Partial<User>): void,
}
```

Логика:
- При старте: читает `accessToken` из localStorage → `/auth/me/`
- Токены хранятся в `localStorage` (`accessToken`, `refreshToken`)
- 401 → auto-refresh через `refreshToken` → повторный запрос
- Если refresh тоже 401 → logout

---

## API-клиент (`api/client.ts`)

```typescript
import axios from 'axios'
const api = axios.create({ baseURL: '/api' })

// Request interceptor: добавляет Authorization: Bearer <token>
// Response interceptor: при 401 обновляет токен или разлогинивает
```

**Использование в компонентах:**
```typescript
import api from '../api/client'

// GET запрос
const { data } = await api.get('/lessons/')

// POST с данными
const { data } = await api.post('/tasks/', { title, description })

// Файлы
const form = new FormData()
form.append('file', file)
await api.post('/tasks/1/files/', form)
```

---

## Типы (`types/index.ts`)

Все TypeScript-интерфейсы всех сущностей. Примеры:

```typescript
interface User {
  id: number
  first_name: string
  last_name: string
  email: string
  phone: string
  is_admin: boolean
  is_teacher: boolean
  is_parent: boolean
  is_student: boolean
  is_spps: boolean
  must_change_password: boolean
  student_profile?: StudentProfile
  parent_profile?: ParentProfile
}

interface Lesson {
  id: number
  title: string
  description: string
  owner: number
  folder: number | null
  is_public: boolean
  cover_color: string
  slides: Slide[]
}

interface Slide {
  id: number
  lesson: number
  order: number
  slide_type: 'content' | 'form' | 'quiz' | 'video' | 'discussion' | 'vocab' | 'textbook' | 'selfpaced' | 'annotation' | 'matching'
  title: string
  content: Record<string, unknown>
}
```

**Правило:** при добавлении нового поля в Django-модель — добавить в соответствующий интерфейс здесь.

---

## Tiptap-редактор

Используется в: **NewsPage** (контент новости), **KTPDetailPage** (описание темы)

Установленные расширения:
- `@tiptap/starter-kit` — Bold, Italic, Strike, Lists
- `@tiptap/extension-underline` — Underline
- `@tiptap/extension-text-style` (v3) — TextStyle, Color, FontSize (именованные экспорты, НЕ default)
- `@tiptap/extension-image` — Вставка изображений с обтеканием
- `@emoji-mart/react` — Emoji picker

**Важно:** `TextStyle`, `Color`, `FontSize` импортируются как named exports:
```typescript
import { TextStyle, Color, FontSize } from '@tiptap/extension-text-style'
```

Хелпер для стилей изображений:
```typescript
// setStyleProp — устанавливает отдельный CSS-property не затирая остальные
editor.chain().focus().setStyleProp('float', 'left').run()
```

---

## Canvas-редактор уроков

Используется в: **LessonEditorPage**

Библиотеки:
- `react-rnd` — drag-resize блоков
- `@tiptap/react` — текст внутри блоков

Типы блоков: `text` / `image` / `shape`

Особенности:
- Вращение блоков (угол в состоянии)
- Resize с учётом угла поворота
- Ctrl+C / Ctrl+V — копирование блоков

---

## WebSocket в компонентах

Подключение с токеном:
```typescript
const token = localStorage.getItem('accessToken')
const ws = new WebSocket(`/ws/chat/${roomId}/?token=${token}`)

ws.onmessage = (event) => {
  const data = JSON.parse(event.data)
  // обработка
}
```

---

## Sidebar — счётчики уведомлений

| Раздел | Счётчик | Когда |
|--------|---------|-------|
| Жёлтый список | Жёлтый бейдж | Только для is_spps |
| Новости | Синяя точка | Для всех, при непрочитанных |

Сброс счётчика новостей через `CustomEvent`:
```typescript
window.dispatchEvent(new CustomEvent('news:read'))
```

---

## Сборка и деплой

```bash
cd frontend
npm install
npm run build    # → dist/
```

Артефакты в `frontend/dist/` — раздаются через Nginx в production.
