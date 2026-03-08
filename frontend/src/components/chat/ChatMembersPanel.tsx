import { useState, useEffect } from 'react';
import api from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import type { ChatRoomDetail, ChatUser, ChatRestriction } from '../../types';

interface Props {
  room: ChatRoomDetail;
  onClose: () => void;
  onUpdated: (room: ChatRoomDetail) => void;
}

// ─── Модал ограничений ученика ─────────────────────────────────────────────────
function RestrictionModal({ student, onClose }: { student: ChatUser; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restriction, setRestriction] = useState<ChatRestriction>({
    student_id: student.id,
    message_cooldown: 0,
    muted_until: null,
    no_links: false,
    no_files: false,
    no_polls: false,
  });
  const [muteMinutes, setMuteMinutes] = useState('');

  useEffect(() => {
    api.get(`/chat/restrictions/${student.id}/`)
      .then((res) => {
        setRestriction(res.data);
        if (res.data.muted_until) {
          const remaining = Math.max(0, Math.round(
            (new Date(res.data.muted_until).getTime() - Date.now()) / 60000
          ));
          setMuteMinutes(remaining > 0 ? String(remaining) : '');
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [student.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      let muted_until: string | null = null;
      if (muteMinutes && parseInt(muteMinutes) > 0) {
        const until = new Date(Date.now() + parseInt(muteMinutes) * 60 * 1000);
        muted_until = until.toISOString();
      }
      await api.put(`/chat/restrictions/${student.id}/`, {
        ...restriction,
        muted_until,
      });
      onClose();
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const displayName = `${student.last_name} ${student.first_name}`.trim();
  const isMuted = restriction.muted_until && new Date(restriction.muted_until) > new Date();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-800 text-sm">Ограничения в чате</h3>
            <p className="text-xs text-gray-500 mt-0.5">{displayName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="text-center py-6 text-gray-400 text-sm">Загрузка...</div>
        ) : (
          <>
            {/* Cooldown */}
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Пауза между сообщениями (сек)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={restriction.message_cooldown}
                  onChange={(e) => setRestriction((r) => ({ ...r, message_cooldown: Math.max(0, +e.target.value) }))}
                  className="w-24 border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <span className="text-xs text-gray-400">0 — без ограничений</span>
              </div>
            </div>

            {/* Мьют */}
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Мьют на (минут)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={muteMinutes}
                  onChange={(e) => setMuteMinutes(e.target.value)}
                  placeholder="0"
                  className="w-24 border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <span className="text-xs text-gray-400">0 — снять мьют</span>
              </div>
              {isMuted && (
                <p className="text-xs text-orange-500 mt-1">
                  Мьют до {new Date(restriction.muted_until!).toLocaleString('ru-RU')}
                </p>
              )}
            </div>

            {/* Переключатели */}
            <div className="flex flex-col gap-3">
              {([
                { key: 'no_links' as const, label: 'Запрет ссылок' },
                { key: 'no_files' as const, label: 'Запрет файлов' },
                { key: 'no_polls' as const, label: 'Запрет опросов' },
              ] as const).map(({ key, label }) => (
                <label key={key} className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-gray-700">{label}</span>
                  <div
                    onClick={() => setRestriction((r) => ({ ...r, [key]: !r[key] }))}
                    className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${restriction[key] ? 'bg-red-500' : 'bg-gray-200'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${restriction[key] ? 'left-[22px]' : 'left-0.5'}`} />
                  </div>
                </label>
              ))}
            </div>

            <div className="flex gap-2 justify-end mt-1">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">
                Отмена
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-40"
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Панель участников ────────────────────────────────────────────────────────
export default function ChatMembersPanel({ room, onClose, onUpdated }: Props) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState<ChatUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [restrictionTarget, setRestrictionTarget] = useState<ChatUser | null>(null);

  const isRoomAdmin = user?.is_admin;
  const isAdult = user?.is_admin || user?.is_teacher || user?.is_parent;

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
    <>
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
                      <span>{c.last_name} {c.first_name}</span>
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
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {m.user.last_name} {m.user.first_name}
                  </p>
                  {m.role === 'admin' && <p className="text-xs text-blue-500">Администратор</p>}
                  {m.user.is_student && <p className="text-xs text-gray-400">Ученик</p>}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  {/* Ограничения — для взрослых, только для учеников */}
                  {isAdult && m.user.is_student && m.user.id !== user?.id && (
                    <button
                      onClick={() => setRestrictionTarget(m.user)}
                      className="text-gray-300 hover:text-orange-500 transition-colors"
                      title="Ограничения в чате"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    </button>
                  )}
                  {/* Удаление — только для room admin */}
                  {isRoomAdmin && m.user.id !== user?.id && (
                    <button
                      onClick={() => removeMember(m.user.id)}
                      className="text-gray-300 hover:text-red-500 transition-colors"
                      title="Удалить"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
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

      {/* Модал ограничений */}
      {restrictionTarget && (
        <RestrictionModal
          student={restrictionTarget}
          onClose={() => setRestrictionTarget(null)}
        />
      )}
    </>
  );
}
