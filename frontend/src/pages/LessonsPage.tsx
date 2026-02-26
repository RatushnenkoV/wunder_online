import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import StartSessionDialog from '../components/StartSessionDialog';
import type { Lesson, LessonFolder, FolderContents, LessonSession } from '../types';

// ─── Иконки ──────────────────────────────────────────────────────────────────

function IconFolder() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function IconDots() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01" />
    </svg>
  );
}

function IconSlides() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
    </svg>
  );
}

// ─── Палитра цветов для урока ──────────────────────────────────────────────

const COVER_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#14b8a6',
];

// ─── Drag item ────────────────────────────────────────────────────────────────

interface DragItem {
  type: 'folder' | 'lesson';
  id: number;
}

// ─── Контекстное меню ─────────────────────────────────────────────────────

interface ContextMenuProps {
  x: number;
  y: number;
  items: { label: string; onClick: () => void; danger?: boolean }[];
  onClose: () => void;
}

function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  useEffect(() => {
    const close = () => onClose();
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [onClose]);

  return (
    <div
      className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]"
      style={{ top: y, left: x }}
      onMouseDown={e => e.stopPropagation()}
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => { item.onClick(); onClose(); }}
          className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${item.danger ? 'text-red-600' : 'text-gray-700'}`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

// ─── Модал создания/переименования папки ──────────────────────────────────

interface FolderModalProps {
  initial?: string;
  title: string;
  onSave: (name: string) => void;
  onClose: () => void;
}

function FolderModal({ initial = '', title, onSave, onClose }: FolderModalProps) {
  const [name, setName] = useState(initial);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim());
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Название папки"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              Отмена
            </button>
            <button type="submit"
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Модал создания урока ────────────────────────────────────────────────

interface LessonModalProps {
  folderId: number | null;
  onSave: (lesson: Lesson) => void;
  onClose: () => void;
}

function LessonModal({ folderId, onSave, onClose }: LessonModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COVER_COLORS[0]);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await api.post('/lessons/lessons/', {
        title: title.trim(),
        description: description.trim(),
        folder: folderId,
        cover_color: color,
      });
      onSave(res.data);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Новый урок</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Например: Тема 1 — Введение"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Описание <span className="text-gray-400">(необязательно)</span></label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Цвет обложки</label>
            <div className="flex gap-2 flex-wrap">
              {COVER_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full transition-transform"
                  style={{
                    backgroundColor: c,
                    outline: color === c ? `3px solid ${c}` : 'none',
                    outlineOffset: '2px',
                    transform: color === c ? 'scale(1.15)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              Отмена
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
              {saving ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Карточка папки ──────────────────────────────────────────────────────

interface FolderCardProps {
  folder: LessonFolder;
  isOwner: boolean;
  isDropTarget: boolean;
  onClick: () => void;
  onRename: () => void;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}

function FolderCard({ folder, isOwner, isDropTarget, onClick, onRename, onDelete, onDragStart, onDragOver, onDragLeave, onDrop }: FolderCardProps) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  // Отслеживаем drag, чтобы не срабатывал onClick при броске
  const didDragRef = useRef(false);

  const openMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  const menuItems = isOwner
    ? [
        { label: 'Переименовать', onClick: onRename },
        { label: 'Удалить', onClick: onDelete, danger: true },
      ]
    : [];

  return (
    <>
      <div
        draggable
        onDragStart={e => { didDragRef.current = true; onDragStart(e); }}
        onDragEnd={() => { setTimeout(() => { didDragRef.current = false; }, 100); }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => { if (!didDragRef.current) onClick(); }}
        onContextMenu={isOwner ? openMenu : undefined}
        className={`bg-white border rounded-xl p-4 transition-all cursor-pointer group flex flex-col gap-3
          ${isDropTarget
            ? 'border-blue-400 shadow-md ring-2 ring-blue-200 bg-blue-50'
            : 'border-gray-200 hover:border-blue-300 hover:shadow-sm'
          }`}
      >
        <div className="flex items-start justify-between">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDropTarget ? 'bg-blue-100 text-blue-500' : 'bg-amber-50 text-amber-500'}`}>
            <IconFolder />
          </div>
          {isOwner && (
            <button
              onClick={openMenu}
              className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-all"
            >
              <IconDots />
            </button>
          )}
        </div>
        <div>
          <div className="font-medium text-gray-900 text-sm leading-tight">{folder.name}</div>
          <div className="text-xs text-gray-400 mt-1">
            {folder.children_count > 0 && `${folder.children_count} папок · `}
            {folder.lessons_count} уроков
          </div>
        </div>
        {isDropTarget && (
          <div className="text-xs text-blue-500 font-medium text-center">Перенести сюда</div>
        )}
      </div>

      {menu && menuItems.length > 0 && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems}
          onClose={() => setMenu(null)}
        />
      )}
    </>
  );
}

