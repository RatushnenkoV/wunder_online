import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import StartSessionDialog from '../components/StartSessionDialog';
import SessionStatsDialog from '../components/SessionStatsDialog';
import TextbookViewer from '../components/TextbookViewer';
import type {
  Lesson, LessonFolder, FolderContents, LessonSession,
  TeacherLessonsOverview, TeacherRootContent, Textbook, TextbookGradeLevel, Subject, LessonAssignment, SchoolClass,
} from '../types';

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

function IconBook() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
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
      className="fixed z-50 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg py-1 min-w-[160px]"
      style={{ top: y, left: x }}
      onMouseDown={e => e.stopPropagation()}
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => { item.onClick(); onClose(); }}
          className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors ${item.danger ? 'text-red-600' : 'text-gray-700 dark:text-slate-300'}`}
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
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">{title}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Название папки"
            className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
              Отмена
            </button>
            <button type="submit"
              className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
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
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Новый урок</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Название</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Например: Тема 1 — Введение"
              className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Описание <span className="text-gray-400 dark:text-slate-500">(необязательно)</span></label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Цвет обложки</label>
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
              className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
              Отмена
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50">
              {saving ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Модал загрузки учебника ────────────────────────────────────────────────

interface TextbookUploadModalProps {
  onSave: (tb: Textbook) => void;
  onClose: () => void;
}

function TextbookUploadModal({ onSave, onClose }: TextbookUploadModalProps) {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [subjectId, setSubjectId] = useState<number | ''>('');
  const [selectedGLIds, setSelectedGLIds] = useState<number[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [gradeLevels, setGradeLevels] = useState<TextbookGradeLevel[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    Promise.all([
      api.get('/school/subjects/'),
      api.get('/lessons/textbooks/grade-levels/'),
    ]).then(([subRes, glRes]) => {
      setSubjects(subRes.data);
      setGradeLevels(glRes.data);
    }).catch(() => {});
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f && !title) {
      setTitle(f.name.replace(/\.[^.]+$/, ''));
    }
  };

  const toggleGL = (id: number) => {
    setSelectedGLIds(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim()) return;
    setSaving(true);
    setUploadProgress(0);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', title.trim());
      if (subjectId) fd.append('subject', String(subjectId));
      selectedGLIds.forEach(id => fd.append('grade_level_ids', String(id)));
      const res = await api.post('/lessons/textbooks/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
      onSave(res.data);
    } finally {
      setSaving(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={saving ? undefined : onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Загрузить учебник</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Файл <span className="text-red-500">*</span></label>
            <input
              type="file"
              accept=".pdf,.epub,.djvu,.doc,.docx"
              onChange={handleFileChange}
              className="w-full text-sm text-gray-500 dark:text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Название <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Например: Математика 5 класс"
              className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Предмет</label>
            <select
              value={subjectId}
              onChange={e => setSubjectId(e.target.value ? Number(e.target.value) : '')}
              className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">— не указан —</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Параллели</label>
            <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-slate-700 rounded-lg p-2 space-y-1">
              {gradeLevels.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-slate-500 p-1">Нет параллелей</p>
              ) : (
                gradeLevels.map(gl => (
                  <label key={gl.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedGLIds.includes(gl.id)}
                      onChange={() => toggleGL(gl.id)}
                      className="rounded border-gray-300 dark:border-slate-600 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-slate-300">{gl.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>
          {saving && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400">
                <span>{uploadProgress < 100 ? 'Загрузка файла...' : 'Обработка...'}</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} disabled={saving}
              className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50">
              Отмена
            </button>
            <button type="submit" disabled={saving || !file || !title.trim()}
              className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50">
              {saving ? 'Загрузка...' : 'Загрузить'}
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
        className={`bg-white dark:bg-slate-800 border rounded-xl p-4 transition-all cursor-pointer group flex flex-col gap-3
          ${isDropTarget
            ? 'border-purple-400 shadow-md ring-2 ring-purple-200 bg-purple-50'
            : 'border-gray-200 dark:border-slate-700 hover:border-purple-300 hover:shadow-sm'
          }`}
      >
        <div className="flex items-start justify-between">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDropTarget ? 'bg-purple-100 text-purple-500' : 'bg-amber-50 text-amber-500'}`}>
            <IconFolder />
          </div>
          {isOwner && (
            <button
              onClick={openMenu}
              className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-gray-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-700 transition-all"
            >
              <IconDots />
            </button>
          )}
        </div>
        <div>
          <div className="font-medium text-gray-900 dark:text-slate-100 text-sm leading-tight">{folder.name}</div>
          <div className="text-xs text-gray-400 dark:text-slate-500 mt-1">
            {folder.children_count > 0 && `${folder.children_count} папок · `}
            {folder.lessons_count} уроков
          </div>
        </div>
        {isDropTarget && (
          <div className="text-xs text-purple-500 font-medium text-center">Перенести сюда</div>
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

// ─── Карточка учителя (для вкладки «Все уроки») ──────────────────────────

interface TeacherCardProps {
  teacher: TeacherLessonsOverview;
  onClick: () => void;
}

function TeacherCard({ teacher, onClick }: TeacherCardProps) {
  const initials = teacher.teacher_name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0] ?? '')
    .join('');

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 hover:border-purple-300 hover:shadow-sm transition-all cursor-pointer flex flex-col gap-3"
    >
      <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-sm font-semibold flex-shrink-0">
        {initials}
      </div>
      <div>
        <div className="font-medium text-gray-900 dark:text-slate-100 text-sm leading-tight">{teacher.teacher_name}</div>
        <div className="text-xs text-gray-400 dark:text-slate-500 mt-1">
          {teacher.folders_count > 0 && `${teacher.folders_count} папок · `}
          {teacher.lessons_count} уроков
        </div>
      </div>
    </div>
  );
}

