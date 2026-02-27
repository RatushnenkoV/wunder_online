import { useState, useEffect } from 'react';
import api from '../../api/client';
import type { ChatRoom, ChatUser } from '../../types';

interface Props {
  onClose: () => void;
  onCreated: (room: ChatRoom) => void;
}

export default function CreateGroupModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [allUsers, setAllUsers] = useState<ChatUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ChatUser[]>([]);
  const [saving, setSaving] = useState(false);

  // Загрузить всех доступных пользователей при открытии
  useEffect(() => {
    setLoading(true);
    api.get('/chat/users/')
      .then((res) => setAllUsers(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Серверная фильтрация при вводе (debounce 250ms)
  useEffect(() => {
    if (!search.trim()) return;
    const timer = setTimeout(() => {
      api.get(`/chat/users/?q=${encodeURIComponent(search)}`)
        .then((res) => setAllUsers(res.data))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const toggle = (u: ChatUser) => {
    setSelected((prev) =>
      prev.find((x) => x.id === u.id) ? prev.filter((x) => x.id !== u.id) : [...prev, u]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await api.post('/chat/rooms/', {
        name: name.trim(),
        member_ids: selected.map((u) => u.id),
      });
      onCreated(res.data);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  // Клиентская фильтрация для мгновенного отклика
  const displayed = search.trim()
    ? allUsers.filter((u) =>
        u.display_name.toLowerCase().includes(search.toLowerCase())
      )
    : allUsers;

  const selectedIds = new Set(selected.map((u) => u.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[80vh]">
        <div className="px-6 py-4 flex items-center justify-between" style={{ boxShadow: '0 1px 0 #f0f0f0' }}>
          <h2 className="text-lg font-semibold text-gray-800">Новая группа</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
            {/* Название */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Название группы</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: Педсовет"
                className="w-full bg-gray-50 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                required
              />
            </div>

            {/* Участники */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Участники{selected.length > 0 && ` (${selected.length})`}
              </label>

              {/* Выбранные чипы */}
              {selected.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selected.map((u) => (
                    <span key={u.id} className="flex items-center gap-1 bg-blue-100 text-blue-700 rounded-full px-2.5 py-0.5 text-xs font-medium">
                      {u.display_name}
                      <button type="button" onClick={() => toggle(u)} className="hover:text-blue-900 ml-0.5">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по имени..."
                className="w-full bg-gray-50 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />

              <div className="mt-1 rounded-xl overflow-hidden max-h-48 overflow-y-auto bg-gray-50">
                {loading && (
                  <p className="text-center text-sm text-gray-400 py-4">Загрузка...</p>
                )}
                {!loading && displayed.length === 0 && (
                  <p className="text-center text-sm text-gray-400 py-4">Никого не найдено</p>
                )}
                {displayed.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggle(u)}
                    className={`w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-white transition-colors ${
                      selectedIds.has(u.id) ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 flex-shrink-0">
                      {u.last_name[0]}{u.first_name[0]}
                    </div>
                    <span className="text-sm text-gray-800 flex-1">{u.display_name}</span>
                    {selectedIds.has(u.id) && (
                      <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="px-6 py-4 flex justify-end gap-3" style={{ boxShadow: '0 -1px 0 #f0f0f0' }}>
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="px-5 py-2 bg-blue-500 text-white text-sm font-medium rounded-xl hover:bg-blue-600 disabled:opacity-50"
            >
              {saving ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
