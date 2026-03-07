# Рефакторинг: LessonEditorPage и LessonPresenterPage

> **Тип задачи:** Декомпозиция монолитных компонентов
> **Приоритет:** Высокий (поддерживаемость)
> **Оценка:** 2–3 дня работы
> **Автор плана:** тим-лид, 2026-03-06

---

## КОНТЕКСТ И ПРОБЛЕМА

В проекте два React-компонента неприемлемого размера:

| Файл | Строк | Размер | Проблема |
|------|-------|--------|---------|
| `frontend/src/pages/LessonEditorPage.tsx` | 3 221 | 158 KB | Редактор урока — всё в одном файле |
| `frontend/src/pages/LessonPresenterPage.tsx` | 2 614 | 128 KB | Проведение урока — всё в одном файле |

**Последствия:**
- Любое изменение в одной фиче (например, викторина) требует ориентироваться в 3000 строк
- Невозможно добавить тесты: компоненты не тестируются без всего монолита
- При редактировании одного слайда React ре-рендерит весь редактор
- AI-агент при задаче "исправь баг в QuizEditor" вынужден читать 158KB кода

**Цель рефакторинга:** вынести каждый логически изолированный блок в отдельный файл. Поведение пользователя НЕ меняется ни в чём.

---

## ПРАВИЛА РЕФАКТОРИНГА (обязательно прочитать)

1. **Никакого изменения поведения.** Только перемещение кода в файлы. Никаких новых фич, никаких "улучшений" по пути.
2. **Один Pull Request на один компонент.** EditorPage и PresenterPage рефакторятся отдельно.
3. **После каждого шага** — запустить `start.bat` и проверить что редактор/презентер работает.
4. **Типы** не дублировать — они в `frontend/src/types/index.ts`. Если нужны новые — добавить туда.
5. **Стили** — только Tailwind-классы (как в оригинале), без новых CSS файлов.
6. **Экспорты** — все новые компоненты `export default`.

---

## ЧАСТЬ 1: LessonEditorPage.tsx

### Целевая структура файлов

```
frontend/src/
├── pages/
│   └── LessonEditorPage.tsx          ← оркестратор (~200 строк)
└── components/
    └── lesson-editor/
        ├── SlideCanvas.tsx            ← canvas с блоками (react-rnd, Tiptap)
        ├── SlideList.tsx              ← левая панель со списком слайдов
        ├── SlideThumb.tsx             ← миниатюра одного слайда (drag-and-drop)
        ├── TiptapToolbar.tsx          ← панель форматирования текста
        ├── ShapeToolbar.tsx           ← панель для фигур
        ├── TextBlock.tsx              ← текстовый блок на холсте
        ├── ImageBlock.tsx             ← изображение на холсте
        ├── ShapeSvg.tsx               ← SVG-рендер фигур
        ├── BgColorButton.tsx          ← кнопка цвета фона
        ├── FormEditor.tsx             ← редактор формы (опросник)
        ├── VideoEditor.tsx            ← редактор видео-слайда
        ├── QuizEditor.tsx             ← редактор викторины
        ├── VocabEditor.tsx            ← редактор словаря (слова, переводы, картинки)
        ├── VocabWordCard.tsx          ← карточка одного слова (Pixabay, TTS)
        ├── DiscussionBoard.tsx        ← WebSocket-доска обсуждений
        ├── TextbookSlideEditor.tsx    ← редактор слайда-учебника
        └── SlideTypePicker.tsx        ← (уже существует?) модаль выбора типа слайда
```

### Шаг 1.1 — Вынести TiptapToolbar и ShapeToolbar

**Что:** Компоненты-функции `TiptapToolbar` и `ShapeToolbar`, определённые внутри LessonEditorPage.tsx.

**Зависимости:**
- `TiptapToolbar` принимает: `editor: ReturnType<typeof useEditor> | null`
- `ShapeToolbar` принимает: `block: SlideBlock`, `onUpdate: (patch: Partial<SlideBlock>) => void`, `onDelete: () => void`, `onBringToFront: () => void`, `onSendToBack: () => void`

**Действие:** Вырезать определения функций → вставить в новые файлы → добавить импорт в LessonEditorPage.tsx.

**Размер:** ~80 строк каждый.

---

### Шаг 1.2 — Вынести TextBlock и ImageBlock

