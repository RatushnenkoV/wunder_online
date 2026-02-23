import { useState } from 'react';
import api from '../../api/client';
import type { GroupDetail, GroupMessage } from '../../types';

interface Props {
  group: GroupDetail;
  onClose: () => void;
  onCreated: (message: GroupMessage) => void;
}

export default function CreateTaskModal({ group, onClose, onCreated }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleAssignee = (id: number) => {
    setAssigneeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError('Введите название задачи.');
    setSaving(true);
    setError('');
    try {
      const res = await api.post(`/groups/${group.id}/messages/task/`, {
        title: title.trim(),
        description,
        deadline: deadline || null,
        assignee_ids: Array.from(assigneeIds),
      });
      onCreated(res.data);
    } catch {
      setError('Не удалось создать задачу.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-semibold">Новая задача</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="px-5 py-4 space-y-3 overflow-y-auto flex-1">
            {error && <p className="text-red-600 text-sm">{error}</p>}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Название *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="Что нужно сделать?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                placeholder="Подробное описание задачи..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Дедлайн (необязательно)</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Исполнители</label>
              <div className="border border-gray-200 rounded-lg divide-y max-h-40 overflow-y-auto">
                {group.members.length === 0 && (
                  <p className="text-sm text-gray-400 p-3">Нет участников в группе</p>
                )}
                {group.members.map((m) => (
                  <label key={m.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={assigneeIds.has(m.id)}
                      onChange={() => toggleAssignee(m.id)}
                      className="rounded text-blue-500"
                    />
                    <span className="text-sm text-gray-700">{m.last_name} {m.first_name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="px-5 py-4 border-t flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Создание...' : 'Создать задачу'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
