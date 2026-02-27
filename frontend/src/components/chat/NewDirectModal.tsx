import { useState, useEffect, useRef } from 'react';
import api from '../../api/client';
import type { ChatRoom, ChatUser } from '../../types';

interface Props {
  onClose: () => void;
  onOpened: (room: ChatRoom) => void;
}

export default function NewDirectModal({ onClose, onOpened }: Props) {
  const [search, setSearch] = useState('');
  const [allUsers, setAllUsers] = useState<ChatUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const searchRef = useRef(search);
  searchRef.current = search;

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
    if (!search.trim()) return; // при пустом поиске показываем allUsers
    const timer = setTimeout(() => {
      api.get(`/chat/users/?q=${encodeURIComponent(search)}`)
        .then((res) => setAllUsers(res.data))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const open = async (userId: number) => {
    setOpening(true);
    try {
      const res = await api.post('/chat/direct/', { user_id: userId });
      onOpened(res.data);
    } catch { /* ignore */ }
    finally { setOpening(false); }
  };

  // Клиентская фильтрация для мгновенного отклика
  const displayed = search.trim()
    ? allUsers.filter((u) =>
        u.display_name.toLowerCase().includes(search.toLowerCase())
      )
    : allUsers;

  function roleLabel(u: ChatUser) {
    if (u.is_admin) return 'Администратор';
    if (u.is_teacher) return 'Учитель';
    if (u.is_student) return 'Ученик';
    if (u.is_parent) return 'Родитель';
    return '';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 flex flex-col max-h-[70vh]">
        <div className="px-5 py-4 flex items-center justify-between" style={{ boxShadow: '0 1px 0 #f0f0f0' }}>
          <h2 className="text-lg font-semibold text-gray-800">Новое сообщение</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-4 py-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени..."
            className="w-full bg-gray-50 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <p className="text-center text-sm text-gray-400 py-6">Загрузка...</p>
          )}
          {!loading && displayed.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-6">Никого не найдено</p>
          )}
          {displayed.map((u) => (
            <button
              key={u.id}
              onClick={() => open(u.id)}
              disabled={opening}
              className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700 flex-shrink-0">
                {u.last_name[0]}{u.first_name[0]}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">{u.display_name}</p>
                <p className="text-xs text-gray-400">{roleLabel(u)}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