**Что:** Компоненты `TextBlock` (обёртка Tiptap-редактора на холсте) и `ImageBlock` (картинка с загрузкой).

**TextBlock принимает props:**
```typescript
interface TextBlockProps {
  block: SlideBlock
  scale: number
  isEditing: boolean
  onStartEdit: () => void
  onEditorReady: (editor: Editor) => void
  onUpdate: (patch: Partial<SlideBlock>) => void
}
```

**ImageBlock принимает props:**
```typescript
interface ImageBlockProps {
  block: SlideBlock
  scale: number
  lessonId: number
  onUpdate: (patch: Partial<SlideBlock>) => void
}
```

**Размер:** ~100 строк каждый.

---

### Шаг 1.3 — Вынести ShapeSvg и BgColorButton

**Что:** Функция `ShapeSvg` (SVG-рендер для типов square/circle/triangle/star/arrow-right/arrow-up) и `BgColorButton`.

**ShapeSvg принимает:**
```typescript
interface ShapeSvgProps {
  shape: ShapeType
  fill: string
  stroke: string
  strokeWidth: number
  width: number
  height: number
}
```

**Размер:** ~50 строк каждый.

---

### Шаг 1.4 — Вынести FormEditor

**Что:** Компонент `FormEditor` — редактор форм-вопросников.

**Props:**
```typescript
interface FormEditorProps {
  slide: Slide
  lessonId: number
  onSlideUpdated: (slide: Slide) => void
}
```

**Содержит:**
- state: `questions: FormQuestion[]`
- функции: `save`, `updateQ`, `addQuestion`, `deleteQuestion`, `moveQuestion`, `addOption`, `updateOption`, `deleteOption`
- JSX: список вопросов с типами (single, multiple, text, scale), кнопки управления

**Важно:** `FormQuestion` тип должен быть в `types/index.ts`. Проверить, есть ли — добавить если нет.

**Размер:** ~200 строк.

---

### Шаг 1.5 — Вынести VideoEditor

**Что:** Компонент `VideoEditor` — редактор видео-слайда (YouTube/VK/RuTube).

**Props:**
```typescript
interface VideoEditorProps {
  slide: Slide
  lessonId: number
  onSlideUpdated: (slide: Slide) => void
}
```

**Содержит:** парсинг URL видео-сервисов, embed-превью.

**Размер:** ~120 строк.

---

### Шаг 1.6 — Вынести QuizEditor

**Что:** Компонент `QuizEditor` + внутренние `QuizQuestionCard` и `QuizOptionCard`.

**Props:**
```typescript
interface QuizEditorProps {
  slide: Slide
  lessonId: number
  onSlideUpdated: (slide: Slide) => void
}
```

**Внутренние компоненты:** `QuizQuestionCard`, `QuizOptionCard` — оставить в том же файле `QuizEditor.tsx` (они используются только здесь).

**Размер:** ~250 строк.

---

### Шаг 1.7 — Вынести VocabWordCard

**Что:** Компонент `VocabWordCard` — карточка слова со сложной логикой (Pixabay API, TTS, загрузка картинки).

**Props:**
```typescript
interface VocabWordCardProps {
  word: VocabWord
  index: number
  targetLang: string
  lessonId: number
  onChange: (w: VocabWord) => void
  onDelete: () => void
}
```

**Содержит:** state для поиска картинок, перевода, загрузки файлов. Вызовы к внешним API (MyMemory, Pixabay), обращение к `/api/lessons/`.

**Важно:** VocabWordCard обращается к `api` — импортировать `api` из `../../api/client`.

**Размер:** ~200 строк.

---

### Шаг 1.8 — Вынести VocabEditor

**Что:** Компонент `VocabEditor` — редактор словарного слайда.

**Props:**
```typescript
interface VocabEditorProps {
  slide: Slide
  lessonId: number
  onSlideUpdated: (slide: Slide) => void
}
```

**Зависимость:** Импортирует `VocabWordCard` из `./VocabWordCard`.

**Размер:** ~200 строк (после выноса VocabWordCard).

---

### Шаг 1.9 — Вынести DiscussionBoard

**Что:** Компонент `DiscussionBoard` — WebSocket-доска с стикерами и стрелками.

**Props:**
```typescript
interface DiscussionBoardProps {
  slide: Slide
  isTeacher: boolean
  sessionId?: number  // если используется в режиме урока
}
```

