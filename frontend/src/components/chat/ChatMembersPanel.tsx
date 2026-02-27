import { useState, useEffect } from 'react';
import api from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import type { ChatRoomDetail, ChatUser } from '../../types';

interface Props {
  room: ChatRoomDetail;
  onClose: () => void;
  onUpdated: (room: ChatRoomDetail) => void;
}

export default function ChatMembersPanel({ room, onClose, onUpdated }: Props) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState<ChatUser[]>([]);
  const [loading, setLoading] = useState(false);

  const isRoomAdmin = user?.is_admin;

  useEffect(() => {
    if (!search.trim() || !isRoomAdmin) return;
    const timer = setTimeout(() => {
      api.get(`/chat/users/?q=${encodeURIComponent(search)}`)
        .then((res) => setCandidates(res.data))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [search, isRoomAdmin]);

  const refresh = async () => {
    const res = await api.get(`/chat/rooms/${room.id}/`);
    onUpdated(res.data);
  };

  const addMember = async (userId: number) => {
    setLoading(true);
    try {
      await api.post(`/chat/rooms/${room.id}/members/`, { user_id: userId });
      await refresh();
      setSearch('');
      setCandidates([]);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const removeMember = async (userId: number) => {
    if (!confirm('Удалить участника?')) return;
    try {
      await api.delete(`/chat/rooms/${room.id}/members/${userId}/`);
      await refresh();
    } catch { /* ignore */ }
  };

  const leaveGroup = async () => {
    if (!confirm('Покинуть группу?')) return;
    try {
      await api.delete(`/chat/rooms/${room.id}/members/`);
      onClose();
    } catch { /* ignore */ }
  };

  const existingIds = new Set(room.members.map((m) => m.user.id));

  return (
    <div className="absolute inset-0 z-40 flex">
      {/* Overlay */}
      <div className="flex-1 bg-black/30" onClick={onClose} />

      {/* Панель */}
      <div className="w-72 bg-white h-full shadow-2xl flex flex-col">
        <div className="px-4 py-4 flex items-center justify-between" style={{ boxShadow: '0 1px 0 #f0f0f0' }}>
          <h3 className="font-semibold text-gray-800">Участники ({room.members_count})</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Поиск и добавление (только admin) */}
        {isRoomAdmin && (
          <div className="px-3 py-3" style={{ boxShadow: '0 1px 0 #f0f0f0' }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Добавить участника..."
              className="w-full bg-gray-50 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {candidates.length > 0 && (
              <div className="mt-1 bg-gray-50 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                {candidates.filter((c) => !existingIds.has(c.id)).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => addMember(c.id)}
                    disabled={loading}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm flex items-center gap-2"
                  >
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 flex-shrink-0">
                      {c.last_name[0]}{c.first_name[0]}
                    </div>
                    <span>{c.display_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Список участников */}
        <div className="flex-1 overflow-y-auto">
          {room.members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 group">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700 flex-shrink-0">
                {m.user.last_name[0]}{m.user.first_name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{m.user.display_name}</p>
                {m.role === 'admin' && (
                  <p className="text-xs text-blue-500">Администратор</p>
                )}
              </div>
              {isRoomAdmin && m.user.id !== user?.id && (
                <button
                  onClick={() => removeMember(m.user.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all"
                  title="Удалить"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Покинуть группу (не для admin) */}
        {!isRoomAdmin && (
          <div className="px-4 py-3" style={{ boxShadow: '0 -1px 0 #f0f0f0' }}>
            <button
              onClick={leaveGroup}
              className="w-full text-left text-sm text-red-500 hover:text-red-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Покинуть группу
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