// ─── Карточка параллели (для вкладки «Учебники») ─────────────────────────

interface GradeLevelCardProps {
  gradeLevel: TextbookGradeLevel;
  onClick: () => void;
}

function GradeLevelCard({ gradeLevel, onClick }: GradeLevelCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 hover:border-purple-300 hover:shadow-sm transition-all cursor-pointer flex flex-col gap-3"
    >
      <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg">
        {gradeLevel.number}
      </div>
      <div>
        <div className="font-medium text-gray-900 dark:text-slate-100 text-sm">{gradeLevel.name}</div>
      </div>
    </div>
  );
}

// ─── Карточка учебника ───────────────────────────────────────────────────

interface TextbookCardProps {
  textbook: Textbook;
  isStaff: boolean;
  onDelete: () => void;
  onRename: () => void;
  onOpen: () => void;
}

function TextbookCard({ textbook, isStaff, onDelete, onRename, onOpen }: TextbookCardProps) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const ext = textbook.original_name.split('.').pop()?.toLowerCase() ?? '';
  const extLabel = ext.toUpperCase() || 'FILE';
  const isPdf = ext === 'pdf';

  const sizeStr = textbook.file_size > 1024 * 1024
    ? `${(textbook.file_size / 1024 / 1024).toFixed(1)} МБ`
    : `${Math.round(textbook.file_size / 1024)} КБ`;

  const menuItems = isStaff
    ? [
        { label: 'Переименовать', onClick: onRename },
        { label: 'Удалить', onClick: onDelete, danger: true },
      ]
    : [];

  return (
    <>
      <div
        onClick={isPdf ? onOpen : undefined}
        className={`bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden transition-all group flex flex-col ${isPdf ? 'cursor-pointer hover:border-purple-300 hover:shadow-sm' : ''}`}
      >
        {/* Цветная шапка */}
        <div className="h-16 bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center relative">
          <span className="text-white/80 text-xs font-bold tracking-widest">{extLabel}</span>
          {isPdf && (
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-800/90 text-purple-700 text-xs font-medium px-2.5 py-1 rounded-full">
                Открыть
              </span>
            </div>
          )}
        </div>

        <div className="p-3 flex-1 flex flex-col gap-1">
          <div className="flex items-start justify-between gap-1">
            <div className="font-medium text-gray-900 dark:text-slate-100 text-sm leading-tight line-clamp-2 flex-1">
              {textbook.title}
            </div>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
              {textbook.file_url && (
                <a
                  href={textbook.file_url}
                  download={textbook.original_name}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="p-1 rounded text-gray-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-purple-600 transition-colors"
                  title="Скачать"
                >
                  <IconDownload />
                </a>
              )}
              {isStaff && (
                <button
                  onClick={e => { e.stopPropagation(); setMenu({ x: e.clientX, y: e.clientY }); }}
                  className="p-1 rounded text-gray-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-700 transition-colors"
                >
                  <IconDots />
                </button>
              )}
            </div>
          </div>
          {textbook.subject_name && (
            <div className="text-xs text-purple-600">{textbook.subject_name}</div>
          )}
          <div className="text-xs text-gray-400 dark:text-slate-500 mt-auto pt-0.5">{extLabel} · {sizeStr}</div>
        </div>
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
  readonly?: boolean;
  onOpen: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onStart: () => void;
  onIssue?: () => void;
  onStats?: () => void;
  onDragStart: (e: React.DragEvent) => void;
}

