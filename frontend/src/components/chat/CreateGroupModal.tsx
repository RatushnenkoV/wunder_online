import { useState, useEffect } from 'react';
import api from '../../api/client';
import type { ChatRoom, ChatUser } from '../../types';

interface ClassGroupResult {
  type: 'class' | 'group';
  id: number;
  label: string;
  user_ids: number[];
}

interface Props {
  onClose: () => void;
  onCreated: (room: ChatRoom) => void;
}

export default function CreateGroupModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [allUsers, setAllUsers] = useState<ChatUser[]>([]);
  const [displayedUsers, setDisplayedUsers] = useState<ChatUser[]>([]);
  const [classGroups, setClassGroups] = useState<ClassGroupResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ChatUser[]>([]);
  const [saving, setSaving] = useState(false);

  // Загрузить всех доступных пользователей при открытии
  useEffect(() => {
    setLoading(true);
    api.get('/chat/users/')
      .then((res) => { setAllUsers(res.data); setDisplayedUsers(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Серверная фильтрация при вводе (debounce 250ms)
  useEffect(() => {
    if (!search.trim()) {
      setDisplayedUsers(allUsers);
      setClassGroups([]);
      return;
    }
    const timer = setTimeout(() => {
      // displayedUsers — только для отображения; allUsers не перезаписываем (нужен для addClassGroup)
      api.get(`/chat/users/?q=${encodeURIComponent(search)}`)
        .then((res) => setDisplayedUsers(res.data))
        .catch(() => {});
      api.get(`/school/class-group-search/?q=${encodeURIComponent(search)}`)
        .then((res) => setClassGroups(res.data))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [search, allUsers]);

  const toggle = (u: ChatUser) => {
    setSelected((prev) =>
      prev.find((x) => x.id === u.id) ? prev.filter((x) => x.id !== u.id) : [...prev, u]
    );
  };

  // Добавить всех участников класса/группы, которые доступны в /chat/users/
  const addClassGroup = async (cg: ClassGroupResult) => {
    try {
      // Загрузим всех пользователей из class-group через их id
      // Используем уже имеющихся в allUsers + запросим остальных
      const existingMap = new Map(allUsers.map(u => [u.id, u]));
      const missing = cg.user_ids.filter(id => !existingMap.has(id));
      let extra: ChatUser[] = [];
      if (missing.length > 0) {
        // Получим их через пустой запрос, у нас нет bulk-user-fetch, поэтому пропустим
        extra = [];
      }
      const toAdd = [
        ...cg.user_ids.map(id => existingMap.get(id)).filter(Boolean) as ChatUser[],
        ...extra,
      ];
      setSelected(prev => {
        const ids = new Set(prev.map(u => u.id));
        return [...prev, ...toAdd.filter(u => !ids.has(u.id))];
      });
    } catch { /* ignore */ }
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

  const displayed = displayedUsers;

  const selectedIds = new Set(selected.map((u) => u.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[80vh]">
        <div className="px-6 py-4 flex items-center justify-between" style={{ boxShadow: '0 1px 0 #f0f0f0' }}>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-200">Новая группа</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-slate-500 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
            {/* Название */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Название группы</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: Педсовет"
                className="w-full bg-gray-50 dark:bg-slate-900 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                required
              />
            </div>

            {/* Участники */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Участники{selected.length > 0 && ` (${selected.length})`}
              </label>

              {/* Выбранные чипы */}
              {selected.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selected.map((u) => (
                    <span key={u.id} className="flex items-center gap-1 bg-purple-100 text-purple-700 rounded-full px-2.5 py-0.5 text-xs font-medium">
                      {u.display_name}
                      <button type="button" onClick={() => toggle(u)} className="hover:text-purple-900 ml-0.5">
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
                placeholder="Поиск по имени или классу (например: 5а)..."
                className="w-full bg-gray-50 dark:bg-slate-900 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              />

              <div className="mt-1 rounded-xl overflow-hidden max-h-48 overflow-y-auto bg-gray-50 dark:bg-slate-900">
                {loading && (
                  <p className="text-center text-sm text-gray-400 dark:text-slate-500 py-4">Загрузка...</p>
                )}

                {/* Классы и группы */}
                {classGroups.length > 0 && (
                  <>
                    <div className="px-3 pt-2 pb-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-500">Классы и группы</span>
                    </div>
                    {classGroups.map((cg) => (
                      <button
                        key={`${cg.type}-${cg.id}`}
                        type="button"
                        onClick={() => addClassGroup(cg)}
                        className="w-full text-left px-4 py-2 flex items-center gap-3 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                      >
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 flex-shrink-0">
                          {cg.type === 'class' ? 'К' : 'Г'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-gray-800 dark:text-slate-200">{cg.label}</span>
                          <span className="text-xs text-gray-400 ml-2">{cg.user_ids.length} уч.</span>
                        </div>
                        <span className="text-xs text-blue-500 font-medium whitespace-nowrap">+ все</span>
                      </button>
                    ))}
                    {displayed.length > 0 && (
                      <div className="px-3 pt-2 pb-1 border-t border-gray-100 dark:border-slate-700">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Пользователи</span>
                      </div>
                    )}
                  </>
                )}

                {/* Пользователи */}
                {!loading && displayed.length === 0 && classGroups.length === 0 && (
                  <p className="text-center text-sm text-gray-400 dark:text-slate-500 py-4">Никого не найдено</p>
                )}
                {displayed.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggle(u)}
                    className={`w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-white dark:hover:bg-slate-700 transition-colors ${
                      selectedIds.has(u.id) ? 'bg-purple-50' : ''
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-700 flex-shrink-0">
                      {u.last_name[0]}{u.first_name[0]}
                    </div>
                    <span className="text-sm text-gray-800 dark:text-slate-200 flex-1">{u.display_name}</span>
                    {selectedIds.has(u.id) && (
                      <svg className="w-4 h-4 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="px-6 py-4 flex justify-end gap-3" style={{ boxShadow: '0 -1px 0 #f0f0f0' }}>
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-800">
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="px-5 py-2 bg-purple-500 text-white text-sm font-medium rounded-xl hover:bg-purple-600 disabled:opacity-50"
            >
              {saving ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
