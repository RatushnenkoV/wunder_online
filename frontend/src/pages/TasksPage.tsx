import { useState, useEffect, useCallback, useRef } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type { Task, TaskFile, TaskGroup, TaskStatus } from '../types';

// ─── Константы ────────────────────────────────────────────────────────────────

const COLUMNS: {
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

const DONE_COL = { status: 'done' as TaskStatus, label: 'Выполнено', colorBg: 'bg-green-50', colorBorder: 'border-green-200', colorDrag: '' };

type StaffUser = { id: number; first_name: string; last_name: string };

// ─── Утилиты ──────────────────────────────────────────────────────────────────

/** Парсит текст и делает URL-ссылки кликабельными */
function linkify(text: string) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, i) => {
    if (/^https?:\/\//.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="text-blue-600 hover:underline break-all"
        >
          {part}
        </a>
      );
    }
    return part ? <span key={i}>{part}</span> : null;
  });
}

/** Доступные переходы статуса для текущего пользователя */
function getTransitions(task: Task) {
  const result: { to: TaskStatus; label: string }[] = [];
  // new→in_progress: только исполнитель
  if (task.status === 'new' && task.is_assignee) {
    result.push({ to: 'in_progress', label: 'Взять в работу' });
  }
  // in_progress→review: только исполнитель
  if (task.status === 'in_progress' && task.is_assignee) {
    result.push({ to: 'review', label: 'На проверку' });
  }
  // review→done/in_progress: только постановщик (can_reassign включает его)
  if (task.status === 'review' && task.can_reassign) {
    result.push({ to: 'done', label: 'Принять' });
    result.push({ to: 'in_progress', label: 'Вернуть на доработку' });
  }
  return result;
}

function canDropTo(task: Task, toStatus: TaskStatus): boolean {
  if (toStatus === 'done') return false;
  if (task.status === toStatus) return false;
  return getTransitions(task).some(t => t.to === toStatus);
}

// ─── Компонент иконки файла ───────────────────────────────────────────────────

function FileIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
    </svg>
  );
}

// ─── Модал создания задачи ────────────────────────────────────────────────────

