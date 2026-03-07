# Рефакторинг: TasksPage.tsx

> **Тип задачи:** Декомпозиция монолитного компонента
> **Приоритет:** Высокий (поддерживаемость)
> **Оценка:** 4–6 часов работы
> **Автор плана:** тим-лид, 2026-03-07

---

## 1. КОНТЕКСТ И ПРОБЛЕМА

### Текущее состояние

| Файл | Строк | Размер | Проблема |
|------|-------|--------|---------|
| `frontend/src/pages/TasksPage.tsx` | 1 233 | ~58 KB | Вся логика Канбана, таблицы выполненных, групп и двух модалей — в одном файле |

### Что именно находится в файле

Файл содержит 7 логически отдельных сущностей, склеенных в один монолит:

1. **Константы и утилиты** (строки 1–73) — `COLUMNS`, `DONE_COL`, `StaffUser`, `linkify()`, `getTransitions()`, `canDropTo()`
2. **FileIcon** (строки 76–82) — иконка вложения, используется в 4 местах
3. **CreateTaskModal** (строки 86–239) — модал создания задачи с загрузкой файлов
4. **ReassignModal** (строки 243–322) — модал переназначения задачи
5. **GroupsTab** (строки 326–461) — вкладка управления группами (создание, удаление, управление участниками)
6. **TaskCard** (строки 465–688) — карточка задачи в Канбан-колонке (раскрытие, переходы статуса, файлы)
7. **DoneTable** (строки 692–925) — таблица выполненных задач с сортировкой и фильтрами
8. **TasksPage** (строки 929–1233) — главная страница-оркестратор

### Последствия монолита

- Любое изменение в карточке задачи требует ориентации в 1233 строках
- `DoneTable` и `TaskCard` имеют почти идентичную логику работы с файлами — она дублирована
- AI-агент при задаче "добавь поле в форму создания" читает весь 58KB файл
- Невозможно изолированно протестировать отдельные компоненты

### Цель рефакторинга

Вынести каждый логически изолированный блок в отдельный файл. **Поведение пользователя не меняется ни в чём.**

---

## 2. ПРАВИЛА РЕФАКТОРИНГА

1. **Никакого изменения поведения.** Только перемещение кода между файлами. Никаких новых фич, никаких "улучшений", никакого переименования переменных.
2. **После каждого шага** — убедиться, что TypeScript компилируется без ошибок.
3. **Типы не дублировать.** Все типы уже есть в `frontend/src/types/index.ts`. Единственный новый тип — `StaffUser`, который нужно добавить туда.
4. **Стили — только Tailwind-классы** (как в оригинале). Никаких новых CSS-файлов.
5. **Экспорты:** компоненты — `export default`, утилиты/константы — именованный экспорт.
6. **Порядок выполнения строго соблюдать** — от листовых к оркестратору.

---

## 3. ЦЕЛЕВАЯ СТРУКТУРА ФАЙЛОВ

```
frontend/src/
├── pages/
│   └── TasksPage.tsx                  ← оркестратор (~120 строк после рефакторинга)
├── types/
│   └── index.ts                       ← добавить StaffUser (~4 строки)
└── components/
    └── tasks/
        ├── constants.ts               ← COLUMNS, DONE_COL (15 строк)
        ├── utils.tsx                  ← linkify, getTransitions, canDropTo (45 строк)
        ├── FileIcon.tsx               ← SVG-иконка вложения (10 строк)
        ├── CreateTaskModal.tsx        ← модал создания задачи (155 строк)
        ├── ReassignModal.tsx          ← модал переназначения (80 строк)
        ├── TaskCard.tsx               ← карточка Канбан (225 строк)
        ├── DoneTable.tsx              ← таблица выполненных (230 строк)
        └── GroupsTab.tsx              ← вкладка групп (135 строк)
```

Итого: 9 новых файлов. Главная страница сокращается с 1233 до ~120 строк.

---

## 4. ОПИСАНИЕ КАЖДОГО НОВОГО ФАЙЛА

### 4.1 `frontend/src/types/index.ts` — добавить `StaffUser`