// ─── Карточка урока ──────────────────────────────────────────────────────

interface LessonCardProps {
  lesson: Lesson;
  showOwner?: boolean;
  isStaff?: boolean;
  onOpen: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onStart: () => void;
  onDragStart: (e: React.DragEvent) => void;
}

function LessonCard({ lesson, showOwner, isStaff, onOpen, onDuplicate, onDelete, onStart, onDragStart }: LessonCardProps) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const didDragRef = useRef(false);

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  const menuItems = [
    { label: 'Открыть редактор', onClick: onOpen },
    ...(isStaff ? [{ label: 'Начать урок', onClick: onStart }] : []),
    { label: 'Дублировать', onClick: onDuplicate },
    ...(lesson.is_owner ? [{ label: 'Удалить', onClick: onDelete, danger: true }] : []),
  ];

  return (
    <>
      <div
        draggable
        onDragStart={e => { didDragRef.current = true; onDragStart(e); }}
        onDragEnd={() => { setTimeout(() => { didDragRef.current = false; }, 100); }}
        onClick={() => { if (!didDragRef.current) onOpen(); }}
        className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer group flex flex-col"
      >
        {/* Цветная шапка */}
        <div
          className="h-20 flex items-center justify-center"
          style={{ backgroundColor: lesson.cover_color }}
        >
          <div className="text-white opacity-60">
            <IconSlides />
          </div>
        </div>

        <div className="p-4 flex-1 flex flex-col gap-1">
          <div className="flex items-start justify-between gap-2">
            <div className="font-medium text-gray-900 text-sm leading-tight line-clamp-2 flex-1">
              {lesson.title}
            </div>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 flex-shrink-0 transition-all">
              {isStaff && (
                <button
                  onClick={e => { e.stopPropagation(); onStart(); }}
                  className="p-1.5 rounded-md text-green-500 hover:bg-green-50 hover:text-green-700 transition-colors"
                  title="Начать урок"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
              <button
                onClick={handleMenuClick}
                className="p-1 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              >
                <IconDots />
              </button>
            </div>
          </div>
          {showOwner && (
            <div className="text-xs text-gray-400">{lesson.owner_name}</div>
          )}
          <div className="text-xs text-gray-400 mt-auto pt-1">
            {lesson.slides_count} слайдов
          </div>
        </div>
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems}
          onClose={() => setMenu(null)}
        />
      )}
    </>
  );
}

// ─── Хлебные крошки ──────────────────────────────────────────────────────

interface BreadcrumbsProps {
  path: LessonFolder[];
  onNavigate: (folder: LessonFolder | null) => void;
  dropTarget: number | null; // -1 = root
  onDragOver: (e: React.DragEvent, folderId: number | null) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, folderId: number | null) => void;
}

