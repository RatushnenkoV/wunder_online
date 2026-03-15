import { useState, useRef } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import api from '../../api/client';
import type { Task, TaskGroup, TaskFile, StaffUser, TaskPriority } from '../../types';
import FileIcon from './FileIcon';
import StaffPicker from './StaffPicker';

interface CreateTaskModalProps {
  groups: TaskGroup[];
  staffList: StaffUser[];
  onClose: () => void;
  onCreated: (task: Task) => void;
  initialTitle?: string;
  initialDescription?: string;
}

const PRIORITY_OPTIONS: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Не срочно', color: 'text-gray-500' },
  { value: 'medium', label: 'Средний', color: 'text-yellow-600' },
  { value: 'high', label: 'Срочный', color: 'text-red-600' },
];

export default function CreateTaskModal({
  groups, staffList, onClose, onCreated, initialTitle = '', initialDescription = '',
}: CreateTaskModalProps) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [assignType, setAssignType] = useState<'person' | 'group'>('person');
  const [assignedTo, setAssignedTo] = useState('');
  const [assignedGroup, setAssignedGroup] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('low');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload: Record<string, unknown> = { title, description, priority };
      if (dueDate) payload.due_date = dueDate;
      if (assignType === 'person') payload.assigned_to = Number(assignedTo);
      else payload.assigned_group = Number(assignedGroup);

      const res = await api.post('/tasks/tasks/', payload);
      const task = res.data;

      const uploadedFiles: TaskFile[] = [];
      for (const file of pendingFiles) {
        const form = new FormData();
        form.append('file', file);
        const fRes = await api.post(`/tasks/tasks/${task.id}/files/`, form);
        uploadedFiles.push(fRes.data);
      }

      onCreated({ ...task, files: uploadedFiles });
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
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Новая задача</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-2 text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Заголовок</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required
              className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Что нужно сделать?" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Описание</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              placeholder="Детали, ссылки..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Приоритет</label>
            <div className="flex gap-2">
              {PRIORITY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPriority(opt.value)}
                  className={`flex-1 py-1.5 rounded-lg text-sm border transition-colors ${
                    priority === opt.value
                      ? opt.value === 'high'
                        ? 'bg-red-600 text-white border-red-600'
                        : opt.value === 'medium'
                        ? 'bg-yellow-500 text-white border-yellow-500'
                        : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300 border-gray-300 dark:border-slate-600'
                      : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Назначить</label>
            <div className="flex gap-2 mb-3">
              {(['person', 'group'] as const).map(t => (
                <button key={t} type="button" onClick={() => setAssignType(t)}
                  className={`flex-1 py-1.5 rounded-lg text-sm border transition-colors ${
                    assignType === t ? 'bg-purple-600 text-white border-purple-600' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'
                  }`}>{t === 'person' ? 'Человеку' : 'Группе'}</button>
              ))}
            </div>
            {assignType === 'person' ? (
              <StaffPicker
                staffList={staffList}
                value={assignedTo}
                onChange={setAssignedTo}
                required
              />
            ) : (
              <select value={assignedGroup} onChange={e => setAssignedGroup(e.target.value)} required
                className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                <option value="">— выберите группу —</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Срок (необязательно)</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-slate-300">Вложения</label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-purple-600 hover:underline"
              >
                + Добавить файл
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const f = e.target.files?.[0];
                  if (f) setPendingFiles(prev => [...prev, f]);
                  e.target.value = '';
                }}
              />
            </div>
            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {pendingFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-gray-100 dark:bg-slate-700 rounded-lg px-3 py-1.5 text-xs text-gray-700 dark:text-slate-300">
                    <FileIcon />
                    <span className="max-w-[160px] truncate">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))}
                      className="text-gray-400 dark:text-slate-500 hover:text-red-500 ml-0.5"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700">Отмена</button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
              {loading ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
