import { useState, useEffect, useRef, useCallback } from 'react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import api from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import type { ChatRoom, ChatRoomDetail, ChatMessage } from '../../types';
import ChatMessageBubble from './ChatMessageBubble';
import ChatMembersPanel from './ChatMembersPanel';

interface Props {
  room: ChatRoom;
  onRoomUpdated: (room: ChatRoom) => void;
  onNewMessage?: (message: ChatMessage) => void;
  onOpenList?: () => void;
}

function formatDateLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Сегодня';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function groupByDate(messages: ChatMessage[]) {
  const groups: { date: string; messages: ChatMessage[] }[] = [];
  messages.forEach((msg) => {
    const date = new Date(msg.created_at).toDateString();
    const last = groups[groups.length - 1];
    if (last && last.date === date) {
      last.messages.push(msg);
    } else {
      groups.push({ date, messages: [msg] });
    }
  });
  return groups;
}

export default function ChatWindow({ room, onRoomUpdated, onNewMessage, onOpenList }: Props) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [input, setInput] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [typingUsers, setTypingUsers] = useState<{ id: number; name: string }[]>([]);
  const [detail, setDetail] = useState<ChatRoomDetail | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roomIdRef = useRef(room.id);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Загрузить детали комнаты
  useEffect(() => {
    api.get(`/chat/rooms/${room.id}/`).then((res) => setDetail(res.data)).catch(() => {});
  }, [room.id]);

  // Загрузить историю
  useEffect(() => {
    roomIdRef.current = room.id;
    setMessages([]);
    setHasMore(false);
    setLoadingHistory(true);
    setReplyTo(null);
    setInput('');

    api.get(`/chat/rooms/${room.id}/messages/`)
      .then((res) => {
        setMessages(res.data.results);
        setHasMore(res.data.has_more);
        setTimeout(scrollToBottom, 50);
      })
      .finally(() => setLoadingHistory(false));

    // Отметить прочитанным
    api.post(`/chat/rooms/${room.id}/read/`).catch(() => {});
  }, [room.id, scrollToBottom]);

  // WebSocket
  useEffect(() => {
    const connect = () => {
      const token = localStorage.getItem('access_token');
      if (!token) return;
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${window.location.host}/ws/chat/${room.id}/?token=${token}`);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (roomIdRef.current !== room.id) return;

          if (data.type === 'message_new') {
            setMessages((prev) => {
              if (prev.find((m) => m.id === data.message.id)) return prev;
              return [...prev, data.message];
            });
            setTimeout(scrollToBottom, 50);
            onNewMessage?.(data.message);
            // Отметить прочитанным если окно активно
            api.post(`/chat/rooms/${room.id}/read/`).catch(() => {});
          } else if (data.type === 'message_deleted') {
            setMessages((prev) =>
              prev.map((m) => m.id === data.message_id ? { ...m, is_deleted: true, text: '' } : m)
            );
          } else if (data.type === 'user_typing') {
            setTypingUsers((prev) => {
              const filtered = prev.filter((u) => u.id !== data.user_id);
              return [...filtered, { id: data.user_id, name: data.display_name }];
            });
            setTimeout(() => {
              setTypingUsers((prev) => prev.filter((u) => u.id !== data.user_id));
            }, 3000);
          }
        } catch { /* ignore */ }
      };

      ws.onclose = () => {
        if (roomIdRef.current === room.id) {
          reconnectRef.current = setTimeout(connect, 2000);
        }
      };
      ws.onerror = () => {};
    };

    connect();
    return () => {
      roomIdRef.current = -1;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [room.id, scrollToBottom]);

  // Подгрузка старых сообщений при скролле вверх
  useEffect(() => {
    const el = topRef.current?.parentElement;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );
    if (topRef.current) observer.observe(topRef.current);
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loadingMore, messages]);

  const loadMore = async () => {
    if (!messages.length || loadingMore) return;
    setLoadingMore(true);
    const firstId = messages[0].id;
    try {
      const res = await api.get(`/chat/rooms/${room.id}/messages/?before=${firstId}`);
      setMessages((prev) => [...res.data.results, ...prev]);
      setHasMore(res.data.has_more);
    } finally {
      setLoadingMore(false);
    }
  };

  const sendMessage = () => {
    const text = input.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: 'send_message',
      text,
      reply_to: replyTo?.id ?? null,
    }));
    setInput('');
    setReplyTo(null);
    setShowEmoji(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Typing indicator
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'typing' }));
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      await api.post(`/chat/rooms/${room.id}/files/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } catch { /* ignore */ }
    finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleEmojiSelect = (emoji: { native: string }) => {
    const ta = textareaRef.current;
    if (!ta) {
      setInput((prev) => prev + emoji.native);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    setInput((prev) => prev.slice(0, start) + emoji.native + prev.slice(end));
    setTimeout(() => {
      ta.selectionStart = ta.selectionEnd = start + emoji.native.length;
      ta.focus();
    }, 0);
  };

  const handleDelete = async (msg: ChatMessage) => {
    try {
      await api.delete(`/chat/rooms/${room.id}/messages/${msg.id}/`);
    } catch { /* ignore */ }
  };

  const roomName = room.room_type === 'direct'
    ? room.other_user?.display_name || 'Личный чат'
    : room.name;

  const membersCount = detail?.members_count ?? room.members_count;

  return (
    <div className="flex flex-col flex-1 min-h-0 relative">
      {/* Шапка */}
      <div className="px-4 py-3 bg-white flex items-center gap-2 flex-shrink-0" style={{ boxShadow: '0 1px 0 #f0f0f0' }}>
        {/* Кнопка "назад" на мобильных */}
        {onOpenList && (
          <button
            onClick={onOpenList}
            className="lg:hidden p-1.5 -ml-1 text-gray-400 hover:text-gray-600 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold
          bg-blue-100 text-blue-700">
          {room.room_type === 'direct'
            ? `${room.other_user?.last_name?.[0] || ''}${room.other_user?.first_name?.[0] || ''}`.toUpperCase()
            : roomName[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 truncate">{roomName}</p>
          {room.room_type === 'group' && (
            <p className="text-xs text-gray-400">{membersCount} участн.</p>
          )}
        </div>
        {room.room_type === 'group' && (
          <button
            onClick={() => setShowMembers(true)}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            title="Участники"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        )}
      </div>

      {/* Список сообщений */}
      <div className="flex-1 overflow-y-auto py-2 px-2 bg-gray-50">
        <div ref={topRef} className="h-1" />

        {loadingMore && (
          <div className="flex justify-center py-2">
            <span className="text-xs text-gray-400">Загрузка...</span>
          </div>
        )}

        {loadingHistory && (
          <div className="flex justify-center py-10 text-gray-400 text-sm">Загрузка...</div>
        )}

        {!loadingHistory && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <p>Нет сообщений</p>
            <p className="text-sm mt-1">Начните переписку!</p>
          </div>
        )}

        {groupByDate(messages).map(({ date, messages: dayMsgs }) => (
          <div key={date}>
            <div className="flex justify-center my-3">
              <span className="text-xs bg-gray-200 text-gray-500 px-3 py-0.5 rounded-full">
                {formatDateLabel(dayMsgs[0].created_at)}
              </span>
            </div>
            {dayMsgs.map((msg) => (
              <ChatMessageBubble
                key={msg.id}
                message={msg}
                currentUser={user as never}
                isGroup={room.room_type === 'group'}
                onReply={setReplyTo}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ))}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="px-4 py-1">
            <span className="text-xs text-gray-400 italic">
              {typingUsers.map((u) => u.name).join(', ')} печатает...
            </span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Emoji picker */}
      {showEmoji && (
        <div className="absolute bottom-20 left-4 z-50 shadow-xl rounded-xl overflow-hidden">
          <Picker
            data={data}
            onEmojiSelect={handleEmojiSelect}
            locale="ru"
            theme="light"
            previewPosition="none"
          />
        </div>
      )}

      {/* Блок ввода */}
      <div className="bg-white flex-shrink-0" style={{ boxShadow: '0 -1px 0 #f0f0f0' }}>
        {/* Цитата */}
        {replyTo && (
          <div className="flex items-center gap-2 px-4 pt-2 pb-1 bg-blue-50">
            <div className="flex-1 min-w-0 pl-2 border-l-2 border-blue-400">
              <p className="text-xs font-medium text-blue-600 truncate">
                {replyTo.sender?.display_name}
              </p>
              <p className="text-xs text-gray-600 truncate">
                {replyTo.text || '[файл]'}
              </p>
            </div>
            <button onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <div className="flex items-end gap-2 px-3 py-3">
          {/* Emoji */}
          <button
            onClick={() => setShowEmoji((v) => !v)}
            className={`flex-shrink-0 p-2 rounded-full transition-colors ${showEmoji ? 'text-yellow-500 bg-yellow-50' : 'text-gray-400 hover:text-gray-600'}`}
            title="Эмодзи"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          {/* Файл */}
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 rounded-full"
            title="Прикрепить файл"
          >
            {uploading ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            )}
          </button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            rows={1}
            className="flex-1 border border-gray-200 rounded-2xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none max-h-32 overflow-y-auto bg-gray-50"
            placeholder="Написать сообщение..."
            style={{ minHeight: '38px' }}
            onClick={() => setShowEmoji(false)}
          />

          {/* Отправить */}
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            className="flex-shrink-0 p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-40 disabled:cursor-default transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>

      {/* Панель участников */}
      {showMembers && detail && (
        <ChatMembersPanel
          room={detail}
          onClose={() => setShowMembers(false)}
          onUpdated={(updated) => {
            setDetail(updated);
            onRoomUpdated({ ...room, members_count: updated.members_count });
          }}
        />
      )}
    </div>
  );
}