function Breadcrumbs({ path, onNavigate, dropTarget, onDragOver, onDragLeave, onDrop }: BreadcrumbsProps) {
  return (
    <nav className="flex items-center gap-1 text-sm text-gray-500 flex-wrap">
      <button
        onClick={() => onNavigate(null)}
        onDragOver={e => onDragOver(e, null)}
        onDragLeave={onDragLeave}
        onDrop={e => onDrop(e, null)}
        className={`hover:text-blue-600 transition-colors px-1.5 py-0.5 rounded ${dropTarget === -1 ? 'bg-blue-100 text-blue-600 ring-1 ring-blue-300' : ''}`}
      >
        Мои уроки
      </button>
      {path.map((folder, i) => (
        <span key={folder.id} className="flex items-center gap-1">
          <IconChevronRight />
          {i < path.length - 1 ? (
            <button
              onClick={() => onNavigate(folder)}
              onDragOver={e => onDragOver(e, folder.id)}
              onDragLeave={onDragLeave}
              onDrop={e => onDrop(e, folder.id)}
              className={`hover:text-blue-600 transition-colors px-1.5 py-0.5 rounded ${dropTarget === folder.id ? 'bg-blue-100 text-blue-600 ring-1 ring-blue-300' : ''}`}
            >
              {folder.name}
            </button>
          ) : (
            <span className="text-gray-900 font-medium px-1.5 py-0.5">{folder.name}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

// ─── Главная страница ────────────────────────────────────────────────────

export default function LessonsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isStaff = user?.is_admin || user?.is_teacher;

  // Вкладка: mine | all
  const [tab, setTab] = useState<'mine' | 'all'>('mine');

  // Навигация по папкам (стек пути)
  const [folderPath, setFolderPath] = useState<LessonFolder[]>([]);
  const currentFolder = folderPath[folderPath.length - 1] ?? null;

  // Активные сессии (для студентов — их класс, для staff — все)
  const [activeSessions, setActiveSessions] = useState<LessonSession[]>([]);

  useEffect(() => {
    api.get('/lessons/sessions/active/').then(res => {
      setActiveSessions(Array.isArray(res.data) ? res.data : []);
    }).catch(() => {});
  }, []);

  // Данные
  const [folders, setFolders] = useState<LessonFolder[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);

  // Модалы
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<LessonFolder | null>(null);
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [startingLesson, setStartingLesson] = useState<Lesson | null>(null);

  // Ошибка
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Drag-and-drop
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [dropTargetFolderId, setDropTargetFolderId] = useState<number | null>(null);
  // null = нет цели, -1 = корень, N = папка
  const [dropTargetBreadcrumb, setDropTargetBreadcrumb] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'all') {
        const res = await api.get('/lessons/lessons/?tab=all');
        setFolders([]);
        setLessons(res.data);
      } else if (currentFolder) {
        const res = await api.get(`/lessons/folders/${currentFolder.id}/contents/`);
        const data: FolderContents = res.data;
        setFolders(data.subfolders);
        setLessons(data.lessons);
      } else {
        // Корень — мои папки и уроки без папки
        const [foldersRes, lessonsRes] = await Promise.all([
          api.get('/lessons/folders/'),
          api.get('/lessons/lessons/?tab=mine'),
        ]);
        setFolders(foldersRes.data);
        setLessons(lessonsRes.data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [tab, currentFolder]);

  useEffect(() => {
    load();
  }, [load]);

  // Сброс навигации при смене вкладки
  useEffect(() => {
    setFolderPath([]);
  }, [tab]);

  // Навигация в папку
  const openFolder = (folder: LessonFolder) => {
    setFolderPath(prev => [...prev, folder]);
  };

  // Навигация по хлебным крошкам
  const navigateTo = (folder: LessonFolder | null) => {
    if (!folder) {
      setFolderPath([]);
    } else {
      const idx = folderPath.findIndex(f => f.id === folder.id);
      setFolderPath(folderPath.slice(0, idx + 1));
    }
  };

  // Создание папки
  const handleCreateFolder = async (name: string) => {
    await api.post('/lessons/folders/', {
      name,
      parent: currentFolder?.id ?? null,
    });
    setShowFolderModal(false);
    load();
  };

  // Переименование папки
  const handleRenameFolder = async (name: string) => {
    if (!editingFolder) return;
    await api.put(`/lessons/folders/${editingFolder.id}/`, { name });
    setEditingFolder(null);
    load();
  };

  // Удаление папки
  const handleDeleteFolder = async (folder: LessonFolder) => {
    if (!confirm(`Удалить папку «${folder.name}»?`)) return;
    try {
      await api.delete(`/lessons/folders/${folder.id}/`);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Не удалось удалить папку';
      setErrorMsg(msg);
    }
  };

  // Создание урока
  const handleLessonCreated = (lesson: Lesson) => {
    setShowLessonModal(false);
    navigate(`/lessons/${lesson.id}/edit`);
  };

  // Дублирование урока
  const handleDuplicate = async (lesson: Lesson) => {
    await api.post(`/lessons/lessons/${lesson.id}/duplicate/`);
    load();
  };

  // Удаление урока
  const handleDeleteLesson = async (lesson: Lesson) => {
    if (!confirm(`Удалить урок «${lesson.title}»?`)) return;
    await api.delete(`/lessons/lessons/${lesson.id}/`);
    load();
  };

  // ─── Drag-and-drop ───────────────────────────────────────────────────────

  const handleDragStart = (e: React.DragEvent, item: DragItem) => {
    setDragItem(item);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(item));
  };

  const handleDragOverFolder = (e: React.DragEvent, folderId: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetFolderId(folderId);
    setDropTargetBreadcrumb(null);
  };

  const handleDragLeaveFolder = () => {
    setDropTargetFolderId(null);
  };

  const handleDropOnFolder = async (e: React.DragEvent, targetFolderId: number) => {
    e.preventDefault();
    setDropTargetFolderId(null);
    const item = dragItem;
    setDragItem(null);
    if (!item) return;
    if (item.type === 'folder' && item.id === targetFolderId) return; // нельзя в себя
    try {
      if (item.type === 'lesson') {
        await api.put(`/lessons/lessons/${item.id}/`, { folder: targetFolderId });
      } else {
        await api.put(`/lessons/folders/${item.id}/`, { parent: targetFolderId });
      }
      load();
    } catch {
      setErrorMsg('Не удалось переместить элемент');
    }
  };

  const handleDragOverBreadcrumb = (e: React.DragEvent, folderId: number | null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetBreadcrumb(folderId === null ? -1 : folderId);
    setDropTargetFolderId(null);
  };

  const handleDragLeaveBreadcrumb = () => {
    setDropTargetBreadcrumb(null);
  };

  const handleDropOnBreadcrumb = async (e: React.DragEvent, targetFolderId: number | null) => {
    e.preventDefault();
    setDropTargetBreadcrumb(null);
    const item = dragItem;
    setDragItem(null);
    if (!item) return;
    try {
      if (item.type === 'lesson') {
        await api.put(`/lessons/lessons/${item.id}/`, { folder: targetFolderId ?? null });
      } else {
        await api.put(`/lessons/folders/${item.id}/`, { parent: targetFolderId ?? null });
      }
      load();
    } catch {
      setErrorMsg('Не удалось переместить элемент');
    }
  };

  const isEmpty = !loading && folders.length === 0 && lessons.length === 0;

  return (
    <div className="space-y-6">
      {/* Ошибка */}
      {errorMsg && (
        <div className="flex items-center justify-between gap-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0">✕</button>
        </div>
      )}

      {/* Заголовок */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Уроки</h1>
          <p className="text-sm text-gray-500 mt-0.5">Интерактивные уроки и презентации</p>
        </div>

        {isStaff && tab === 'mine' && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowFolderModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <IconPlus />
              Папка
            </button>
            <button
              onClick={() => setShowLessonModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <IconPlus />
              Урок
            </button>
          </div>
        )}
      </div>

      {/* Вкладки */}
      {isStaff && (
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {(['mine', 'all'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${
                tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'mine' ? 'Мои уроки' : 'Все уроки'}
            </button>
          ))}
        </div>
      )}

      {/* Хлебные крошки (только для вкладки «Мои») */}
      {tab === 'mine' && folderPath.length > 0 && (
        <Breadcrumbs
          path={folderPath}
          onNavigate={navigateTo}
          dropTarget={dropTargetBreadcrumb}
          onDragOver={handleDragOverBreadcrumb}
          onDragLeave={handleDragLeaveBreadcrumb}
          onDrop={handleDropOnBreadcrumb}
        />
      )}

      {/* Активные уроки */}
      {activeSessions.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse inline-block" />
            Идёт сейчас
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeSessions.map(ses => (
              <button
                key={ses.id}
                onClick={() => navigate(`/lessons/session/${ses.id}`)}
                className="flex items-center gap-4 p-4 bg-white border-2 border-green-200 rounded-xl hover:border-green-400 hover:shadow-md transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm text-gray-900 truncate group-hover:text-green-700 transition-colors">
                    {ses.lesson_title}
                  </div>
                  <div className="text-xs text-gray-500 truncate mt-0.5">
                    {ses.teacher_name}{ses.school_class_name ? ` · ${ses.school_class_name}` : ''}
                  </div>
                </div>
                <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full flex-shrink-0">
                  Войти
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Содержимое */}
      {loading ? (
        <div className="text-center text-gray-400 py-16">Загрузка...</div>
      ) : isEmpty ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">📂</div>
          <p className="text-gray-500 text-sm">
            {tab === 'all'
              ? 'В школе ещё нет ни одного урока'
              : currentFolder
              ? 'Папка пуста'
              : 'У вас пока нет уроков'}
          </p>
          {isStaff && tab === 'mine' && (
            <button
              onClick={() => setShowLessonModal(true)}
              className="mt-4 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Создать первый урок
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {/* Папки */}
          {folders.map(folder => (
            <FolderCard
              key={`folder-${folder.id}`}
              folder={folder}
              isOwner={folder.owner === user?.id}
              isDropTarget={dropTargetFolderId === folder.id}
              onClick={() => openFolder(folder)}
              onRename={() => setEditingFolder(folder)}
              onDelete={() => handleDeleteFolder(folder)}
              onDragStart={e => handleDragStart(e, { type: 'folder', id: folder.id })}
              onDragOver={e => handleDragOverFolder(e, folder.id)}
              onDragLeave={handleDragLeaveFolder}
              onDrop={e => handleDropOnFolder(e, folder.id)}
            />
          ))}

          {/* Уроки */}
          {lessons.map(lesson => (
            <LessonCard
              key={`lesson-${lesson.id}`}
              lesson={lesson}
              showOwner={tab === 'all'}
              isStaff={!!isStaff}
              onOpen={() => navigate(`/lessons/${lesson.id}/edit`)}
              onDuplicate={() => handleDuplicate(lesson)}
              onDelete={() => handleDeleteLesson(lesson)}
              onStart={() => setStartingLesson(lesson)}
              onDragStart={e => handleDragStart(e, { type: 'lesson', id: lesson.id })}
            />
          ))}
        </div>
      )}

      {/* Модалы */}
      {showFolderModal && (
        <FolderModal
          title="Новая папка"
          onSave={handleCreateFolder}
          onClose={() => setShowFolderModal(false)}
        />
      )}

      {editingFolder && (
        <FolderModal
          title="Переименовать папку"
          initial={editingFolder.name}
          onSave={handleRenameFolder}
          onClose={() => setEditingFolder(null)}
        />
      )}

      {showLessonModal && (
        <LessonModal
          folderId={currentFolder?.id ?? null}
          onSave={handleLessonCreated}
          onClose={() => setShowLessonModal(false)}
        />
      )}

      {startingLesson && (
        <StartSessionDialog
          lessonId={startingLesson.id}
          lessonTitle={startingLesson.title}
          onClose={() => setStartingLesson(null)}
        />
      )}
    </div>
  );
}