**Содержит:** WebSocket `wsRef`, state стикеров и стрелок, рисование стрелок мышью, SVG рендер.

**Важно:** WebSocket подключается к `/ws/discussion/<slide_id>/?token=<jwt>`.
Токен брать из `localStorage.getItem('access_token')`.

**Размер:** ~250 строк.

---

### Шаг 1.10 — Вынести SlideCanvas

**Это самый сложный шаг — оставить на конец.**

**Что:** Компонент `SlideCanvas` — основной холст с react-rnd блоками, zoom, rotate, resize.

**Props:**
```typescript
interface SlideCanvasProps {
  slide: Slide
  lessonId: number
  onSlideUpdated: (slide: Slide) => void
}
```

**Содержит:**
- Весь механизм scale/zoom (ResizeObserver + Ctrl+scroll + pinch)
- Drag-and-drop блоков через react-rnd
- Кастомный resize с учётом угла поворота (`handleCustomResize` — ~70 строк)
- Ctrl+C / Ctrl+V блоков
- Debounced сохранение блоков на сервер

**Зависимости внутри SlideCanvas:**
- Импортирует `TextBlock`, `ImageBlock`, `ShapeSvg` из папки `lesson-editor/`
- Импортирует `TiptapToolbar`, `ShapeToolbar`, `BgColorButton` из той же папки
- Использует `react-rnd` и `@tiptap/react`

**Размер после выноса:** ~600 строк.

---

### Шаг 1.11 — Вынести SlideList и SlideThumb

**Что:** Левая панель `SlideList` (список слайдов) и `SlideThumb` (одна миниатюра с drag-and-drop).

**SlideList props:**
```typescript
interface SlideListProps {
  slides: Slide[]
  selectedId: number | null
  onSelect: (slide: Slide) => void
  onAdd: () => void
  onDelete: (slide: Slide) => void
  onReorder: (fromIdx: number, toIdx: number) => void
}
```

**SlideThumb props:**
```typescript
interface SlideThumbProps {
  slide: Slide
  index: number
  isSelected: boolean
  onClick: () => void
  onDelete: () => void
  onDragStart: (e: React.DragEvent, idx: number) => void
  onDragOver: (e: React.DragEvent, idx: number) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent, toIdx: number) => void
}
```

**Размер:** SlideList ~80 строк, SlideThumb ~60 строк.

---

### Итоговый LessonEditorPage.tsx (после рефакторинга)

После всех шагов `LessonEditorPage.tsx` должен выглядеть примерно так:

```typescript
// LessonEditorPage.tsx — ~150-200 строк
import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import { SlideList } from '../components/lesson-editor/SlideList'
import { SlideCanvas } from '../components/lesson-editor/SlideCanvas'
import { FormEditor } from '../components/lesson-editor/FormEditor'
import { VideoEditor } from '../components/lesson-editor/VideoEditor'
import { QuizEditor } from '../components/lesson-editor/QuizEditor'
import { VocabEditor } from '../components/lesson-editor/VocabEditor'
import { DiscussionBoard } from '../components/lesson-editor/DiscussionBoard'
import { TextbookSlideEditor } from '../components/lesson-editor/TextbookSlideEditor'
import { SlideTypePicker } from '../components/lesson-editor/SlideTypePicker'
import StartSessionDialog from '../components/StartSessionDialog'
import type { Lesson, Slide } from '../types'

export default function LessonEditorPage() {
  const { id } = useParams<{ id: string }>()
  const lessonId = Number(id)
  const { user } = useAuth()

  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [lessonTitle, setLessonTitle] = useState('')
  const [slides, setSlides] = useState<Slide[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [showTypePicker, setShowTypePicker] = useState(false)
  const [showStartDialog, setShowStartDialog] = useState(false)

  // ... загрузка урока (useEffect)
  // ... saveLessonTitle
  // ... addSlide / deleteSlide
  // ... handleSlideUpdated

  const currentSlide = slides.find(s => s.id === selectedId) ?? null

  return (
    <div className="flex flex-col h-screen">
      <header>...</header>
      <div className="flex flex-1 overflow-hidden">
        <SlideList
          slides={slides}
          selectedId={selectedId}
          onSelect={s => setSelectedId(s.id)}
          onAdd={() => setShowTypePicker(true)}
          onDelete={deleteSlide}
          onReorder={handleReorder}
        />
        <main className="flex-1">
          {currentSlide?.slide_type === 'content' && (
            <SlideCanvas slide={currentSlide} lessonId={lessonId} onSlideUpdated={handleSlideUpdated} />
          )}
          {currentSlide?.slide_type === 'form' && (
            <FormEditor slide={currentSlide} lessonId={lessonId} onSlideUpdated={handleSlideUpdated} />
          )}
          {/* ... остальные типы */}
        </main>
      </div>
      {showTypePicker && <SlideTypePicker onSelect={addSlide} onClose={() => setShowTypePicker(false)} />}
      {showStartDialog && <StartSessionDialog lessonId={lessonId} onClose={() => setShowStartDialog(false)} />}
    </div>
  )
}
```