Тип `StaffUser` определён локально в `TasksPage.tsx` на строке 23. Перенести в глобальные типы.

**Откуда взять:** строка 23 оригинала:
```typescript
type StaffUser = { id: number; first_name: string; last_name: string };
```

**Действие:** Добавить в `frontend/src/types/index.ts` в блок Tasks:
```typescript
export type StaffUser = { id: number; first_name: string; last_name: string };
```

---

### 4.2 `frontend/src/components/tasks/constants.ts`

**Откуда взять:** строки 9–21 оригинала.

```typescript
import type { TaskStatus } from '../../types';

export const COLUMNS: {
  status: TaskStatus;
  label: string;
  colorBg: string;
  colorBorder: string;
  colorDrag: string;
}[] = [
  { status: 'new',         label: 'Поставленные', colorBg: 'bg-blue-50',   colorBorder: 'border-blue-200',   colorDrag: 'ring-2 ring-blue-400 bg-blue-100' },
  { status: 'in_progress', label: 'В работе',      colorBg: 'bg-amber-50',  colorBorder: 'border-amber-200',  colorDrag: 'ring-2 ring-amber-400 bg-amber-100' },
  { status: 'review',      label: 'На проверке',   colorBg: 'bg-purple-50', colorBorder: 'border-purple-200', colorDrag: 'ring-2 ring-purple-400 bg-purple-100' },
];

export const DONE_COL = {
  status: 'done' as TaskStatus,
  label: 'Выполнено',
  colorBg: 'bg-green-50',
  colorBorder: 'border-green-200',
  colorDrag: '',
};
```

---

### 4.3 `frontend/src/components/tasks/utils.tsx`

**Откуда взять:** строки 27–72 оригинала. Расширение `.tsx` (не `.ts`) — функция `linkify` возвращает JSX!

**Зависимости:**
```typescript
import type { Task, TaskStatus } from '../../types';
```

Содержит точные копии трёх функций: `linkify`, `getTransitions`, `canDropTo`.

---

### 4.4 `frontend/src/components/tasks/FileIcon.tsx`

**Откуда взять:** строки 76–82 оригинала. Нет props, нет зависимостей.

```typescript
export default function FileIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="..." />
    </svg>
  );
}
```

---

### 4.5 `frontend/src/components/tasks/CreateTaskModal.tsx`

**Откуда взять:** строки 86–239 оригинала.

**Props-интерфейс:**
```typescript
interface CreateTaskModalProps {
  groups: TaskGroup[];
  staffList: StaffUser[];
  onClose: () => void;
  onCreated: (task: Task) => void;
}
```

**Импорты:**
```typescript
import { useState, useRef } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import api from '../../api/client';
import type { Task, TaskGroup, StaffUser } from '../../types';
import FileIcon from './FileIcon';
```

---

### 4.6 `frontend/src/components/tasks/ReassignModal.tsx`

**Откуда взять:** строки 243–322 оригинала.

**Props-интерфейс:**
```typescript
interface ReassignModalProps {
  task: Task;
  groups: TaskGroup[];
  staffList: StaffUser[];
  onClose: () => void;
  onReassigned: (updated: Task) => void;
}
```

**Импорты:**
```typescript
import { useState } from 'react';
import type { FormEvent } from 'react';
import api from '../../api/client';
import type { Task, TaskGroup, StaffUser } from '../../types';
```

---

### 4.7 `frontend/src/components/tasks/GroupsTab.tsx`

**Откуда взять:** строки 326–461 оригинала.

**Props-интерфейс:**
```typescript
interface GroupsTabProps {
  groups: TaskGroup[];
  staffList: StaffUser[];
  isAdmin: boolean;
  onGroupsChange: () => void;
}
```

**Импорты:**
```typescript
import { useState } from 'react';
import type { FormEvent } from 'react';
import api from '../../api/client';
import type { TaskGroup, StaffUser } from '../../types';
```

---

### 4.8 `frontend/src/components/tasks/TaskCard.tsx`

