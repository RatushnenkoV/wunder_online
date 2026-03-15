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
import TasksReportTab from '../components/tasks/TasksReportTab';

// ─── Главная страница ─────────────────────────────────────────────────────────

export default function TasksPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'tasks' | 'done' | 'groups' | 'report'>('tasks');
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
        api.get('/tasks/tasks/', { params: { page_size: 200 } }),
        api.get('/tasks/groups/'),
      ]);
      // Backend returns paginated response: { count, next, previous, results }
      const tasksData = tasksRes.data;
      setTasks(Array.isArray(tasksData) ? tasksData : (tasksData.results ?? []));
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

  // Обновление при переключении вкладки и по интервалу
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') loadData();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    const interval = setInterval(loadData, 30_000);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [loadData]);

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

  const handleStatusChange = async (task: Task, to: TaskStatus, comment?: string) => {
    try {
      const payload: Record<string, unknown> = { status: to };
      if (comment) payload.comment = comment;
      const res = await api.post(`/tasks/tasks/${task.id}/status/`, payload);
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
    return <div className="flex items-center justify-center py-24 text-gray-400 dark:text-slate-500">Загрузка...</div>;
  }

  return (
    <div>
      {/* Шапка */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Задачи</h1>
          <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 rounded-lg p-1">
            <button onClick={() => setActiveTab('tasks')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'tasks' ? 'bg-white dark:bg-slate-800 shadow text-gray-900 dark:text-slate-100' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700'
              }`}>
              Задачи
            </button>
            <button onClick={() => setActiveTab('done')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'done' ? 'bg-white dark:bg-slate-800 shadow text-gray-900 dark:text-slate-100' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700'
              }`}>
              Выполненные
              {tasks.filter(t => t.status === 'done').length > 0 && (
                <span className="ml-1 text-xs text-gray-400 dark:text-slate-500">
                  {tasks.filter(t => t.status === 'done').length}
                </span>
              )}
            </button>
            <button onClick={() => setActiveTab('groups')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'groups' ? 'bg-white dark:bg-slate-800 shadow text-gray-900 dark:text-slate-100' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700'
              }`}>
              {`Группы${groups.length > 0 ? ` (${groups.length})` : ''}`}
            </button>
            {user?.is_admin && (
              <button onClick={() => setActiveTab('report')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'report' ? 'bg-white dark:bg-slate-800 shadow text-gray-900 dark:text-slate-100' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700'
                }`}>
                Отчёт
              </button>
            )}
          </div>
        </div>
        {activeTab === 'tasks' && isStaff && (
          <button onClick={() => setShowCreate(true)}
            className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors">
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
          <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 rounded-lg p-1 w-fit mb-5">
            {(['all', 'mine', 'created'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  filter === f ? 'bg-white dark:bg-slate-800 shadow text-gray-900 dark:text-slate-100' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700'
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
                    <span className="text-sm font-semibold text-gray-700 dark:text-slate-300">{col.label}</span>
                    {colTasks.length > 0 && (
                      <span className="text-xs bg-white dark:bg-slate-800 rounded-full px-2 py-0.5 text-gray-500 dark:text-slate-400 font-medium border border-gray-200 dark:border-slate-700">
                        {colTasks.length}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 min-h-[4rem]">
                    {colTasks.length === 0 && (
                      <p className={`text-xs text-center py-6 ${isDragTarget ? 'text-purple-500' : 'text-gray-400 dark:text-slate-500'}`}>
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
                    <span className="text-sm font-semibold text-gray-700 dark:text-slate-300">{DONE_COL.label}</span>
                    {allDone.length > 0 && (
                      <span className="text-xs bg-white dark:bg-slate-800 rounded-full px-2 py-0.5 text-gray-500 dark:text-slate-400 font-medium border border-gray-200 dark:border-slate-700">
                        {visibleDone.length}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 min-h-[4rem]">
                    {allDone.length === 0 && (
                      <p className="text-xs text-center py-6 text-gray-400 dark:text-slate-500">Нет задач</p>
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
                          className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 transition-colors">
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

      {/* Вкладка отчёта (только admin) */}
      {activeTab === 'report' && user?.is_admin && (
        <TasksReportTab staffList={staffList} />
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
