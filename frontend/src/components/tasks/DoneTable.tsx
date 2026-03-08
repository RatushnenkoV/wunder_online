import { useState, useRef } from 'react';
import type { ChangeEvent } from 'react';
import api from '../../api/client';
import type { Task } from '../../types';
import FileIcon from './FileIcon';
import { linkify } from './utils';

type SortField = 'title' | 'created_by_name' | 'created_at' | 'taken_by_name' | 'completed_at';
type SortDir = 'asc' | 'desc';

function fmt(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ru', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

interface DoneTableProps {
  tasks: Task[];
  onDelete: (task: Task) => void;
  onTaskUpdate: (task: Task) => void;
}

export default function DoneTable({ tasks, onDelete, onTaskUpdate }: DoneTableProps) {
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
    if (sortField !== field) return <span className="text-gray-300 dark:text-slate-600 ml-1">↕</span>;
    return <span className="text-purple-500 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const thCls = 'px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap cursor-pointer select-none hover:text-gray-700 transition-colors';

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400 dark:text-slate-500">
        <p className="text-lg">Выполненных задач нет</p>
      </div>
    );
  }

  return (
    <div>
      {/* Фильтры */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500 dark:text-slate-400 whitespace-nowrap">Постановщик:</label>
          <select value={filterCreator} onChange={e => setFilterCreator(e.target.value)}
            className="border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
            <option value="">Все</option>
            {creators.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500 dark:text-slate-400 whitespace-nowrap">Исполнитель:</label>
          <select value={filterExecutor} onChange={e => setFilterExecutor(e.target.value)}
            className="border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
            <option value="">Все</option>
            {executors.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        {(filterCreator || filterExecutor) && (
          <button onClick={() => { setFilterCreator(''); setFilterExecutor(''); }}
            className="text-sm text-gray-400 dark:text-slate-500 hover:text-gray-600 transition-colors">
            × сбросить
          </button>
        )}
        <span className="ml-auto text-sm text-gray-400 dark:text-slate-500 self-center">{sorted.length} задач</span>
      </div>

      {/* Таблица */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700">
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
                    className={`border-b border-gray-100 dark:border-slate-700 cursor-pointer transition-colors ${
                      expandedId === task.id ? 'bg-purple-50' : 'hover:bg-gray-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <svg className={`w-3.5 h-3.5 text-gray-400 dark:text-slate-500 flex-shrink-0 transition-transform ${expandedId === task.id ? 'rotate-90' : ''}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="font-medium text-gray-900 dark:text-slate-100">{task.title}</span>
                        {task.files.length > 0 && (
                          <span className="flex items-center gap-0.5 text-xs text-gray-400 dark:text-slate-500 flex-shrink-0">
                            <FileIcon /> {task.files.length}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-slate-400 whitespace-nowrap">{task.created_by_name}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400 whitespace-nowrap">{fmt(task.created_at)}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-slate-400 whitespace-nowrap">{task.taken_by_name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400 whitespace-nowrap">{fmt(task.completed_at)}</td>
                  </tr>
                  {expandedId === task.id && (
                    <tr key={`${task.id}-detail`} className="bg-purple-50 border-b border-gray-100 dark:border-slate-700">
                      <td colSpan={5} className="px-6 py-4">
                        <div className="space-y-3 max-w-3xl">
                          {task.description ? (
                            <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                              {linkify(task.description)}
                            </p>
                          ) : (
                            <p className="text-sm text-gray-400 dark:text-slate-500 italic">Описание не указано</p>
                          )}
                          {task.files.length > 0 && (
                            <div className="space-y-1.5">
                              {task.files.map(f => (
                                <div key={f.id} className="flex items-center gap-2 text-sm">
                                  <FileIcon />
                                  <a href={f.url} target="_blank" rel="noopener noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    className="text-purple-600 hover:underline truncate">
                                    {f.original_name}
                                  </a>
                                  <button onClick={e => { e.stopPropagation(); handleDeleteFile(task, f.id); }}
                                    className="text-gray-300 dark:text-slate-600 hover:text-red-500 flex-shrink-0 transition-colors" title="Удалить файл">
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
                              className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400 hover:text-purple-600 transition-colors disabled:opacity-50">
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