**Откуда взять:** строки 465–688 оригинала.

**Props-интерфейс:**
```typescript
interface TaskCardProps {
  task: Task;
  onStatusChange: (task: Task, to: TaskStatus, comment?: string) => void;
  onDelete: (task: Task) => void;
  onReassign: (task: Task) => void;
  onTaskUpdate: (task: Task) => void;
  onDragStart: (taskId: number) => void;
  onHide?: () => void;
}
```

**Импорты:**
```typescript
import { useState, useRef } from 'react';
import type { ChangeEvent } from 'react';
import api from '../../api/client';
import type { Task, TaskStatus } from '../../types';
import FileIcon from './FileIcon';
import { getTransitions, linkify } from './utils';
```

---

### 4.9 `frontend/src/components/tasks/DoneTable.tsx`

**Откуда взять:** строки 692–925 оригинала (включая `type SortField`, `type SortDir`, `function fmt`, `const SortIcon`).

**Props-интерфейс:**
```typescript
interface DoneTableProps {
  tasks: Task[];
  onDelete: (task: Task) => void;
  onTaskUpdate: (task: Task) => void;
}
```

**Импорты:**
```typescript
import { useState, useRef } from 'react';
import type { ChangeEvent } from 'react';
import api from '../../api/client';
import type { Task } from '../../types';
import FileIcon from './FileIcon';
import { linkify } from './utils';
```

**Внутренние типы (определить локально):**
```typescript
type SortField = 'title' | 'created_by_name' | 'created_at' | 'taken_by_name' | 'completed_at';
type SortDir = 'asc' | 'desc';
```

---

## 5. ПОРЯДОК ВЫПОЛНЕНИЯ

### Шаг 1 — Добавить `StaffUser` в types/index.ts

Добавить в блок Tasks:
```typescript
export type StaffUser = { id: number; first_name: string; last_name: string };
```
Пока НЕ удалять строку 23 из `TasksPage.tsx`.

---

### Шаг 2 — Создать `constants.ts` и `utils.tsx`

Создать папку `frontend/src/components/tasks/`.

- **constants.ts** — строки 9–21 оригинала + импорт `TaskStatus`
- **utils.tsx** (расширение `.tsx`!) — строки 27–72 оригинала + импорты `Task`, `TaskStatus`

TasksPage.tsx на этом шаге не меняется.

---

### Шаг 3 — Создать `FileIcon.tsx`

Взять строки 76–82 оригинала. Без зависимостей.

---

### Шаг 4 — Создать `CreateTaskModal.tsx`

Взять строки 86–239 оригинала. Убрать локальное определение `StaffUser` (оно уже в types). Добавить импорт `FileIcon`.

Обновить `TasksPage.tsx`: убрать строки 86–239, добавить `import CreateTaskModal from '../components/tasks/CreateTaskModal'`.

**Проверка:** Открыть `/tasks`, нажать "+ Создать задачу" — модал работает.

---

### Шаг 5 — Создать `ReassignModal.tsx`

Взять строки 243–322 оригинала.

Обновить `TasksPage.tsx`: убрать строки 243–322, добавить импорт.

**Проверка:** Кнопка "Переназначить" на задаче открывает модал.

---

### Шаг 6 — Создать `GroupsTab.tsx`

Взять строки 326–461 оригинала.

Обновить `TasksPage.tsx`: убрать строки 326–461, добавить импорт.

**Проверка:** Вкладка "Группы" загружается и работает.

---

### Шаг 7 — Создать `TaskCard.tsx`

Взять строки 465–688 оригинала.

Обновить `TasksPage.tsx`: убрать строки 465–688, добавить импорт.

**Проверка:** Карточки отображаются, раскрываются, кнопки переходов работают.

---

### Шаг 8 — Создать `DoneTable.tsx`

Взять строки 692–925 оригинала (включая `type SortField`, `type SortDir`, `function fmt`, `const SortIcon`).

Обновить `TasksPage.tsx`: убрать строки 692–925, добавить импорт.

**Проверка:** Вкладка "Выполненные" работает, сортировки и фильтры функционируют.