---

## ЧАСТЬ 2: LessonPresenterPage.tsx

### Целевая структура файлов

```
frontend/src/
├── pages/
│   └── LessonPresenterPage.tsx         ← оркестратор (~250 строк)
└── components/
    └── lesson-presenter/
        ├── ContentSlideView.tsx         ← рендер content-слайда (блоки только для чтения)
        ├── FormAnswerView.tsx           ← форма для студента
        ├── FormResultsView.tsx          ← результаты формы для учителя
        ├── QuizAnswerView.tsx           ← викторина для студента
        ├── QuizPresenterView.tsx        ← управление викториной для учителя
        ├── QuizLeaderboardView.tsx      ← таблица лидеров
        ├── VideoSlideView.tsx           ← видео-слайд
        ├── VocabStudentView.tsx         ← упражнения по словам для студента
        ├── VocabTeacherView.tsx         ← прогресс класса по словам
        ├── TextbookSlideView.tsx        ← учебник с PDF и аннотациями
        ├── DiscussionView.tsx           ← обсуждение (только просмотр)
        └── SessionHeader.tsx           ← шапка сессии (навигация, таймер, end)
```

### Общий WebSocket-контракт

Все "view"-компоненты получают данные через props. Они НЕ держат WebSocket сами — WS остаётся в `LessonPresenterPage.tsx`.

Схема передачи данных:
```
LessonPresenterPage (держит wsRef, все useState)
  ↓ props
QuizAnswerView / VocabStudentView / FormAnswerView / ...
  ↓ callbacks (onAnswer, onSubmit, onVideoControl)
LessonPresenterPage (отправляет в WS или API)
```

---

### Шаг 2.1 — Вынести ContentSlideView

**Что:** Рендер контентного слайда в режиме только-для-чтения (блоки с текстом, картинками, фигурами).

**Props:**
```typescript
interface ContentSlideViewProps {
  slide: Slide
}
```

**Содержит:** масштабирование, рендер блоков через ShapeSvg (импорт из `lesson-editor/ShapeSvg`), EditorContent с `editable: false`.

**Зависимость:** Переиспользует `ShapeSvg` из `components/lesson-editor/ShapeSvg.tsx`.

**Размер:** ~100 строк.

---

### Шаг 2.2 — Вынести FormAnswerView и FormResultsView

**FormAnswerView props:**
```typescript
interface FormAnswerViewProps {
  slide: Slide
  isSubmitted: boolean
  onSubmit: (answers: FormAnswerValue[]) => void
}
```

**FormResultsView props:**
```typescript
interface FormResultsViewProps {
  slide: Slide
  results: FormResults
}
```

**Размер:** ~120 строк каждый.

---

### Шаг 2.3 — Вынести QuizAnswerView, QuizPresenterView, QuizLeaderboardView

Это три взаимосвязанных состояния одного quiz-слайда. Выносим все три в отдельные файлы.

**QuizAnswerView props:**
```typescript
interface QuizAnswerViewProps {
  slide: Slide
  currentQuestion: number       // индекс текущего вопроса
  answered: { optionIndex: number; points: number; isCorrect: boolean } | undefined
  quizStarted: boolean
  onAnswer: (slideId: number, questionIdx: number, optionIdx: number, elapsedMs: number) => void
}
```

**QuizPresenterView props:**
```typescript
interface QuizPresenterViewProps {
  slide: Slide
  currentQuestion: number
  answeredCount: number
  onStart: (slideId: number, questionIdx: number) => void
  onShowResults: (slideId: number, questionIdx: number) => void
}
```

