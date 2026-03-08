import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type { ChatRoom, ChatMessage } from '../types';
import ChatWindow from '../components/chat/ChatWindow';
import CreateGroupModal from '../components/chat/CreateGroupModal';
import NewDirectModal from '../components/chat/NewDirectModal';

// ─── Звук уведомления (Web Audio API, без файла) ─────────────────────────────
// Единый AudioContext на всю вкладку — разблокируется при первом клике
let _sharedAudioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext {
  if (!_sharedAudioCtx || _sharedAudioCtx.state === 'closed') {
    _sharedAudioCtx = new AudioContext();
  }
  return _sharedAudioCtx;
}

export function unlockAudio() {
  try {
    const ctx = getAudioCtx();
    // iOS Safari требует воспроизведения реального буфера синхронно в жесте
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
    if (ctx.state === 'suspended') ctx.resume();
  } catch { /* ignore */ }
}

function playBeep() {
  try {
    const ctx = getAudioCtx();
    if (ctx.state !== 'running') return; // ещё не разблокирован
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch { /* ignore */ }
}

// ─── Браузерное уведомление ───────────────────────────────────────────────────
function showBrowserNotification(title: string, body: string) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return; // окно активно — не надо
  try {
    new Notification(title, { body, icon: '/favicon.ico', tag: 'chat' });
  } catch { /* ignore */ }
}