---

### Шаг 9 — Финальная уборка `TasksPage.tsx`

После шагов 4–8 в `TasksPage.tsx` должны остаться только строки 929–1233 (оркестратор) + новые импорты.

Удалить строку 23: `type StaffUser = ...` (теперь в `types/index.ts`).

Итоговые импорты в `TasksPage.tsx`:
```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type { Task, TaskGroup, TaskStatus, StaffUser } from '../types';
import { COLUMNS, DONE_COL } from '../components/tasks/constants';
import { canDropTo } from '../components/tasks/utils';
import CreateTaskModal from '../components/tasks/CreateTaskModal';
import ReassignModal from '../components/tasks/ReassignModal';
import GroupsTab from '../components/tasks/GroupsTab';
import TaskCard from '../components/tasks/TaskCard';
import DoneTable from '../components/tasks/DoneTable';
```

---

## 6. ПОДВОДНЫЕ КАМНИ

### 6.1 utils.tsx — обязательно `.tsx`, не `.ts`

Функция `linkify` возвращает JSX (`<a>`, `<span>`). Файл должен называться `utils.tsx`. Иначе TypeScript выдаст: `JSX is not enabled`.

### 6.2 Дублирование логики загрузки файлов

`TaskCard` и `DoneTable` содержат почти идентичный код загрузки файлов. Это дублирование **намеренно не устраняется** в данном рефакторинге. Выделение общего хука — следующий этап.

### 6.3 `draggedTaskIdRef` остаётся в TasksPage

`draggedTaskIdRef` (строка 946) — `useRef<number | null>(null)`, шарится между колонками через callbacks. Остаётся в `TasksPage.tsx`. Колонки получают его через `onDragStart` callback.

### 6.4 `hiddenDoneIds` из localStorage

Логика `hiddenDoneIds` (строки 932–937) остаётся в `TasksPage.tsx`. Не выносить.

### 6.5 IIFE на строках 1167–1206

В TasksPage используется паттерн `{(() => { ... })()}` для колонки выполненных. Перенести как есть.

---

## 7. ЧЕКЛИСТ ПРОВЕРКИ

### После всех шагов

**Вкладка "Задачи" (Канбан):**
- [ ] 4 колонки отображаются: Поставленные, В работе, На проверке, Выполнено
- [ ] Фильтры "Все / Мои / Поставленные мной" переключаются
- [ ] Карточка раскрывается по клику, ссылки в описании кликабельны
- [ ] Переходы статуса работают (Взять в работу, На проверку, Принять)
- [ ] "Вернуть на доработку" показывает textarea → меняет статус
- [ ] Drag & Drop между колонками работает
- [ ] Загрузка/удаление файлов в карточке работает
- [ ] "Переназначить" открывает `ReassignModal`
- [ ] "+ Создать задачу" открывает `CreateTaskModal`
- [ ] "×" скрывает выполненную задачу, "показать" восстанавливает

**Вкладка "Выполненные":**
- [ ] Таблица отображается, сортировки работают (↑/↓)
- [ ] Фильтры по постановщику/исполнителю работают
- [ ] Строка раскрывается, файлы загружаются
- [ ] При пустом списке — сообщение "Выполненных задач нет"

**Вкладка "Группы":**
- [ ] Список групп, раскрытие, управление участниками
- [ ] Для admin: создание/удаление групп
- [ ] Для user: вступить/покинуть

### Размерная проверка

| Файл | Ожидаемые строки |
|------|-----------------|
| `pages/TasksPage.tsx` | ~120 |
| `components/tasks/constants.ts` | ~20 |
| `components/tasks/utils.tsx` | ~50 |
| `components/tasks/FileIcon.tsx` | ~10 |
| `components/tasks/CreateTaskModal.tsx` | ~155 |
| `components/tasks/ReassignModal.tsx` | ~80 |
| `components/tasks/GroupsTab.tsx` | ~135 |
| `components/tasks/TaskCard.tsx` | ~225 |
| `components/tasks/DoneTable.tsx` | ~230 |
