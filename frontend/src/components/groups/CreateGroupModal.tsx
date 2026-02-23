import { useState, useEffect } from 'react';
import api from '../../api/client';
import type { GroupDetail, TeacherOption } from '../../types';

interface Props {
  onClose: () => void;
  onCreated: (group: GroupDetail) => void;
}

export default function CreateGroupModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/school/teachers/').then((r) => setTeachers(r.data)).catch(() => {});
  }, []);

  const toggleTeacher = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Введите название группы.');
    setSaving(true);
    setError('');
    try {
      const createRes = await api.post('/groups/', { name: name.trim(), description });
      const group: GroupDetail = createRes.data;

      for (const userId of selectedIds) {
        await api.post(`/groups/${group.id}/members/`, { user_id: userId });
      }

      // Получить финальное состояние группы
      const detailRes = await api.get(`/groups/${group.id}/`);
      onCreated(detailRes.data);
    } catch {
      setError('Не удалось создать группу.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-semibold">Создать группу</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="px-5 py-4 space-y-3 overflow-y-auto flex-1">
            {error && <p className="text-red-600 text-sm">{error}</p>}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Название *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="Например: Методическое объединение"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                placeholder="Необязательно"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Добавить учителей</label>
              <div className="border border-gray-200 rounded-lg divide-y max-h-48 overflow-y-auto">
                {teachers.length === 0 && (
                  <p className="text-sm text-gray-400 p-3">Нет доступных учителей</p>
                )}
                {teachers.map((t) => (
                  <label key={t.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(t.id)}
                      onChange={() => toggleTeacher(t.id)}
                      className="rounded text-blue-500"
                    />
                    <span className="text-sm text-gray-700">{t.last_name} {t.first_name}</span>
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
              {saving ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