// ─── Вспомогательные ─────────────────────────────────────────────────────────
function formatTime(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

function RoomAvatar({ room }: { room: ChatRoom }) {
  const initials = room.room_type === 'direct'
    ? `${room.other_user?.last_name?.[0] || ''}${room.other_user?.first_name?.[0] || ''}`.toUpperCase()
    : room.name[0]?.toUpperCase() || '#';
  const color = room.room_type === 'group' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700';
  return (
    <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold ${color}`}>
      {initials}
    </div>
  );
}

// ─── Компонент ────────────────────────────────────────────────────────────────
export default function ChatsPage() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showNewDirect, setShowNewDirect] = useState(false);
  const [listOpen, setListOpen] = useState(false); // мобильный оверлей
  const [showNotifBanner, setShowNotifBanner] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const prevUnreadRef = useRef<Record<number, number>>({});
  const activeRoomIdRef = useRef<number | null>(null);
  activeRoomIdRef.current = activeRoomId;
  // Локальное время прочтения: roomId -> ISO-строка.
  // Если last_message.created_at <= этого времени → unread_count считаем 0.
  const lastReadTimeRef = useRef<Record<number, string>>({});

  // Показать баннер разрешения уведомлений
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission !== 'denied') {
      setShowNotifBanner(true); // покажем — внутри разберём что именно показать
    }
  }, []);

  // Разблокировка AudioContext при первом касании/клике
  useEffect(() => {
    document.addEventListener('click', unlockAudio, { once: true });
    document.addEventListener('touchstart', unlockAudio, { once: true });
    return () => {
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };
  }, []);

  const requestNotifPermission = async () => {
    setShowNotifBanner(false);
    try { await Notification.requestPermission(); } catch { /* ignore */ }
  };

  // Обновить список комнат + диспатч события для сайдбара
  const applyRooms = useCallback((newRooms: ChatRoom[], isInitial = false) => {
    // Мержим серверные данные с локальным состоянием прочтения.
    // Если last_message.created_at <= нашего lastReadTime — считаем unread = 0,
    // чтобы значок не «возвращался» после поллинга когда чат уже прочитан.
    const mergedRooms = newRooms.map((serverRoom) => {
      const lastReadTs = lastReadTimeRef.current[serverRoom.id];
      if (lastReadTs && serverRoom.unread_count > 0) {
        const lastMsgTs = serverRoom.last_message?.created_at;
        if (!lastMsgTs || lastMsgTs <= lastReadTs) {
          return { ...serverRoom, unread_count: 0 };
        }
      }
      return serverRoom;
    });

    setRooms(mergedRooms);

    const total = mergedRooms.reduce((s, r) => s + r.unread_count, 0);
    window.dispatchEvent(new CustomEvent('chat:unread:update', { detail: total }));

    if (!isInitial) {
      // Проверяем новые сообщения в не-активных комнатах
      const prev = prevUnreadRef.current;
      mergedRooms.forEach((room) => {
        const prevCount = prev[room.id];
        if (prevCount === undefined) return; // первый раз — не уведомляем
        if (room.unread_count > prevCount && room.id !== activeRoomIdRef.current) {
          playBeep();
          const name = room.room_type === 'direct'
            ? (room.other_user?.display_name || 'Чат')
            : room.name;
          showBrowserNotification(
            `Новое сообщение — ${name}`,
            room.last_message?.text || '[файл]',
          );
        }
      });
    }
    prevUnreadRef.current = Object.fromEntries(mergedRooms.map((r) => [r.id, r.unread_count]));
  }, []);

  // Первоначальная загрузка
  useEffect(() => {
    api.get('/chat/rooms/')
      .then((res) => {
        applyRooms(res.data, true);
        if (res.data.length > 0) setActiveRoomId(res.data[0].id);
      })
      .catch(() => {});
  }, [applyRooms]);

  // Поллинг каждые 15 сек (для комнат без активного WS)
  useEffect(() => {
    const interval = setInterval(() => {
      api.get('/chat/rooms/')
        .then((res) => applyRooms(res.data, false))
        .catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, [applyRooms]);

  // Закрыть меню при клике снаружи
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const activeRoom = rooms.find((r) => r.id === activeRoomId) || null;

  const filtered = rooms.filter((r) => {
    const name = r.room_type === 'direct' ? (r.other_user?.display_name || '') : r.name;
    return name.toLowerCase().includes(search.toLowerCase());
  });

  // Когда в активном чате приходит новое сообщение через WS
  const handleNewMessage = useCallback((message: ChatMessage) => {
    // Обновляем локальное время прочтения — мы видим это сообщение
    lastReadTimeRef.current[message.room] = new Date().toISOString();

    setRooms((prev) => {
      const updated = prev.map((r) => {
        if (r.id !== message.room) return r;
        return {
          ...r,
          last_message: {
            id: message.id,
            text: message.text,
            sender_id: message.sender?.id ?? null,
            sender_name: message.sender?.display_name ?? '',
            created_at: message.created_at,
          },
          unread_count: 0,
        };
      });
      const total = updated.reduce((s, r) => s + r.unread_count, 0);
      window.dispatchEvent(new CustomEvent('chat:unread:update', { detail: total }));
      return updated;
    });
  }, []);

  const handleRoomCreated = (room: ChatRoom) => {
    setShowCreateGroup(false);
    setShowNewDirect(false);
    setRooms((prev) => {
      if (prev.find((r) => r.id === room.id)) return prev;
      return [room, ...prev];
    });
    setActiveRoomId(room.id);
    setListOpen(false);
  };

  const handleRoomUpdated = (updated: ChatRoom) => {
    setRooms((prev) => prev.map((r) => r.id === updated.id ? updated : r));
  };

  const selectRoom = (id: number) => {
    setActiveRoomId(id);
    setListOpen(false);
    // Записываем время прочтения — поллинг не будет возвращать бейдж для этого чата
    lastReadTimeRef.current[id] = new Date().toISOString();
    // Сбросить unread локально
    setRooms((prev) => {
      const updated = prev.map((r) => r.id === id ? { ...r, unread_count: 0 } : r);
      const total = updated.reduce((s, r) => s + r.unread_count, 0);
      window.dispatchEvent(new CustomEvent('chat:unread:update', { detail: total }));
      return updated;
    });
  };

  const totalUnread = rooms.reduce((sum, r) => sum + r.unread_count, 0);

  // ─── Рендер сайдбара (переиспользуется для мобильного оверлея и десктопа) ─
  const sidebarContent = (
    <>
      {/* Шапка списка */}
      <div className="px-4 py-4" style={{ boxShadow: '0 1px 0 #f0f0f0' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            Чаты
            {totalUnread > 0 && (
              <span className="bg-blue-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 leading-none">
                {totalUnread}
              </span>
            )}
          </h2>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu((v) => !v)}
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Новый чат"
            >
              <span className="text-lg leading-none select-none">♥</span>
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg w-48 z-10 overflow-hidden"
                style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}>
                <button
                  onClick={() => { setShowNewDirect(true); setShowMenu(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Новое сообщение
                </button>
                {user?.is_admin && (
                  <button
                    onClick={() => { setShowCreateGroup(true); setShowMenu(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    style={{ boxShadow: '0 -1px 0 #f5f5f5' }}
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Создать группу
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Поиск */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск чатов..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-100"
          />
        </div>
      </div>

      {/* Список */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-gray-400 text-sm">
            {search ? 'Ничего не найдено' : 'Нет чатов'}
          </div>
        )}

        {filtered.map((room) => {
          const isActive = room.id === activeRoomId;
          const roomName = room.room_type === 'direct'
            ? (room.other_user?.display_name || 'Личный чат')
            : room.name;

          return (
            <button
              key={room.id}
              onClick={() => selectRoom(room.id)}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center gap-3 ${
                isActive
                  ? 'bg-blue-50 border-l-[3px] border-l-blue-500'
                  : 'border-l-[3px] border-l-transparent'
              }`}
            >
              <RoomAvatar room={room} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <p className={`text-sm font-medium truncate ${isActive ? 'text-blue-700' : 'text-gray-800'}`}>
                    {roomName}
                  </p>
                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-1">
                    {room.last_message && (
                      <span className="text-[10px] text-gray-400">
                        {formatTime(room.last_message.created_at)}
                      </span>
                    )}
                    {room.unread_count > 0 && (
                      <span className="bg-blue-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 leading-none">
                        {room.unread_count > 99 ? '99+' : room.unread_count}
                      </span>
                    )}
                  </div>
                </div>
                {room.last_message ? (
                  <p className="text-xs text-gray-400 truncate">
                    {room.room_type === 'group' && room.last_message.sender_name
                      ? `${room.last_message.sender_name.split(' ')[0]}: `
                      : ''}
                    {room.last_message.text || '[файл]'}
                  </p>
                ) : (
                  <p className="text-xs text-gray-300 italic">Нет сообщений</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </>
  );

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden relative">

      {/* ── Баннер разрешения уведомлений ── */}
      {showNotifBanner && (() => {
        const isSecure = window.isSecureContext; // false на http://IP (не localhost)
        const perm = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';

        // Уже разрешено — баннер не нужен
        if (perm === 'granted') return null;

        let icon = (
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        );

        // Нет HTTPS → объясняем
        if (!isSecure) {
          return (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] bg-amber-50 border border-amber-200 rounded-2xl shadow-xl px-4 py-3 flex items-start gap-3 w-[calc(100%-2rem)] max-w-sm">
              <span className="text-amber-500 flex-shrink-0 mt-0.5">{icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-amber-700">Уведомления недоступны</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Браузер требует HTTPS. При подключении по IP-адресу (`http://192.168.x.x`) уведомления и часть функций заблокированы.
                </p>
              </div>
              <button onClick={() => setShowNotifBanner(false)} className="text-amber-400 hover:text-amber-600 flex-shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        }

        // iOS Safari → объясняем
        if (perm === 'unsupported') {
          return (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] bg-gray-50 border border-gray-200 rounded-2xl shadow-xl px-4 py-3 flex items-start gap-3 w-[calc(100%-2rem)] max-w-sm">
              <span className="text-gray-400 flex-shrink-0 mt-0.5">{icon}</span>
              <p className="flex-1 text-xs text-gray-500">Уведомления не поддерживаются в этом браузере</p>
              <button onClick={() => setShowNotifBanner(false)} className="text-gray-400 hover:text-gray-500 flex-shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        }

        // Заблокировано пользователем ранее
        if (perm === 'denied') {
          return (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] bg-gray-50 border border-gray-200 rounded-2xl shadow-xl px-4 py-3 flex items-start gap-3 w-[calc(100%-2rem)] max-w-sm">
              <span className="text-gray-400 flex-shrink-0 mt-0.5">{icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-600">Уведомления заблокированы</p>
                <p className="text-xs text-gray-400 mt-0.5">Разрешите их в настройках браузера для этого сайта</p>
              </div>
              <button onClick={() => setShowNotifBanner(false)} className="text-gray-400 hover:text-gray-500 flex-shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        }

        // Ещё не спрашивали (default) — показываем кнопку
        return (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] bg-white rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3 w-[calc(100%-2rem)] max-w-sm">
            <span className="text-blue-500 flex-shrink-0">{icon}</span>
            <span className="flex-1 text-xs text-gray-700">Включить уведомления о новых сообщениях?</span>
            <button
              onClick={requestNotifPermission}
              className="text-blue-500 font-semibold text-xs hover:text-blue-600 whitespace-nowrap"
            >
              Включить
            </button>
            <button onClick={() => setShowNotifBanner(false)} className="text-gray-400 hover:text-gray-500 flex-shrink-0 ml-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })()}

      {/* ── Мобильный затемнённый оверлей ── */}
      {listOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setListOpen(false)}
        />
      )}

      {/* ── Левая панель ── */}
      {/* Desktop: статичная; Mobile: фиксированный оверлей */}
      <div className={[
        'flex flex-col bg-white',
        // Desktop: обычный элемент flex
        'lg:relative lg:w-72 lg:flex-shrink-0 lg:translate-x-0 lg:z-auto lg:shadow-none',
        // Mobile: фиксированный оверлей
        'fixed top-0 left-0 bottom-0 z-50 w-80 transition-transform duration-300 ease-in-out',
        listOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      ].join(' ')}
        style={{ boxShadow: listOpen ? '2px 0 20px rgba(0,0,0,0.15)' : '1px 0 0 #f0f0f0' }}
      >
        {sidebarContent}
      </div>

      {/* ── Правая панель: окно чата ── */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        {activeRoom ? (
          <ChatWindow
            key={activeRoom.id}
            room={activeRoom}
            onRoomUpdated={handleRoomUpdated}
            onNewMessage={handleNewMessage}
            onOpenList={() => setListOpen(true)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 bg-gray-50">
            {/* Кнопка открыть список на мобильном когда нет активного чата */}
            <button
              className="lg:hidden mb-4 px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium"
              onClick={() => setListOpen(true)}
            >
              Открыть чаты
            </button>
            <svg className="w-16 h-16 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-lg font-medium">Выберите чат</p>
            <p className="text-sm mt-1">или начните новый</p>
          </div>
        )}
      </div>

      {/* Модалки */}
      {showCreateGroup && (
        <CreateGroupModal onClose={() => setShowCreateGroup(false)} onCreated={handleRoomCreated} />
      )}
      {showNewDirect && (
        <NewDirectModal onClose={() => setShowNewDirect(false)} onOpened={handleRoomCreated} />
      )}
    </div>
  );
}