**QuizLeaderboardView props:**
```typescript
interface QuizLeaderboardViewProps {
  slide: Slide
  currentQuestion: number
  leaderboard: QuizLeaderboardData
  isPresenter: boolean
  hasNextQuestion: boolean
  onNextQuestion: (slideId: number) => void
}
```

**Размер:** ~100-150 строк каждый.

---

### Шаг 2.4 — Вынести VideoSlideView

**Props:**
```typescript
interface VideoSlideViewProps {
  slide: Slide
  isPresenter: boolean
  videoControl: { action: string; ts: number } | null
  onControl: (action: 'play' | 'pause') => void
}
```

**Размер:** ~80 строк.

---

### Шаг 2.5 — Вынести VocabStudentView

**Это крупный компонент с собственной логикой.**

**Props:**
```typescript
interface VocabStudentViewProps {
  slide: Slide
  sessionId: number
}
```

**Содержит:**
- Построение очереди упражнений: `buildExerciseQueue(content)`
- Вспомогательные функции: `isTargetLangAnswer`, `isChoiceTask`, `isAudioTask`, `isImageTask`, `getChoiceOptions`
- Синтез речи: `vocabSpeak(text, lang)` через `window.speechSynthesis`
- state: очередь, текущий индекс, статистика выученных слов
- Финальный экран "Все слова выучены!"
- API вызов: `PUT /api/lessons/sessions/<id>/vocab-progress/` (если такой есть)

**Важно:** Весь `VocabStudentView` самодостаточен — не нуждается в данных из родителя кроме `slide` и `sessionId`.

**Размер:** ~200 строк.

---

### Шаг 2.6 — Вынести VocabTeacherView

**Props:**
```typescript
interface VocabTeacherViewProps {
  slide: Slide
  sessionId: number
}
```

**Содержит:** периодический fetch прогресса студентов через API, рендер таблицы.

**Размер:** ~120 строк.

---

### Шаг 2.7 — Вынести TextbookSlideView

**Это самый сложный компонент в LessonPresenterPage.**

**Props:**
```typescript
interface TextbookSlideViewProps {
  slide: Slide
  sessionId: number
  studentId: number
}
```

**Содержит:**
- PDF рендер через `react-pdf` (Document + Page)
- DrawingCanvas overlay (импортировать из `components/DrawingCanvas`)
- Drawing toolbar (pen, eraser, highlighter, colors)
- Zoom controls
- Page navigation
- Сохранение аннотаций через API: `PUT /api/lessons/sessions/<id>/annotations/`

**Зависимость:** `DrawingCanvas` уже существует в `components/DrawingCanvas.tsx`.

**Размер:** ~250 строк.

---

### Шаг 2.8 — Вынести SessionHeader

**Что:** Верхняя шапка сессии — навигация по слайдам, кнопки prev/next, счётчик слайдов, fullscreen, end session.

**Props:**
```typescript
interface SessionHeaderProps {
  session: LessonSession
  slides: Slide[]
  currentSlide: Slide | null
  currentIdx: number
  isPresenter: boolean
  isFullscreen: boolean
  isConnected: boolean
  onPrev: () => void
  onNext: () => void
  onToggleFullscreen: () => void
  onEndSession: () => void
}
```

**Размер:** ~80 строк.

---

### Итоговый LessonPresenterPage.tsx (после рефакторинга)

```typescript
// LessonPresenterPage.tsx — ~200-250 строк
// Содержит: state, WebSocket, переключение между компонентами

export default function LessonPresenterPage() {
  // ... весь state (session, slides, quiz state, form state, etc.)
  // ... wsRef и useEffect для WebSocket
  // ... sendWs, goToSlide, endSession, handleQuizStart, etc.

  const currentSlide = slides.find(s => s.id === currentSlideId)

  const renderSlide = () => {
    if (!currentSlide) return null
    switch (currentSlide.slide_type) {
      case 'content':
        return <ContentSlideView slide={currentSlide} />
      case 'quiz':
        if (quizLeaderboard[currentSlide.id]) {
          return <QuizLeaderboardView ... />
        }
        return isPresenter
          ? <QuizPresenterView ... />
          : <QuizAnswerView ... />
      case 'form':
        return isPresenter
          ? <FormResultsView ... />
          : <FormAnswerView ... onSubmit={handleFormSubmit} />
      case 'video':
        return <VideoSlideView ... />
      case 'vocab':
        return isPresenter
          ? <VocabTeacherView slide={currentSlide} sessionId={session.id} />
          : <VocabStudentView slide={currentSlide} sessionId={session.id} />
      case 'textbook':
        return <TextbookSlideView slide={currentSlide} sessionId={session.id} studentId={user.id} />
      case 'discussion':
        return <DiscussionView slide={currentSlide} />
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-900 flex flex-col select-none">
      <SessionHeader ... />
      <main className="flex-1 overflow-hidden">
        {renderSlide()}
      </main>
    </div>
  )
}
```