function LessonCard({ lesson, showOwner, isStaff, readonly, onOpen, onDuplicate, onDelete, onStart, onIssue, onStats, onDragStart }: LessonCardProps) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const didDragRef = useRef(false);

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  const menuItems = readonly
    ? [{ label: 'Открыть', onClick: onOpen }]
    : [
        { label: 'Открыть редактор', onClick: onOpen },
        ...(isStaff ? [{ label: 'Начать урок', onClick: onStart }] : []),
        ...(isStaff && onIssue ? [{ label: 'Выдать классу', onClick: onIssue }] : []),
        ...(isStaff && onStats ? [{ label: 'Статистика', onClick: onStats }] : []),
        { label: 'Дублировать', onClick: onDuplicate },
        ...(lesson.is_owner ? [{ label: 'Удалить', onClick: onDelete, danger: true }] : []),
      ];

  return (
    <>
      <div
        draggable={!readonly}
        onDragStart={e => { if (!readonly) { didDragRef.current = true; onDragStart(e); } }}
        onDragEnd={() => { setTimeout(() => { didDragRef.current = false; }, 100); }}
        onClick={() => { if (!didDragRef.current) onOpen(); }}
        className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden hover:border-purple-300 hover:shadow-sm transition-all cursor-pointer group flex flex-col"
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
            <div className="font-medium text-gray-900 dark:text-slate-100 text-sm leading-tight line-clamp-2 flex-1">
              {lesson.title}
            </div>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 flex-shrink-0 transition-all">
              {isStaff && !readonly && (
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
                className="p-1 rounded-md text-gray-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-700 transition-colors"
              >
                <IconDots />
              </button>
            </div>
          </div>
          {showOwner && (
            <div className="text-xs text-gray-400 dark:text-slate-500">{lesson.owner_name}</div>
          )}
          <div className="text-xs text-gray-400 dark:text-slate-500 mt-auto pt-1">
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
  items: { label: string; onClick: () => void }[];
  dropTarget?: number | null;
  onDragOver?: (e: React.DragEvent, idx: number) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent, idx: number) => void;
}

function Breadcrumbs({ items, dropTarget, onDragOver, onDragLeave, onDrop }: BreadcrumbsProps) {
  return (
    <nav className="flex items-center gap-1 text-sm text-gray-500 dark:text-slate-400 flex-wrap">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <IconChevronRight />}
          {i < items.length - 1 ? (
            <button
              onClick={item.onClick}
              onDragOver={onDragOver ? e => onDragOver(e, i) : undefined}
              onDragLeave={onDragLeave}
              onDrop={onDrop ? e => onDrop(e, i) : undefined}
              className={`hover:text-purple-600 transition-colors px-1.5 py-0.5 rounded ${dropTarget === i ? 'bg-purple-100 text-purple-600 ring-1 ring-purple-300' : ''}`}
            >
              {item.label}
            </button>
          ) : (
            <span className="text-gray-900 dark:text-slate-100 font-medium px-1.5 py-0.5">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

// ─── Вкладка «Учебники» ──────────────────────────────────────────────────

interface TextbooksTabProps {
  isStaff: boolean;
}

function TextbooksTab({ isStaff }: TextbooksTabProps) {
  const { user } = useAuth();
  const [gradeLevels, setGradeLevels] = useState<TextbookGradeLevel[]>([]);
  const [selectedGL, setSelectedGL] = useState<TextbookGradeLevel | null>(null);
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [loadingGLs, setLoadingGLs] = useState(true);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [renamingTextbook, setRenamingTextbook] = useState<Textbook | null>(null);
  const [viewingTextbook, setViewingTextbook] = useState<Textbook | null>(null);

  // Загружаем параллели
  useEffect(() => {
    setLoadingGLs(true);
    api.get('/lessons/textbooks/grade-levels/').then(res => {
      const data: TextbookGradeLevel[] = res.data;
      setGradeLevels(data);
      // Ученик или родитель с одной параллелью — сразу переходим
      if (data.length === 1) {
        setSelectedGL(data[0]);
      }
    }).catch(() => {}).finally(() => setLoadingGLs(false));
  }, []);

  // Загружаем учебники при выборе параллели
  useEffect(() => {
    if (!selectedGL) return;
    setLoadingBooks(true);
    api.get(`/lessons/textbooks/?grade_level_id=${selectedGL.id}`).then(res => {
      setTextbooks(res.data);
    }).catch(() => {}).finally(() => setLoadingBooks(false));
  }, [selectedGL]);

  const handleDeleteTextbook = async (tb: Textbook) => {
    if (!confirm(`Удалить учебник «${tb.title}»?`)) return;
    await api.delete(`/lessons/textbooks/${tb.id}/`);
    setTextbooks(prev => prev.filter(t => t.id !== tb.id));
  };

  const handleRenameTextbook = async (title: string) => {
    if (!renamingTextbook) return;
    await api.put(`/lessons/textbooks/${renamingTextbook.id}/`, { title });
    setTextbooks(prev => prev.map(t => t.id === renamingTextbook.id ? { ...t, title } : t));
    setRenamingTextbook(null);
  };

  const handleUploaded = (tb: Textbook) => {
    setShowUploadModal(false);
    if (selectedGL && tb.grade_levels_data.some(g => g.id === selectedGL.id)) {
      setTextbooks(prev => [tb, ...prev]);
    }
  };

  const breadcrumbItems = [
    { label: 'Учебники', onClick: () => setSelectedGL(null) },
    ...(selectedGL ? [{ label: selectedGL.name, onClick: () => {} }] : []),
  ];

  if (loadingGLs) {
    return <div className="text-center text-gray-400 dark:text-slate-500 py-16">Загрузка...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Шапка с хлебными крошками и кнопкой */}
      <div className="flex items-center justify-between gap-4">
        {selectedGL && gradeLevels.length > 1 ? (
          <Breadcrumbs items={breadcrumbItems} />
        ) : selectedGL ? (
          <div className="text-sm text-gray-500 dark:text-slate-400">
            Параллель: <span className="font-medium text-gray-900 dark:text-slate-100">{selectedGL.name}</span>
          </div>
        ) : (
          <div />
        )}
        {isStaff && (
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <IconPlus />
            Учебник
          </button>
        )}
      </div>

      {/* Список параллелей */}
      {!selectedGL && (
        gradeLevels.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">📚</div>
            <p className="text-gray-500 dark:text-slate-400 text-sm">
              {user?.is_student ? 'Вы не привязаны к классу' : 'Нет доступных параллелей'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {gradeLevels.map(gl => (
              <GradeLevelCard key={gl.id} gradeLevel={gl} onClick={() => setSelectedGL(gl)} />
            ))}
          </div>
        )
      )}

      {/* Список учебников */}
      {selectedGL && (
        loadingBooks ? (
          <div className="text-center text-gray-400 dark:text-slate-500 py-16">Загрузка...</div>
        ) : textbooks.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">📖</div>
            <p className="text-gray-500 dark:text-slate-400 text-sm">Учебники для этой параллели ещё не загружены</p>
            {isStaff && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="mt-4 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Загрузить учебник
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {textbooks.map(tb => (
              <TextbookCard
                key={tb.id}
                textbook={tb}
                isStaff={isStaff}
                onDelete={() => handleDeleteTextbook(tb)}
                onRename={() => setRenamingTextbook(tb)}
                onOpen={() => setViewingTextbook(tb)}
              />
            ))}
          </div>
        )
      )}

      {showUploadModal && (
        <TextbookUploadModal
          onSave={handleUploaded}
          onClose={() => setShowUploadModal(false)}
        />
      )}

      {renamingTextbook && (
        <FolderModal
          title="Переименовать учебник"
          initial={renamingTextbook.title}
          onSave={handleRenameTextbook}
          onClose={() => setRenamingTextbook(null)}
        />
      )}

      {viewingTextbook && viewingTextbook.file_url && (
        <TextbookViewer
          title={viewingTextbook.title}
          fileUrl={viewingTextbook.file_url}
          onClose={() => setViewingTextbook(null)}
        />
      )}
    </div>
  );
}

// ─── Главная страница ────────────────────────────────────────────────────

export default function LessonsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isStaff = !!(user?.is_admin || user?.is_teacher);

  // Вкладка
  const [tab, setTab] = useState<'mine' | 'all' | 'textbooks' | 'assignments'>('mine');

  // Навигация по папкам (стек пути) — для mine и all
  const [folderPath, setFolderPath] = useState<LessonFolder[]>([]);
  const currentFolder = folderPath[folderPath.length - 1] ?? null;

  // Для вкладки «Все уроки» — выбранный учитель
  const [allTabTeacher, setAllTabTeacher] = useState<{ id: number; name: string } | null>(null);
  const [teachersOverview, setTeachersOverview] = useState<TeacherLessonsOverview[]>([]);

  // Активные сессии
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

  // Задания (выданные уроки)
  const [assignments, setAssignments] = useState<LessonAssignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [issuingLesson, setIssuingLesson] = useState<Lesson | null>(null);
  const [statsLesson, setStatsLesson] = useState<Lesson | null>(null);
  const [issueClasses, setIssueClasses] = useState<SchoolClass[]>([]);
  const [issueTargetType, setIssueTargetType] = useState<'class' | 'student'>('class');
  const [issueClassId, setIssueClassId] = useState<number | null>(null);
  const [issueDueDate, setIssueDueDate] = useState('');
  const [issueLoading, setIssueLoading] = useState(false);

  // Импорт презентации
  const importFileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  // Drag-and-drop
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [dropTargetFolderId, setDropTargetFolderId] = useState<number | null>(null);
  const [dropTargetBreadcrumb, setDropTargetBreadcrumb] = useState<number | null>(null);

  // Load assignments
  useEffect(() => {
    if (tab !== 'assignments') return;
    setAssignmentsLoading(true);
    api.get('/lessons/assignments/').then(r => setAssignments(r.data)).catch(() => {}).finally(() => setAssignmentsLoading(false));
  }, [tab]);

  // Load classes for issue modal
  useEffect(() => {
    if (!issuingLesson) return;
    api.get('/school/classes/').then(r => setIssueClasses(r.data)).catch(() => {});
  }, [issuingLesson]);

  const handleIssueLesson = async () => {
    if (!issuingLesson || (!issueClassId && issueTargetType === 'class')) return;
    setIssueLoading(true);
    try {
      await api.post('/lessons/assignments/', {
        lesson: issuingLesson.id,
        school_class: issueTargetType === 'class' ? issueClassId : null,
        due_date: issueDueDate || null,
      });
      setIssuingLesson(null);
      setIssueClassId(null);
      setIssueDueDate('');
    } catch { /* ignore */ } finally { setIssueLoading(false); }
  };

  const load = useCallback(async () => {
    if (tab === 'textbooks' || tab === 'assignments') return;
    if (!isStaff) { setFolders([]); setLessons([]); setLoading(false); return; }
    setLoading(true);
    try {
      if (tab === 'all') {
        if (!allTabTeacher) {
          const res = await api.get('/lessons/school-overview/');
          setTeachersOverview(res.data);
          setFolders([]);
          setLessons([]);
        } else if (!currentFolder) {
          const res = await api.get(`/lessons/teacher-root/?teacher_id=${allTabTeacher.id}`);
          const data: TeacherRootContent = res.data;
          setFolders(data.folders);
          setLessons(data.lessons);
        } else {
          const res = await api.get(`/lessons/folders/${currentFolder.id}/contents/`);
          const data: FolderContents = res.data;
          setFolders(data.subfolders);
          setLessons(data.lessons);
        }
      } else {
        // mine
        if (currentFolder) {
          const res = await api.get(`/lessons/folders/${currentFolder.id}/contents/`);
          const data: FolderContents = res.data;
          setFolders(data.subfolders);
          setLessons(data.lessons);
        } else {
          const [foldersRes, lessonsRes] = await Promise.all([
            api.get('/lessons/folders/'),
            api.get('/lessons/lessons/?tab=mine'),
          ]);
          setFolders(foldersRes.data);
          setLessons(lessonsRes.data);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [tab, allTabTeacher, currentFolder]);

  useEffect(() => {
    load();
  }, [load]);

  // Сброс навигации при смене вкладки
  useEffect(() => {
    setFolderPath([]);
    setAllTabTeacher(null);
    setTeachersOverview([]);
  }, [tab]);

  // Навигация в папку
  const openFolder = (folder: LessonFolder) => {
    setFolderPath(prev => [...prev, folder]);
  };

  // Навигация по хлебным крошкам
  const navigateTo = (idx: number) => {
    if (idx === 0) {
      // «Мои уроки» или «Все уроки» корень
      if (tab === 'all' && allTabTeacher) {
        setFolderPath([]);
        // idx=0 — корень учителей, idx=1 — учитель
        setAllTabTeacher(null);
      } else {
        setFolderPath([]);
      }
    } else if (tab === 'all' && allTabTeacher && idx === 1) {
      // Перешли на уровень учителя
      setFolderPath([]);
    } else {
      // Папка в стеке: idx в хлебных крошках соответствует folderPath[idx-offset]
      const pathIdx = tab === 'all' && allTabTeacher ? idx - 2 : idx - 1;
      setFolderPath(prev => prev.slice(0, pathIdx + 1));
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

  // Импорт презентации (PDF / PPTX)
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', file.name.replace(/\.[^.]+$/, ''));
      if (currentFolder) fd.append('folder', String(currentFolder.id));
      const res = await api.post('/lessons/import/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      navigate(`/lessons/${res.data.id}/edit`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Не удалось импортировать файл';
      setErrorMsg(msg);
    } finally {
      setImporting(false);
    }
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
    if (item.type === 'folder' && item.id === targetFolderId) return;
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

  const handleDragOverBreadcrumb = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetBreadcrumb(idx);
    setDropTargetFolderId(null);
  };

  const handleDragLeaveBreadcrumb = () => {
    setDropTargetBreadcrumb(null);
  };

  const handleDropOnBreadcrumb = async (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDropTargetBreadcrumb(null);
    const item = dragItem;
    setDragItem(null);
    if (!item) return;
    // idx=0 → корень (folder=null), idx>0 → папка в пути [idx-1]
    const targetFolder = idx === 0 ? null : folderPath[idx - 1];
    const targetFolderId = targetFolder?.id ?? null;
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

  // Хлебные крошки для mine/all
  const buildBreadcrumbs = () => {
    if (tab === 'mine') {
      return [
        { label: 'Мои уроки', onClick: () => navigateTo(0) },
        ...folderPath.map((f, i) => ({ label: f.name, onClick: () => navigateTo(i + 1) })),
      ];
    }
    // all
    const items = [{ label: 'Все уроки', onClick: () => navigateTo(0) }];
    if (allTabTeacher) {
      items.push({ label: allTabTeacher.name, onClick: () => navigateTo(1) });
      folderPath.forEach((f, i) => items.push({ label: f.name, onClick: () => navigateTo(i + 2) }));
    }
    return items;
  };

  const breadcrumbs = buildBreadcrumbs();
  const showBreadcrumbs = tab !== 'textbooks' && breadcrumbs.length > 1;
  const isReadonlyView = tab === 'all'; // В «Все уроки» нет редактирования чужих папок

  const isEmpty = !loading && folders.length === 0 && lessons.length === 0
    && (tab !== 'all' || allTabTeacher !== null || teachersOverview.length === 0);

  const isTeachersRoot = tab === 'all' && !allTabTeacher;

  const tabs: { key: 'mine' | 'all' | 'textbooks' | 'assignments'; label: string }[] = isStaff
    ? [
        { key: 'mine', label: 'Мои уроки' },
        { key: 'all', label: 'Все уроки' },
        { key: 'textbooks', label: 'Учебники' },
        { key: 'assignments', label: 'Выданные' },
      ]
    : [
        { key: 'mine', label: 'Уроки' },
        { key: 'assignments', label: 'Задания' },
        { key: 'textbooks', label: 'Учебники' },
      ];

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Уроки</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Интерактивные уроки и презентации</p>
        </div>

        {isStaff && tab === 'mine' && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowFolderModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
            >
              <IconPlus />
              Папка
            </button>
            <button
              onClick={() => importFileRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              title="Импорт PDF или PPTX"
            >
              <IconDownload />
              {importing ? 'Импорт...' : 'Импорт'}
            </button>
            <input
              ref={importFileRef}
              type="file"
              accept=".pdf,.pptx,.ppt"
              className="hidden"
              onChange={handleImportFile}
            />
            <button
              onClick={() => setShowLessonModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <IconPlus />
              Урок
            </button>
          </div>
        )}
      </div>

      {/* Вкладки */}
      <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 rounded-lg p-1 w-fit">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${
              tab === t.key ? 'bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Вкладка учебники */}
      {tab === 'textbooks' && <TextbooksTab isStaff={isStaff} />}

      {/* Вкладка задания */}
      {tab === 'assignments' && (
        <div>
          {assignmentsLoading ? (
            <div className="text-center text-gray-400 dark:text-slate-500 py-16">Загрузка…</div>
          ) : assignments.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-gray-500 dark:text-slate-400">{isStaff ? 'Вы ещё не выдавали уроки' : 'Вам не выданы уроки'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {assignments.map(a => (
                <div key={a.id} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden hover:shadow-sm transition-all">
                  <div className="h-16 flex items-center justify-center" style={{ backgroundColor: a.lesson_cover_color }}>
                    <span className="text-white opacity-60 text-2xl">📖</span>
                  </div>
                  <div className="p-4 space-y-1">
                    <div className="font-medium text-gray-900 dark:text-slate-100 text-sm truncate">{a.lesson_title}</div>
                    {a.school_class_name && <div className="text-xs text-gray-500 dark:text-slate-400">Класс: {a.school_class_name}</div>}
                    {a.due_date && <div className="text-xs text-gray-500 dark:text-slate-400">Срок: {new Date(a.due_date).toLocaleString('ru', { day: 'numeric', month: 'long' })}</div>}
                    {isStaff && <div className="text-xs text-gray-400 dark:text-slate-500">Выдано: {new Date(a.created_at).toLocaleDateString('ru')}</div>}
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => navigate(`/lessons/self-paced/${a.lesson}`)}
                        className="flex-1 px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        {isStaff ? 'Открыть' : 'Начать'}
                      </button>
                      {isStaff && (
                        <button
                          onClick={async () => { await api.delete(`/lessons/assignments/${a.id}/`); setAssignments(prev => prev.filter(x => x.id !== a.id)); }}
                          className="px-3 py-1.5 border border-red-200 text-red-500 text-xs font-medium rounded-lg hover:bg-red-50 transition-colors"
                        >
                          Отозвать
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Хлебные крошки */}
      {showBreadcrumbs && (
        <Breadcrumbs
          items={breadcrumbs}
          dropTarget={tab === 'mine' ? dropTargetBreadcrumb : undefined}
          onDragOver={tab === 'mine' ? handleDragOverBreadcrumb : undefined}
          onDragLeave={tab === 'mine' ? handleDragLeaveBreadcrumb : undefined}
          onDrop={tab === 'mine' ? handleDropOnBreadcrumb : undefined}
        />
      )}

      {/* Активные уроки */}
      {tab !== 'textbooks' && activeSessions.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse inline-block" />
            Идёт сейчас
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeSessions.map(ses => (
              <button
                key={ses.id}
                onClick={() => navigate(`/lessons/session/${ses.id}`)}
                className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 border-2 border-green-200 rounded-xl hover:border-green-400 hover:shadow-md transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm text-gray-900 dark:text-slate-100 truncate group-hover:text-green-700 transition-colors">
                    {ses.lesson_title}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-slate-400 truncate mt-0.5">
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

      {/* Содержимое mine/all */}
      {tab !== 'textbooks' && (
        <>
          {/* Корень «Все уроки» — карточки учителей */}
          {isTeachersRoot && (
            loading ? (
              <div className="text-center text-gray-400 dark:text-slate-500 py-16">Загрузка...</div>
            ) : teachersOverview.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">📂</div>
                <p className="text-gray-500 dark:text-slate-400 text-sm">В школе ещё нет ни одного урока</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {teachersOverview.map(t => (
                  <TeacherCard
                    key={t.teacher_id}
                    teacher={t}
                    onClick={() => setAllTabTeacher({ id: t.teacher_id, name: t.teacher_name })}
                  />
                ))}
              </div>
            )
          )}

          {/* Папки и уроки (mine + all inside teacher) */}
          {!isTeachersRoot && isStaff && (
            loading ? (
              <div className="text-center text-gray-400 dark:text-slate-500 py-16">Загрузка...</div>
            ) : (folders.length === 0 && lessons.length === 0) ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">📂</div>
                <p className="text-gray-500 dark:text-slate-400 text-sm">
                  {currentFolder ? 'Папка пуста' : 'У вас пока нет уроков'}
                </p>
                {isStaff && tab === 'mine' && (
                  <button
                    onClick={() => setShowLessonModal(true)}
                    className="mt-4 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
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
                    isOwner={!isReadonlyView && folder.owner === user?.id}
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
                    showOwner={isReadonlyView}
                    isStaff={isStaff}
                    readonly={isReadonlyView}
                    onOpen={() => navigate(`/lessons/${lesson.id}/edit`)}
                    onDuplicate={() => handleDuplicate(lesson)}
                    onDelete={() => handleDeleteLesson(lesson)}
                    onStart={() => setStartingLesson(lesson)}
                    onIssue={isStaff ? () => setIssuingLesson(lesson) : undefined}
                    onStats={isStaff ? () => setStatsLesson(lesson) : undefined}
                    onDragStart={e => handleDragStart(e, { type: 'lesson', id: lesson.id })}
                  />
                ))}
              </div>
            )
          )}
        </>
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

      {/* Модал "Выдать урок" */}
      {issuingLesson && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setIssuingLesson(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Выдать урок</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 truncate">📖 {issuingLesson.title}</p>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Получатель</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setIssueTargetType('class')}
                  className={`flex-1 py-1.5 text-sm rounded-lg border ${issueTargetType === 'class' ? 'border-purple-500 text-purple-700 bg-purple-50' : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
                >
                  Весь класс
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Класс</label>
              <select
                value={issueClassId ?? ''}
                onChange={e => setIssueClassId(Number(e.target.value) || null)}
                className="w-full border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
              >
                <option value="">— выберите класс —</option>
                {issueClasses.map(c => <option key={c.id} value={c.id}>{c.display_name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Срок выполнения (опционально)</label>
              <input
                type="datetime-local"
                value={issueDueDate}
                onChange={e => setIssueDueDate(e.target.value)}
                className="border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setIssuingLesson(null)} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
                Отмена
              </button>
              <button
                onClick={handleIssueLesson}
                disabled={issueLoading || !issueClassId}
                className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {issueLoading ? 'Выдаём…' : 'Выдать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Диалог статистики сессий */}
      {statsLesson && (
        <SessionStatsDialog lesson={statsLesson} onClose={() => setStatsLesson(null)} />
      )}

      {/* Оверлей импорта */}
      {importing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl px-8 py-6 flex flex-col items-center gap-3">
            <svg className="w-8 h-8 text-purple-600 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Импорт презентации...</p>
            <p className="text-xs text-gray-400 dark:text-slate-500">Это может занять несколько секунд</p>
          </div>
        </div>
      )}
    </div>
  );
}