function CreateTaskModal({
  groups, staffList, onClose, onCreated,
}: {
  groups: TaskGroup[];
  staffList: StaffUser[];
  onClose: () => void;
  onCreated: (task: Task) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignType, setAssignType] = useState<'person' | 'group'>('person');
  const [assignedTo, setAssignedTo] = useState('');
  const [assignedGroup, setAssignedGroup] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload: Record<string, unknown> = { title, description };
      if (dueDate) payload.due_date = dueDate;
      if (assignType === 'person') payload.assigned_to = Number(assignedTo);
      else payload.assigned_group = Number(assignedGroup);

      const res = await api.post('/tasks/tasks/', payload);
      onCreated(res.data);
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: Record<string, string[]> } };
      const msg = Object.values(e.response?.data ?? {}).flat().join('; ');
      setError(msg || 'Ошибка при создании задачи');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Новая задача</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-2 text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Заголовок</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Что нужно сделать?" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Детали, ссылки..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Назначить</label>
            <div className="flex gap-2 mb-3">
              {(['person', 'group'] as const).map(t => (
                <button key={t} type="button" onClick={() => setAssignType(t)}
                  className={`flex-1 py-1.5 rounded-lg text-sm border transition-colors ${
                    assignType === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}>{t === 'person' ? 'Человеку' : 'Группе'}</button>
              ))}
            </div>
            {assignType === 'person' ? (
              <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— выберите сотрудника —</option>
                {staffList.map(u => <option key={u.id} value={u.id}>{u.last_name} {u.first_name}</option>)}
              </select>
            ) : (
              <select value={assignedGroup} onChange={e => setAssignedGroup(e.target.value)} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— выберите группу —</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Срок (необязательно)</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50">Отмена</button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Модал переназначения ─────────────────────────────────────────────────────

function ReassignModal({
  task, groups, staffList, onClose, onReassigned,
}: {
  task: Task;
  groups: TaskGroup[];
  staffList: StaffUser[];
  onClose: () => void;
  onReassigned: (updated: Task) => void;
}) {
  const [assignType, setAssignType] = useState<'person' | 'group'>(
    task.assigned_group ? 'group' : 'person'
  );
  const [assignedTo, setAssignedTo] = useState(String(task.assigned_to ?? ''));
  const [assignedGroup, setAssignedGroup] = useState(String(task.assigned_group ?? ''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {};
      if (assignType === 'person') payload.assigned_to = Number(assignedTo);
      else payload.assigned_group = Number(assignedGroup);
      const res = await api.post(`/tasks/tasks/${task.id}/reassign/`, payload);
      onReassigned(res.data);
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error ?? 'Ошибка при переназначении');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Переназначить задачу</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-gray-500">Задача вернётся в статус «Поставленная».</p>
          {error && <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-2 text-sm">{error}</div>}
          <div className="flex gap-2">
            {(['person', 'group'] as const).map(t => (
              <button key={t} type="button" onClick={() => setAssignType(t)}
                className={`flex-1 py-1.5 rounded-lg text-sm border transition-colors ${
                  assignType === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}>{t === 'person' ? 'Человеку' : 'Группе'}</button>
            ))}
          </div>
          {assignType === 'person' ? (
            <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— выберите сотрудника —</option>
              {staffList.map(u => <option key={u.id} value={u.id}>{u.last_name} {u.first_name}</option>)}
            </select>
          ) : (
            <select value={assignedGroup} onChange={e => setAssignedGroup(e.target.value)} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— выберите группу —</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50">Отмена</button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Сохранение...' : 'Переназначить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Вкладка групп ────────────────────────────────────────────────────────────

function GroupsTab({ groups, staffList, isAdmin, onGroupsChange }: {
  groups: TaskGroup[];
  staffList: StaffUser[];
  isAdmin: boolean;
  onGroupsChange: () => void;
}) {
  const [newGroupName, setNewGroupName] = useState('');
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const createGroup = async (e: FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setCreating(true);
    try {
      await api.post('/tasks/groups/', { name: newGroupName.trim() });
      setNewGroupName('');
      onGroupsChange();
    } finally {
      setCreating(false);
    }
  };

  const deleteGroup = async (id: number) => {
    if (!confirm('Удалить группу?')) return;
    await api.delete(`/tasks/groups/${id}/`);
    onGroupsChange();
  };

  const toggleMember = async (groupId: number, userId: number, isMember: boolean) => {
    await api.post(`/tasks/groups/${groupId}/members/`, { user_id: userId, action: isMember ? 'remove' : 'add' });
    onGroupsChange();
  };

  const joinLeave = async (groupId: number, isMember: boolean) => {
    await api.post(`/tasks/groups/${groupId}/members/`, { action: isMember ? 'remove' : 'add' });
    onGroupsChange();
  };

  return (
    <div className="max-w-2xl space-y-4">
      {isAdmin && (
        <form onSubmit={createGroup} className="flex gap-3">
          <input type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
            placeholder="Название новой группы"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button type="submit" disabled={creating || !newGroupName.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap">
            + Создать группу
          </button>
        </form>
      )}

      {groups.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">Групп пока нет</p>
          {isAdmin && <p className="text-sm mt-1">Создайте первую группу выше</p>}
        </div>
      )}

      {groups.map(group => (
        <div key={group.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <button onClick={() => setExpandedId(expandedId === group.id ? null : group.id)}
              className="flex items-center gap-2 text-left min-w-0">
              <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${expandedId === group.id ? 'rotate-90' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <span className="font-semibold text-gray-900">{group.name}</span>
              <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                {group.members_detail.length} участн.
              </span>
              {group.is_member && (
                <span className="text-xs text-blue-600 bg-blue-50 rounded-full px-2 py-0.5">вы участник</span>
              )}
            </button>
            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
              {!isAdmin && (
                <button onClick={() => joinLeave(group.id, group.is_member)}
                  className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    group.is_member ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}>
                  {group.is_member ? 'Покинуть' : 'Вступить'}
                </button>
              )}
              {isAdmin && (
                <button onClick={() => deleteGroup(group.id)}
                  className="text-sm px-3 py-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors">
                  Удалить
                </button>
              )}
            </div>
          </div>

          {expandedId === group.id && (
            <div className="border-t border-gray-100 px-5 py-4">
              {isAdmin ? (
                <div className="grid grid-cols-2 gap-2">
                  {staffList.map(user => {
                    const isMember = group.members.includes(user.id);
                    return (
                      <button key={user.id} onClick={() => toggleMember(group.id, user.id, isMember)}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm border transition-colors text-left ${
                          isMember ? 'bg-blue-50 border-blue-300 text-blue-800' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}>
                        <div className={`w-4 h-4 rounded flex-shrink-0 border-2 flex items-center justify-center ${
                          isMember ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                        }`}>
                          {isMember && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M1.5 5l2.5 2.5 4.5-4.5" />
                            </svg>
                          )}
                        </div>
                        <span className="truncate">{user.last_name} {user.first_name}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-1">
                  {group.members_detail.length === 0
                    ? <p className="text-sm text-gray-400">Участников пока нет</p>
                    : group.members_detail.map(m => (
                        <div key={m.id} className="text-sm text-gray-700">{m.last_name} {m.first_name}</div>
                      ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Карточка задачи ──────────────────────────────────────────────────────────

function TaskCard({ task, onStatusChange, onDelete, onReassign, onTaskUpdate, onDragStart, onHide }: {
  task: Task;
  onStatusChange: (task: Task, to: TaskStatus) => void;
  onDelete: (task: Task) => void;
  onReassign: (task: Task) => void;
  onTaskUpdate: (task: Task) => void;
  onDragStart: (taskId: number) => void;
  onHide?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const transitions = getTransitions(task);

  const dueDateLabel = task.due_date
    ? new Date(task.due_date + 'T00:00:00').toLocaleDateString('ru', { day: 'numeric', month: 'short' })
    : null;
  const isPast = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post(`/tasks/tasks/${task.id}/files/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onTaskUpdate({ ...task, files: [...task.files, res.data] });
    } catch {
      alert('Ошибка при загрузке файла');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteFile = async (fileId: number) => {
    await api.delete(`/tasks/tasks/${task.id}/files/${fileId}/`);
    onTaskUpdate({ ...task, files: task.files.filter(f => f.id !== fileId) });
  };

  return (
    <div
      draggable={task.status !== 'done'}
      onDragStart={e => {
        e.dataTransfer.setData('taskId', String(task.id));
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(task.id);
      }}
      className={`bg-white rounded-xl border border-gray-200 shadow-sm transition-shadow select-none ${
        task.status !== 'done' ? 'cursor-grab active:cursor-grabbing hover:shadow-md' : ''
      }`}
    >
      {/* Заголовок карточки */}
      <button className="w-full text-left px-4 py-3" onClick={() => setExpanded(v => !v)}>
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium text-gray-900 leading-snug">{task.title}</span>
          <div className="flex items-center gap-1 flex-shrink-0">
            {dueDateLabel && (
              <span className={`text-xs whitespace-nowrap px-1.5 py-0.5 rounded-full ${
                isPast ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
              }`}>{dueDateLabel}</span>
            )}
            {onHide && (
              <span
                role="button"
                onClick={e => { e.stopPropagation(); onHide(); }}
                className="text-gray-300 hover:text-gray-500 transition-colors text-base leading-none px-1 -mr-1"
                title="Скрыть задачу">
                ×
              </span>
            )}
          </div>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {task.assigned_to_name && (
            <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">{task.assigned_to_name}</span>
          )}
          {task.assigned_group_name && (
            <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">{task.assigned_group_name}</span>
          )}
          {task.taken_by_name && (
            <span className="text-xs text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">
              взял: {task.taken_by_name}
            </span>
          )}
          {task.files.length > 0 && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <FileIcon /> {task.files.length}
            </span>
          )}
        </div>
      </button>

      {/* Раскрытая часть */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
          {/* Описание с активными ссылками */}
          {task.description && (
            <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
              {linkify(task.description)}
            </p>
          )}

          {/* Мета-информация */}
          <div className="text-xs text-gray-400 space-y-0.5">
            <div>Постановщик: {task.created_by_name}</div>
            {task.taken_by_name && <div>Взял в работу: {task.taken_by_name}</div>}
          </div>

          {/* Файлы */}
          {task.files.length > 0 && (
            <div className="space-y-1.5">
              {task.files.map(f => (
                <div key={f.id} className="flex items-center gap-2 text-sm">
                  <FileIcon />
                  <a href={f.url} target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-blue-600 hover:underline truncate flex-1">
                    {f.original_name}
                  </a>
                  <button onClick={() => handleDeleteFile(f.id)}
                    className="text-gray-300 hover:text-red-500 flex-shrink-0 transition-colors" title="Удалить файл">
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Прикрепить файл — недоступно для выполненных */}
          {task.status !== 'done' && (
            <div>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
              <button onClick={() => fileInputRef.current?.click()} disabled={uploadingFile}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition-colors disabled:opacity-50">
                <FileIcon />
                {uploadingFile ? 'Загрузка...' : 'Прикрепить файл'}
              </button>
            </div>
          )}

          {/* Кнопки переходов */}
          {transitions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {transitions.map(t => (
                <button key={t.to} onClick={() => onStatusChange(task, t.to)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    t.to === 'done'
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : t.to === 'in_progress' && task.status === 'review'
                      ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {/* Переназначить и удалить — переназначение недоступно для выполненных */}
          <div className="flex items-center justify-between pt-1">
            {task.can_reassign && task.status !== 'done' && (
              <button onClick={() => onReassign(task)}
                className="text-xs text-gray-500 hover:text-blue-600 transition-colors">
                Переназначить
              </button>
            )}
            {task.created_by === task.created_by /* всегда true, просто выравнивание */ && (
              <button onClick={() => onDelete(task)}
                className={`text-xs text-red-400 hover:text-red-600 transition-colors ${!task.can_reassign ? 'ml-auto' : ''}`}>
                Удалить
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Таблица выполненных ──────────────────────────────────────────────────────

type SortField = 'title' | 'created_by_name' | 'created_at' | 'taken_by_name' | 'completed_at';
type SortDir = 'asc' | 'desc';

function fmt(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ru', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function DoneTable({ tasks, onDelete, onTaskUpdate }: {
  tasks: Task[];
  onDelete: (task: Task) => void;
  onTaskUpdate: (task: Task) => void;
}) {
  const [sortField, setSortField] = useState<SortField>('completed_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filterCreator, setFilterCreator] = useState('');
  const [filterExecutor, setFilterExecutor] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<number | null>(null);

  const creators = Array.from(new Set(tasks.map(t => t.created_by_name))).sort();
  const executors = Array.from(new Set(tasks.map(t => t.taken_by_name ?? '—'))).sort();

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const filtered = tasks.filter(t => {
    if (filterCreator && t.created_by_name !== filterCreator) return false;
    if (filterExecutor && (t.taken_by_name ?? '—') !== filterExecutor) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let va: string = '', vb: string = '';
    if (sortField === 'title') { va = a.title; vb = b.title; }
    else if (sortField === 'created_by_name') { va = a.created_by_name; vb = b.created_by_name; }
    else if (sortField === 'taken_by_name') { va = a.taken_by_name ?? ''; vb = b.taken_by_name ?? ''; }
    else if (sortField === 'created_at') { va = a.created_at; vb = b.created_at; }
    else if (sortField === 'completed_at') { va = a.completed_at ?? ''; vb = b.completed_at ?? ''; }
    const cmp = va.localeCompare(vb, 'ru');
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const taskId = uploadTargetRef.current;
    if (!file || !taskId) return;
    setUploadingId(taskId);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post(`/tasks/tasks/${taskId}/files/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const task = tasks.find(t => t.id === taskId);
      if (task) onTaskUpdate({ ...task, files: [...task.files, res.data] });
    } catch {
      alert('Ошибка при загрузке файла');
    } finally {
      setUploadingId(null);
      uploadTargetRef.current = null;
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteFile = async (task: Task, fileId: number) => {
    await api.delete(`/tasks/tasks/${task.id}/files/${fileId}/`);
    onTaskUpdate({ ...task, files: task.files.filter(f => f.id !== fileId) });
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="text-blue-500 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const thCls = 'px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap cursor-pointer select-none hover:text-gray-700 transition-colors';

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <p className="text-lg">Выполненных задач нет</p>
      </div>
    );
  }

  return (
    <div>
      {/* Фильтры */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500 whitespace-nowrap">Постановщик:</label>
          <select value={filterCreator} onChange={e => setFilterCreator(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Все</option>
            {creators.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500 whitespace-nowrap">Исполнитель:</label>
          <select value={filterExecutor} onChange={e => setFilterExecutor(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Все</option>
            {executors.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        {(filterCreator || filterExecutor) && (
          <button onClick={() => { setFilterCreator(''); setFilterExecutor(''); }}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            × сбросить
          </button>
        )}
        <span className="ml-auto text-sm text-gray-400 self-center">{sorted.length} задач</span>
      </div>

      {/* Таблица */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className={thCls} onClick={() => handleSort('title')}>
                  Задача <SortIcon field="title" />
                </th>
                <th className={thCls} onClick={() => handleSort('created_by_name')}>
                  Постановщик <SortIcon field="created_by_name" />
                </th>
                <th className={thCls} onClick={() => handleSort('created_at')}>
                  Поставлена <SortIcon field="created_at" />
                </th>
                <th className={thCls} onClick={() => handleSort('taken_by_name')}>
                  Исполнитель <SortIcon field="taken_by_name" />
                </th>
                <th className={thCls} onClick={() => handleSort('completed_at')}>
                  Выполнена <SortIcon field="completed_at" />
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(task => (
                <>
                  <tr
                    key={task.id}
                    onClick={() => setExpandedId(expandedId === task.id ? null : task.id)}
                    className={`border-b border-gray-100 cursor-pointer transition-colors ${
                      expandedId === task.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <svg className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform ${expandedId === task.id ? 'rotate-90' : ''}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="font-medium text-gray-900">{task.title}</span>
                        {task.files.length > 0 && (
                          <span className="flex items-center gap-0.5 text-xs text-gray-400 flex-shrink-0">
                            <FileIcon /> {task.files.length}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{task.created_by_name}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmt(task.created_at)}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{task.taken_by_name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmt(task.completed_at)}</td>
                  </tr>
                  {expandedId === task.id && (
                    <tr key={`${task.id}-detail`} className="bg-blue-50 border-b border-gray-100">
                      <td colSpan={5} className="px-6 py-4">
                        <div className="space-y-3 max-w-3xl">
                          {task.description ? (
                            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                              {linkify(task.description)}
                            </p>
                          ) : (
                            <p className="text-sm text-gray-400 italic">Описание не указано</p>
                          )}
                          {task.files.length > 0 && (
                            <div className="space-y-1.5">
                              {task.files.map(f => (
                                <div key={f.id} className="flex items-center gap-2 text-sm">
                                  <FileIcon />
                                  <a href={f.url} target="_blank" rel="noopener noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    className="text-blue-600 hover:underline truncate">
                                    {f.original_name}
                                  </a>
                                  <button onClick={e => { e.stopPropagation(); handleDeleteFile(task, f.id); }}
                                    className="text-gray-300 hover:text-red-500 flex-shrink-0 transition-colors" title="Удалить файл">
                                    &times;
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center justify-between pt-1">
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                uploadTargetRef.current = task.id;
                                fileInputRef.current?.click();
                              }}
                              disabled={uploadingId === task.id}
                              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition-colors disabled:opacity-50">
                              <FileIcon />
                              {uploadingId === task.id ? 'Загрузка...' : 'Прикрепить файл'}
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); onDelete(task); }}
                              className="text-xs text-red-400 hover:text-red-600 transition-colors">
                              Удалить задачу
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Главная страница ─────────────────────────────────────────────────────────

export default function TasksPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'tasks' | 'done' | 'groups'>('tasks');
  const [hiddenDoneIds, setHiddenDoneIds] = useState<Set<number>>(() => {
    try {
      const stored = localStorage.getItem('hiddenDoneTasks');
      return stored ? new Set<number>(JSON.parse(stored)) : new Set<number>();
    } catch { return new Set<number>(); }
  });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [reassignTask, setReassignTask] = useState<Task | null>(null);
  const [filter, setFilter] = useState<'all' | 'mine' | 'created'>('all');

  const draggedTaskIdRef = useRef<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);

  const isStaff = user?.is_admin || user?.is_teacher;

  const loadData = useCallback(async () => {
    try {
      const [tasksRes, groupsRes] = await Promise.all([
        api.get('/tasks/tasks/'),
        api.get('/tasks/groups/'),
      ]);
      setTasks(tasksRes.data);
      setGroups(groupsRes.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    if (isStaff) {
      api.get('/tasks/staff/').then(res => setStaffList(res.data)).catch(() => {});
    }
  }, [loadData, isStaff]);

  const updateTask = (updated: Task) => {
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
    // Если задача вышла из done — убрать из скрытых
    if (updated.status !== 'done') {
      setHiddenDoneIds(prev => {
        if (!prev.has(updated.id)) return prev;
        const next = new Set(prev);
        next.delete(updated.id);
        localStorage.setItem('hiddenDoneTasks', JSON.stringify([...next]));
        return next;
      });
    }
  };

  const hideTask = (taskId: number) => {
    setHiddenDoneIds(prev => {
      const next = new Set(prev);
      next.add(taskId);
      localStorage.setItem('hiddenDoneTasks', JSON.stringify([...next]));
      return next;
    });
  };

  const showAllHidden = () => {
    setHiddenDoneIds(new Set());
    localStorage.removeItem('hiddenDoneTasks');
  };

  const handleStatusChange = async (task: Task, to: TaskStatus) => {
    try {
      const res = await api.post(`/tasks/tasks/${task.id}/status/`, { status: to });
      updateTask(res.data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      alert(e.response?.data?.error ?? 'Ошибка при смене статуса');
    }
  };

  const handleDelete = async (task: Task) => {
    if (!confirm(`Удалить задачу "${task.title}"?`)) return;
    try {
      await api.delete(`/tasks/tasks/${task.id}/`);
      setTasks(prev => prev.filter(t => t.id !== task.id));
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      alert(e.response?.data?.error ?? 'Ошибка при удалении');
    }
  };

  const handleReassigned = (updated: Task) => {
    updateTask(updated);
    setReassignTask(null);
  };

  // DnD
  const handleDragOver = (e: React.DragEvent, colStatus: TaskStatus) => {
    if (colStatus === 'done') return;
    const taskId = draggedTaskIdRef.current;
    if (!taskId) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task || !canDropTo(task, colStatus)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(colStatus);
  };

  const handleDrop = async (e: React.DragEvent, colStatus: TaskStatus) => {
    e.preventDefault();
    setDragOverCol(null);
    const taskId = Number(e.dataTransfer.getData('taskId'));
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === colStatus || colStatus === 'done') return;
    await handleStatusChange(task, colStatus);
    draggedTaskIdRef.current = null;
  };

  const filteredTasks = tasks.filter(t => {
    if (filter === 'mine') return t.is_assignee;
    if (filter === 'created') return t.created_by === user?.id;
    return true;
  });

  const byStatus = (status: TaskStatus) => filteredTasks.filter(t => t.status === status);

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-gray-400">Загрузка...</div>;
  }

  return (
    <div>
      {/* Шапка */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Задачи</h1>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button onClick={() => setActiveTab('tasks')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'tasks' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}>
              Задачи
            </button>
            <button onClick={() => setActiveTab('done')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'done' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}>
              Выполненные
              {tasks.filter(t => t.status === 'done').length > 0 && (
                <span className="ml-1 text-xs text-gray-400">
                  {tasks.filter(t => t.status === 'done').length}
                </span>
              )}
            </button>
            <button onClick={() => setActiveTab('groups')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'groups' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {`Группы${groups.length > 0 ? ` (${groups.length})` : ''}`}
            </button>
          </div>
        </div>
        {activeTab === 'tasks' && isStaff && (
          <button onClick={() => setShowCreate(true)}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
            + Создать задачу
          </button>
        )}
      </div>

      {/* Вкладка групп */}
      {activeTab === 'groups' && (
        <GroupsTab groups={groups} staffList={staffList} isAdmin={user?.is_admin ?? false} onGroupsChange={loadData} />
      )}

      {/* Вкладка задач */}
      {activeTab === 'tasks' && (
        <>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-5">
            {(['all', 'mine', 'created'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  filter === f ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {f === 'all' ? 'Все' : f === 'mine' ? 'Мои' : 'Поставленные мной'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {COLUMNS.map(col => {
              const colTasks = byStatus(col.status);
              const isDragTarget = dragOverCol === col.status;
              const isDragging = draggedTaskIdRef.current !== null;
              const canAccept = col.status !== 'done' && isDragging;

              return (
                <div key={col.status}
                  onDragOver={e => handleDragOver(e, col.status)}
                  onDragLeave={() => setDragOverCol(null)}
                  onDrop={e => handleDrop(e, col.status)}
                  onDragEnd={() => { draggedTaskIdRef.current = null; setDragOverCol(null); }}
                  className={`rounded-xl border p-3 transition-all ${
                    isDragTarget ? col.colorDrag : `${col.colorBg} ${col.colorBorder} ${canAccept ? 'border-dashed' : ''}`
                  }`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-semibold text-gray-700">{col.label}</span>
                    {colTasks.length > 0 && (
                      <span className="text-xs bg-white rounded-full px-2 py-0.5 text-gray-500 font-medium border border-gray-200">
                        {colTasks.length}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 min-h-[4rem]">
                    {colTasks.length === 0 && (
                      <p className={`text-xs text-center py-6 ${isDragTarget ? 'text-blue-500' : 'text-gray-400'}`}>
                        {isDragTarget ? 'Отпустите здесь' : 'Нет задач'}
                      </p>
                    )}
                    {colTasks.map(task => (
                      <TaskCard key={task.id} task={task}
                        onStatusChange={handleStatusChange}
                        onDelete={handleDelete}
                        onReassign={setReassignTask}
                        onTaskUpdate={updateTask}
                        onDragStart={id => { draggedTaskIdRef.current = id; }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Колонка выполненных — всегда видна */}
            {(() => {
              const allDone = byStatus('done');
              const visibleDone = allDone.filter(t => !hiddenDoneIds.has(t.id));
              const hiddenCount = allDone.length - visibleDone.length;
              return (
                <div className={`rounded-xl border p-3 ${DONE_COL.colorBg} ${DONE_COL.colorBorder}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-semibold text-gray-700">{DONE_COL.label}</span>
                    {allDone.length > 0 && (
                      <span className="text-xs bg-white rounded-full px-2 py-0.5 text-gray-500 font-medium border border-gray-200">
                        {visibleDone.length}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 min-h-[4rem]">
                    {allDone.length === 0 && (
                      <p className="text-xs text-center py-6 text-gray-400">Нет задач</p>
                    )}
                    {visibleDone.map(task => (
                      <TaskCard key={task.id} task={task}
                        onStatusChange={handleStatusChange}
                        onDelete={handleDelete}
                        onReassign={setReassignTask}
                        onTaskUpdate={updateTask}
                        onDragStart={id => { draggedTaskIdRef.current = id; }}
                        onHide={() => hideTask(task.id)}
                      />
                    ))}
                    {hiddenCount > 0 && (
                      <div className="text-center pt-1">
                        <button onClick={showAllHidden}
                          className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                          ещё {hiddenCount} скрыто — показать
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </>
      )}

      {/* Вкладка выполненных */}
      {activeTab === 'done' && (
        <DoneTable
          tasks={tasks.filter(t => t.status === 'done')}
          onDelete={handleDelete}
          onTaskUpdate={updateTask}
        />
      )}

      {/* Модалы */}
      {showCreate && (
        <CreateTaskModal groups={groups} staffList={staffList}
          onClose={() => setShowCreate(false)}
          onCreated={task => setTasks(prev => [task, ...prev])} />
      )}
      {reassignTask && (
        <ReassignModal task={reassignTask} groups={groups} staffList={staffList}
          onClose={() => setReassignTask(null)}
          onReassigned={handleReassigned} />
      )}
    </div>
  );
}