---

## ПОРЯДОК ВЫПОЛНЕНИЯ

### Рекомендуемая последовательность (от простого к сложному):

**LessonEditorPage:**
1. Шаг 1.1 → TiptapToolbar, ShapeToolbar (просто вырезать, нет сложных зависимостей)
2. Шаг 1.3 → ShapeSvg, BgColorButton
3. Шаг 1.2 → TextBlock, ImageBlock
4. Шаг 1.5 → VideoEditor
5. Шаг 1.4 → FormEditor
6. Шаг 1.6 → QuizEditor
7. Шаг 1.7 → VocabWordCard
8. Шаг 1.8 → VocabEditor
9. Шаг 1.9 → DiscussionBoard
10. Шаг 1.11 → SlideList, SlideThumb
11. Шаг 1.10 → SlideCanvas (самый сложный — напоследок)

**LessonPresenterPage:**
1. Шаг 2.1 → ContentSlideView
2. Шаг 2.4 → VideoSlideView
3. Шаг 2.2 → FormAnswerView, FormResultsView
4. Шаг 2.3 → QuizAnswerView, QuizPresenterView, QuizLeaderboardView
5. Шаг 2.6 → VocabTeacherView
6. Шаг 2.5 → VocabStudentView
7. Шаг 2.7 → TextbookSlideView
8. Шаг 2.8 → SessionHeader

---

## ЧЕКЛИСТ ДЛЯ AI-АГЕНТА

Перед началом работы:
- [ ] Прочитать `DOCS.md` и `docs/FRONTEND.md`
- [ ] Убедиться что оба файла компилируются: `cd frontend && npx tsc --noEmit`
- [ ] Запомнить: изменение поведения запрещено, только перемещение кода

После каждого шага:
- [ ] `npx tsc --noEmit` — нет ошибок типов
- [ ] Проверить в браузере что страница открывается

После завершения:
- [ ] Оба больших файла < 300 строк
- [ ] Все новые файлы в правильных папках
- [ ] Обновить `docs/FRONTEND.md` (раздел "Компоненты")

---

## ИЗВЕСТНЫЕ ПОДВОДНЫЕ КАМНИ

### 1. `useEditor` и `activeEditor`
В `SlideCanvas` есть `activeEditor: ReturnType<typeof useEditor> | null` — ссылка на Tiptap-редактор активного блока. Она передаётся в `TiptapToolbar`. При выносе компонентов нужно убедиться, что эта ссылка правильно прокидывается через props.

### 2. Импорт Tiptap
```typescript
// ПРАВИЛЬНО (v3):
import { TextStyle, Color, FontSize } from '@tiptap/extension-text-style'
// НЕ default export!
```

### 3. `react-rnd` и кастомный resize
Функция `handleCustomResize` (~70 строк) реализует resize с учётом угла поворота. Это математически нетривиальный код — НЕ упрощать, перенести без изменений.

### 4. WebSocket токен
```typescript
const token = localStorage.getItem('access_token')
const ws = new WebSocket(`/ws/discussion/${slide.id}/?token=${token}`)
```

### 5. Debounced save
В нескольких редакторах есть `saveTimer = useRef<ReturnType<typeof setTimeout>>()` для отложенного сохранения (400мс). Не потерять `clearTimeout` при unmount.

### 6. Типы форм и викторин
Убедиться что в `types/index.ts` есть:
- `FormQuestion`, `FormAnswerValue`, `FormResults`
- `QuizQuestion`, `QuizLeaderboardData`, `QuizLeaderboardEntry`
- `VocabContent`, `VocabWord`, `VocabExercise`
- `AnnotationStroke`, `TextbookSlideContent`

Если чего-то нет — добавить перед началом рефакторинга.
