import { useState, useEffect } from 'react';
import api from '../../api/client';
import type { GroupDetail, GroupMember, TeacherOption } from '../../types';

interface Props {
  group: GroupDetail;
  onClose: () => void;
  onUpdated: (group: GroupDetail) => void;
}

export default function GroupMembersModal({ group, onClose, onUpdated }: Props) {
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [loading, setLoading] = useState(false);

  const memberIds = new Set(group.members.map((m) => m.id));

  useEffect(() => {
    api.get('/school/teachers/').then((r) => setTeachers(r.data)).catch(() => {});
  }, []);

  const handleAdd = async (userId: number) => {
    setLoading(true);
    try {
      await api.post(`/groups/${group.id}/members/`, { user_id: userId });
      const res = await api.get(`/groups/${group.id}/`);
      onUpdated(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (userId: number) => {
    setLoading(true);
    try {
      await api.delete(`/groups/${group.id}/members/${userId}/`);
      const res = await api.get(`/groups/${group.id}/`);
      onUpdated(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-semibold">Участники — {group.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-5 py-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Текущие участники</h3>
            {group.members.length === 0 && (
              <p className="text-sm text-gray-400">Нет участников</p>
            )}
            {group.members.map((member: GroupMember) => (
              <div key={member.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <span className="text-sm text-gray-700">{member.last_name} {member.first_name}</span>
                <button
                  onClick={() => handleRemove(member.id)}
                  disabled={loading}
                  className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                >
                  Удалить
                </button>
              </div>
            ))}
          </div>

          <div className="px-5 py-3 border-t">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Добавить учителя</h3>
            {teachers.filter((t) => !memberIds.has(t.id)).length === 0 && (
              <p className="text-sm text-gray-400">Все учителя уже в группе</p>
            )}
            {teachers
              .filter((t) => !memberIds.has(t.id))
              .map((t) => (
                <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-700">{t.last_name} {t.first_name}</span>
                  <button
                    onClick={() => handleAdd(t.id)}
                    disabled={loading}
                    className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                  >
                    Добавить
                  </button>
                </div>
              ))}
          </div>
        </div>

        <div className="px-5 py-4 border-t">
          <button
            onClick={onClose}
            className="w-full py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
