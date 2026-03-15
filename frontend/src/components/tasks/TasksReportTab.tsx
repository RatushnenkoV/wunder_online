import { useState, useEffect, useCallback } from 'react';
import api from '../../api/client';
import type { Task, TaskStatus, TaskPriority, StaffUser } from '../../types';

// ─── helpers ──────────────────────────────────────────────────────────────────

function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isoWeekAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ru', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtShortDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00').toLocaleDateString('ru', { day: 'numeric', month: 'short', year: 'numeric' });
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  new: 'Поставленная',
  in_progress: 'В работе',
  review: 'На проверке',
  done: 'Выполнено',
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Не срочно',
  medium: 'Средний',
  high: 'Срочный',
};

const PRIORITY_CLS: Record<TaskPriority, string> = {
  low: 'text-gray-500',
  medium: 'text-yellow-600 font-medium',
  high: 'text-red-600 font-semibold',
};

// ─── Компонент ────────────────────────────────────────────────────────────────

interface Props {
  staffList: StaffUser[];
}

const PAGE_SIZE = 50;

export default function TasksReportTab({ staffList }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  // Фильтры — по умолчанию: последняя неделя
  const [dateFrom, setDateFrom] = useState(isoWeekAgo);
  const [dateTo, setDateTo] = useState(isoToday);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | ''>('');
  const [assignedToFilter, setAssignedToFilter] = useState('');
  const [createdByFilter, setCreatedByFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const buildParams = useCallback((extras: Record<string, unknown> = {}) => {
    const p: Record<string, unknown> = {};
    if (dateFrom) p.date_from = dateFrom;
    if (dateTo) p.date_to = dateTo;
    if (statusFilter) p.status = statusFilter;
    if (priorityFilter) p.priority = priorityFilter;
    if (assignedToFilter) p.assigned_to = assignedToFilter;
    if (createdByFilter) p.created_by = createdByFilter;
    if (search.trim()) p.search = search.trim();
    return { ...p, ...extras };
  }, [dateFrom, dateTo, statusFilter, priorityFilter, assignedToFilter, createdByFilter, search]);

  const loadTasks = useCallback(async (p: number) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/tasks/tasks/report/', {
        params: buildParams({ page: p, page_size: PAGE_SIZE }),
      });
      const data = res.data;
      setTasks(Array.isArray(data) ? data : (data.results ?? []));
      setTotal(typeof data.count === 'number' ? data.count : (Array.isArray(data) ? data.length : 0));
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string }; status?: number } };
      if (err.response?.status === 403) {
        setError('Нет доступа — только для администраторов.');
      } else {
        setError(err.response?.data?.error ?? 'Ошибка при загрузке отчёта.');
      }
      setTasks([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    setPage(1);
    loadTasks(1);
  }, [loadTasks]);

  const handlePageChange = (p: number) => {
    setPage(p);
    loadTasks(p);
  };

  const resetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setStatusFilter('');
    setPriorityFilter('');
    setAssignedToFilter('');
    setCreatedByFilter('');
    setSearch('');
  };

  const hasFilters = !!(dateFrom || dateTo || statusFilter || priorityFilter || assignedToFilter || createdByFilter || search);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get('/tasks/tasks/report/', {
        params: buildParams({ export: 'excel' }),
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'tasks_report.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Ошибка при выгрузке');
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const thCls = 'px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap';

  return (
    <div>
      {/* Фильтры */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Дата создания с</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Дата создания по</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Статус</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as TaskStatus | '')}
              className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
              <option value="">Все</option>
              {(Object.entries(STATUS_LABELS) as [TaskStatus, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Приоритет</label>
            <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value as TaskPriority | '')}
              className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
              <option value="">Все</option>
              {(Object.entries(PRIORITY_LABELS) as [TaskPriority, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Исполнитель</label>
            <select value={assignedToFilter} onChange={e => setAssignedToFilter(e.target.value)}
              className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
              <option value="">Все</option>
              {staffList.map(u => <option key={u.id} value={u.id}>{u.last_name} {u.first_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Постановщик</label>
            <select value={createdByFilter} onChange={e => setCreatedByFilter(e.target.value)}
              className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
              <option value="">Все</option>
              {staffList.map(u => <option key={u.id} value={u.id}>{u.last_name} {u.first_name}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Поиск по тексту</label>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Заголовок или описание..."
              className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
        </div>

        {/* Нижняя панель */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 dark:text-slate-400">
              {loading ? 'Загрузка...' : `${total} задач`}
            </span>
            {hasFilters && (
              <button
                onClick={resetFilters}
                className="text-sm text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
              >
                × сбросить фильтры
              </button>
            )}
          </div>
          <button
            onClick={handleExport}
            disabled={exporting || loading}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {exporting ? 'Выгрузка...' : 'Экспорт в Excel'}
          </button>
        </div>
      </div>

      {/* Ошибка */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">
          {error}
        </div>
      )}

      {/* Таблица */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700">
              <tr>
                <th className={thCls}>Задача</th>
                <th className={thCls}>Приоритет</th>
                <th className={thCls}>Статус</th>
                <th className={thCls}>Постановщик</th>
                <th className={thCls}>Исполнитель</th>
                <th className={thCls}>Взял в работу</th>
                <th className={thCls}>Срок</th>
                <th className={thCls}>Создана</th>
                <th className={thCls}>Выполнена</th>
              </tr>
            </thead>
            <tbody>
              {loading && tasks.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-gray-400 dark:text-slate-500">Загрузка...</td>
                </tr>
              )}
              {!loading && !error && tasks.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-12">
                    <p className="text-gray-400 dark:text-slate-500">Нет задач по выбранным фильтрам</p>
                    {hasFilters && (
                      <button
                        onClick={resetFilters}
                        className="mt-2 text-sm text-purple-600 hover:text-purple-700 transition-colors"
                      >
                        Сбросить все фильтры
                      </button>
                    )}
                  </td>
                </tr>
              )}
              {tasks.map(task => (
                <tr key={task.id} className="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                  <td className="px-3 py-3 max-w-[220px]">
                    <div className="font-medium text-gray-900 dark:text-slate-100 truncate" title={task.title}>{task.title}</div>
                    {task.description && (
                      <div className="text-xs text-gray-400 dark:text-slate-500 truncate mt-0.5" title={task.description}>{task.description}</div>
                    )}
                  </td>
                  <td className={`px-3 py-3 whitespace-nowrap text-sm ${PRIORITY_CLS[task.priority]}`}>
                    {PRIORITY_LABELS[task.priority]}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      task.status === 'done' ? 'bg-green-100 text-green-700' :
                      task.status === 'review' ? 'bg-blue-100 text-blue-700' :
                      task.status === 'in_progress' ? 'bg-purple-100 text-purple-700' :
                      'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400'
                    }`}>
                      {STATUS_LABELS[task.status]}
                    </span>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-gray-600 dark:text-slate-400">{task.created_by_name}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-gray-600 dark:text-slate-400">
                    {task.assigned_to_name ?? task.assigned_group_name ?? '—'}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-gray-500 dark:text-slate-400">{task.taken_by_name ?? '—'}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-gray-500 dark:text-slate-400">{fmtShortDate(task.due_date)}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-gray-500 dark:text-slate-400">{fmtDate(task.created_at)}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-gray-500 dark:text-slate-400">{fmtDate(task.completed_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Пагинация */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-slate-700">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40"
            >
              ← Назад
            </button>
            <span className="text-sm text-gray-500 dark:text-slate-400">
              Стр. {page} / {totalPages}
            </span>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40"
            >
              Вперёд →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
