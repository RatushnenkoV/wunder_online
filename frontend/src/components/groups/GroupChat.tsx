import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import type { GroupDetail, GroupMessage, GroupTask } from '../../types';
import MessageBubble from './MessageBubble';
import GroupMembersModal from './GroupMembersModal';
import CreateTaskModal from './CreateTaskModal';

interface Props {
  group: GroupDetail;
  onGroupUpdated: (group: GroupDetail) => void;
}

export default function GroupChat({ group, onGroupUpdated }: Props) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [showMembers, setShowMembers] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const groupIdRef = useRef(group.id);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Загрузить историю сообщений
  useEffect(() => {
    groupIdRef.current = group.id;
    setMessages([]);
    setLoading(true);
    api.get(`/groups/${group.id}/messages/`)
      .then((res) => {
        setMessages(res.data);
        setTimeout(scrollToBottom, 50);
      })
      .finally(() => setLoading(false));
  }, [group.id, scrollToBottom]);

  // WebSocket соединение
  useEffect(() => {
    const connect = () => {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const host = window.location.host;
      const ws = new WebSocket(`${protocol}://${host}/ws/groups/${group.id}/?token=${token}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg: GroupMessage = JSON.parse(event.data);
          // Только если это для текущей группы
          if (groupIdRef.current !== group.id) return;
          setMessages((prev) => {
            // Дедупликация
            if (prev.find((m) => m.id === msg.id)) {
              // Обновить если задача обновлена
              return prev.map((m) => m.id === msg.id ? msg : m);
            }
            return [...prev, msg];
          });
          setTimeout(scrollToBottom, 50);
        } catch {
          // ignore
        }
      };

      ws.onerror = () => {};

      ws.onclose = () => {
        // Переподключение через 3 секунды
        if (groupIdRef.current === group.id) {
          reconnectTimeout.current = setTimeout(connect, 3000);
        }
      };
    };

    connect();

    return () => {
      groupIdRef.current = -1;
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [group.id, scrollToBottom]);

  const sendMessage = () => {
    const content = input.trim();
    if (!content || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'message', content }));
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post(`/groups/${group.id}/messages/file/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // WS broadcast придёт само, но добавим на случай если WS закрыт
      const msg: GroupMessage = res.data;
      setMessages((prev) => prev.find((m) => m.id === msg.id) ? prev : [...prev, msg]);
      setTimeout(scrollToBottom, 50);
    } catch {
      // ignore
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleTaskCreated = (msg: GroupMessage) => {
    setShowTaskModal(false);
    setMessages((prev) => prev.find((m) => m.id === msg.id) ? prev : [...prev, msg]);
    setTimeout(scrollToBottom, 50);
  };

  const handleTaskUpdated = (messageId: number, task: GroupTask) => {
    setMessages((prev) =>
      prev.map((m) => m.id === messageId ? { ...m, task } : m)
    );
  };

  const groupMessagesByDate = () => {
    const groups: { date: string; messages: GroupMessage[] }[] = [];
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
  };

  const formatGroupDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Сегодня';
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Вчера';
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Шапка */}
      <div className="px-5 py-3 bg-white border-b flex items-center justify-between shadow-sm">
        <div>
          <h2 className="font-semibold text-gray-800">{group.name}</h2>
          {group.description && (
            <p className="text-xs text-gray-500">{group.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{group.members.length} участн.</span>
          {user?.is_admin && (
            <button
              onClick={() => setShowMembers(true)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Участники
            </button>
          )}
        </div>
      </div>

      {/* Сообщения */}
      <div className="flex-1 overflow-y-auto py-2 bg-gray-50">
        {loading && (
          <div className="flex justify-center py-10 text-gray-400 text-sm">Загрузка...</div>
        )}
        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <p className="text-lg">Нет сообщений</p>
            <p className="text-sm mt-1">Начните переписку!</p>
          </div>
        )}
        {groupMessagesByDate().map(({ date, messages: dayMessages }) => (
          <div key={date}>
            <div className="flex justify-center my-3">
              <span className="text-xs bg-gray-200 text-gray-500 px-3 py-0.5 rounded-full">
                {formatGroupDate(date)}
              </span>
            </div>
            {dayMessages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                currentUserId={user!.id}
                groupId={group.id}
                onTaskUpdated={handleTaskUpdated}
              />
            ))}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Поле ввода */}
      <div className="bg-white border-t px-4 py-3">
        <div className="flex items-end gap-2">
          {/* Прикрепить файл */}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
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

          {/* Создать задачу */}
          <button
            onClick={() => setShowTaskModal(true)}
            className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600"
            title="Создать задачу"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M12 12v4m-2-2h4" />
            </svg>
          </button>

          {/* Текстовое поле */}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            className="flex-1 border border-gray-300 rounded-2xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none max-h-32 overflow-y-auto"
            placeholder="Написать сообщение... (Enter — отправить)"
            style={{ minHeight: '38px' }}
          />

          {/* Отправить */}
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            className="flex-shrink-0 p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-40 disabled:cursor-default transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>

      {/* Модалки */}
      {showMembers && (
        <GroupMembersModal
          group={group}
          onClose={() => setShowMembers(false)}
          onUpdated={(updated) => { onGroupUpdated(updated); }}
        />
      )}
      {showTaskModal && (
        <CreateTaskModal
          group={group}
          onClose={() => setShowTaskModal(false)}
          onCreated={handleTaskCreated}
        />
      )}
    </div>
  );
}
