import { useState } from 'react';
import type { FormEvent } from 'react';
import api from '../../api/client';
import type { Task, TaskGroup, StaffUser } from '../../types';
import StaffPicker from './StaffPicker';

interface ReassignModalProps {
  task: Task;
  groups: TaskGroup[];
  staffList: StaffUser[];
  onClose: () => void;
  onReassigned: (updated: Task) => void;
}

export default function ReassignModal({
  task, groups, staffList, onClose, onReassigned,
}: ReassignModalProps) {
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
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Переназначить задачу</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-gray-500 dark:text-slate-400">Задача вернётся в статус «Поставленная».</p>
          {error && <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-2 text-sm">{error}</div>}
          <div className="flex gap-2">
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
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700">Отмена</button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
              {loading ? 'Сохранение...' : 'Переназначить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
