import { useState, useEffect, useRef, useCallback } from 'react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import api from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import type { ChatRoom, ChatRoomDetail, ChatMessage, ChatPoll, ChatReactionSummary } from '../../types';
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
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [restrictionError, setRestrictionError] = useState<string | null>(null);
  const [myRestriction, setMyRestriction] = useState({ no_files: false, no_polls: false });
  const [allowedEmojis, setAllowedEmojis] = useState<string[]>(['👍', '❤️', '😂', '😮', '😢', '👏']);
  const [mentionState, setMentionState] = useState<{ query: string; atIndex: number } | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  // Fix 4: drag-and-drop
  const [isDragOver, setIsDragOver] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roomIdRef = useRef(room.id);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAtBottomRef = useRef(true);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [newMsgCount, setNewMsgCount] = useState(0);
  const lastSentTextRef = useRef('');
  // Fix 1: drag-select refs
  const isDraggingRef = useRef(false);
  const dragStartIdRef = useRef<number | null>(null);
  // Fix 4: file drop counter
  const fileDropCounterRef = useRef(0);
  // Keep a ref to current messages for drag-select range computation
  const messagesRef = useRef<ChatMessage[]>([]);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' });
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const threshold = 100;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    isAtBottomRef.current = atBottom;
    setIsAtBottom(atBottom);
    if (atBottom) setNewMsgCount(0);
  }, []);

  // Keep messagesRef in sync
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Document mouseup: end drag-select
  useEffect(() => {
    const handler = () => { isDraggingRef.current = false; };
    document.addEventListener('mouseup', handler);
    return () => document.removeEventListener('mouseup', handler);
  }, []);

  useEffect(() => {
    api.get(`/chat/rooms/${room.id}/`).then((res) => setDetail(res.data)).catch(() => {});
  }, [room.id]);

  useEffect(() => {
    if (user?.is_student && user?.id) {
      api.get(`/chat/restrictions/${user.id}/`)
        .then((res) => setMyRestriction({ no_files: res.data.no_files, no_polls: res.data.no_polls }))
        .catch(() => {});
    }
  }, [user?.id, user?.is_student]);

  useEffect(() => {
    api.get('/chat/emojis/').then((res) => setAllowedEmojis(res.data)).catch(() => {});
  }, []);

  // Load history
  useEffect(() => {
    roomIdRef.current = room.id;
    setMessages([]);
    setHasMore(false);
    setLoadingHistory(true);
    setReplyTo(null);
    setInput('');
    setSelectionMode(false);
    setSelectedIds(new Set());
    setMentionState(null);

    api.get(`/chat/rooms/${room.id}/messages/?limit=20`)
      .then((res) => {
        setMessages(res.data.results);
        setHasMore(res.data.has_more);
        setNewMsgCount(0);
        setTimeout(() => scrollToBottom(false), 50);
      })
      .finally(() => setLoadingHistory(false));

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
            if (isAtBottomRef.current) {
              setTimeout(() => scrollToBottom(true), 50);
            } else {
              setNewMsgCount((c) => c + 1);
            }
            onNewMessage?.(data.message);
            if (isAtBottomRef.current) {
              api.post(`/chat/rooms/${room.id}/read/`).catch(() => {});
            }
          } else if (data.type === 'restriction_error') {
            setRestrictionError(data.detail);
            setInput(lastSentTextRef.current); // Feature 1: restore typed text
            setTimeout(() => setRestrictionError(null), 4000);
          } else if (data.type === 'message_deleted') {
            setMessages((prev) =>
              prev.map((m) => m.id === data.message_id ? { ...m, is_deleted: true, text: '' } : m)
            );
          } else if (data.type === 'poll_updated') {
            setMessages((prev) => prev.map((m) =>
              m.poll?.id === data.poll_id
                ? {
                    ...m,
                    poll: {
                      ...m.poll!,
                      total_votes: data.total_votes,
                      options: m.poll!.options.map((opt) => {
                        const upd = (data.options as ChatPoll['options']).find((o) => o.id === opt.id);
                        return upd ? { ...upd, user_voted: opt.user_voted } : opt;
                      }),
                    } as ChatPoll,
                  }
                : m
            ));
          } else if (data.type === 'chat_task_taken') {
            setMessages((prev) => prev.map((m) =>
              m.task_preview?.id === data.task_id
                ? { ...m, task_preview: {
                    ...m.task_preview!,
                    takers: data.takers,
                    user_took: m.task_preview!.user_took || data.takers.some((t: { id: number }) => t.id === user?.id),
                  }}
                : m
            ));
          } else if (data.type === 'reaction_updated') {
            setMessages((prev) => prev.map((m) =>
              m.id === data.message_id
                ? { ...m, reactions: data.reactions as ChatReactionSummary[] }
                : m
            ));
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

  useEffect(() => {
    const el = topRef.current?.parentElement;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loadingMore) loadMore();
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
    const container = scrollContainerRef.current;
    const prevScrollHeight = container?.scrollHeight ?? 0;
    const prevScrollTop = container?.scrollTop ?? 0;
    try {
      const res = await api.get(`/chat/rooms/${room.id}/messages/?before=${firstId}&limit=20`);
      setMessages((prev) => [...res.data.results, ...prev]);
      setHasMore(res.data.has_more);
      requestAnimationFrame(() => {
        if (container) {
          container.scrollTop = prevScrollTop + (container.scrollHeight - prevScrollHeight);
        }
      });
    } finally {
      setLoadingMore(false);
    }
  };

  const sendMessage = () => {
    const text = input.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    lastSentTextRef.current = text;
    wsRef.current.send(JSON.stringify({
      type: 'send_message',
      text,
      reply_to: replyTo?.id ?? null,
    }));
    setInput('');
    setReplyTo(null);
    setShowEmoji(false);
    setMentionState(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionState && e.key === 'Escape') {
      e.preventDefault();
      setMentionState(null);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    const cursorPos = e.target.selectionStart ?? val.length;
    const atMatch = /@([^\s@]*)$/.exec(val.slice(0, cursorPos));
    if (atMatch) {
      setMentionState({ query: atMatch[1].toLowerCase(), atIndex: atMatch.index });
    } else {
      setMentionState(null);
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'typing' }));
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
  };

  const insertMention = (lastName: string) => {
    const ta = textareaRef.current;
    if (!ta || !mentionState) return;
    const before = input.slice(0, mentionState.atIndex);
    const after = input.slice(ta.selectionStart);
    setInput(`${before}@${lastName} ${after}`);
    setMentionState(null);
    setTimeout(() => {
      ta.focus();
      const pos = mentionState.atIndex + lastName.length + 2;
      ta.setSelectionRange(pos, pos);
    }, 0);
  };

  // Fix 4: shared upload function used by file picker, drag-drop, paste
  const uploadFile = useCallback(async (file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      await api.post(`/chat/rooms/${room.id}/files/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } catch { /* ignore */ }
    finally { setUploading(false); }
  }, [room.id]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Fix 4: paste files from clipboard
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = e.clipboardData.files;
    if (files.length > 0) {
      e.preventDefault();
      Array.from(files).forEach((f) => uploadFile(f));
    }
  };

  // Fix 4: drag-and-drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) {
      fileDropCounterRef.current++;
      setIsDragOver(true);
    }
  };
  const handleDragLeave = () => {
    fileDropCounterRef.current--;
    if (fileDropCounterRef.current <= 0) {
      fileDropCounterRef.current = 0;
      setIsDragOver(false);
    }
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    fileDropCounterRef.current = 0;
    setIsDragOver(false);
    Array.from(e.dataTransfer.files).forEach((f) => uploadFile(f));
  };

  const handleEmojiSelect = (emoji: { native: string }) => {
    const ta = textareaRef.current;
    if (!ta) { setInput((prev) => prev + emoji.native); return; }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    setInput((prev) => prev.slice(0, start) + emoji.native + prev.slice(end));
    setTimeout(() => {
      ta.selectionStart = ta.selectionEnd = start + emoji.native.length;
      ta.focus();
    }, 0);
  };

  const handleDelete = async (msg: ChatMessage) => {
    try { await api.delete(`/chat/rooms/${room.id}/messages/${msg.id}/`); } catch { /* ignore */ }
  };

  const handleReact = async (msgId: number, emoji: string) => {
    try {
      const res = await api.post(`/chat/messages/${msgId}/react/`, { emoji });
      setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, reactions: res.data } : m));
    } catch { /* ignore */ }
  };

  const handleTakeTask = async (taskId: number) => {
    try { await api.post(`/chat/rooms/${room.id}/chat-tasks/${taskId}/take/`); } catch { /* ignore */ }
  };

  const handleVotePoll = async (pollId: number, optionId: number) => {
    try {
      const res = await api.post(`/chat/polls/${pollId}/vote/`, { option_id: optionId });
      setMessages((prev) => prev.map((m) =>
        m.poll?.id === pollId ? { ...m, poll: res.data as ChatPoll } : m
      ));
    } catch { /* ignore */ }
  };

  const cancelSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  // Escape cancels selection mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectionMode) cancelSelection();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [selectionMode, cancelSelection]);

  // Auto-exit selectionMode when all messages are deselected
  useEffect(() => {
    if (selectionMode && selectedIds.size === 0) setSelectionMode(false);
  }, [selectionMode, selectedIds.size]);

  // Fix 6: enter selection mode from context menu
  const handleToggleSelect = (id: number) => {
    setSelectionMode(true);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Fix 1: drag-select — mousedown on a message starts drag
  const handleMsgMouseDown = useCallback((id: number) => {
    isDraggingRef.current = true;
    dragStartIdRef.current = id;
    // Toggle the pressed message immediately (single-click behavior)
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // Fix 1: drag-select — mouseenter extends range while dragging (additive)
  const handleMsgMouseEnter = useCallback((id: number) => {
    if (!isDraggingRef.current || dragStartIdRef.current === null || dragStartIdRef.current === id) return;
    const allIds = messagesRef.current.filter((m) => !m.is_deleted).map((m) => m.id);
    const startIdx = allIds.indexOf(dragStartIdRef.current);
    const endIdx = allIds.indexOf(id);
    if (startIdx === -1 || endIdx === -1) return;
    const [from, to] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
    const rangeIds = allIds.slice(from, to + 1);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      rangeIds.forEach((rid) => next.add(rid));
      return next;
    });
  }, []);

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Удалить ${selectedIds.size} сообщ.?`)) return;
    setBulkDeleting(true);
    try {
      await api.post(`/chat/rooms/${room.id}/messages/bulk-delete/`, { ids: Array.from(selectedIds) });
      setSelectionMode(false);
      setSelectedIds(new Set());
    } catch { /* ignore */ }
    finally { setBulkDeleting(false); }
  };

  const currentUserMention = user ? `@${user.last_name}` : undefined;

  const mentionCandidates = mentionState
    ? (detail?.members ?? []).filter((m) => {
        const q = mentionState.query;
        return m.user.id !== user?.id && (
          m.user.last_name.toLowerCase().startsWith(q) ||
          m.user.first_name.toLowerCase().startsWith(q)
        );
      }).slice(0, 6)
    : [];

  const roomName = room.room_type === 'direct'
    ? room.other_user?.display_name || 'Личный чат'
    : room.name;
  const membersCount = detail?.members_count ?? room.members_count;

  const canFile = !user?.is_student || !myRestriction.no_files;
  const canPoll = !user?.is_student || !myRestriction.no_polls;
  const canTask = !!(user?.is_admin || user?.is_teacher);
  const showAttachButton = canFile || canPoll || canTask;

  return (
    <div
      className="flex flex-col flex-1 min-h-0 relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Fix 4: drag-over overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 bg-purple-500/10 border-4 border-dashed border-purple-400 rounded-lg flex items-center justify-center pointer-events-none">
          <div className="bg-white dark:bg-slate-800 rounded-2xl px-8 py-5 shadow-xl text-center">
            <svg className="w-10 h-10 text-purple-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-purple-600 font-medium text-sm">Отпустите для отправки файла</p>
          </div>
        </div>
      )}

      {/* Шапка */}
      <div className="px-4 py-3 bg-white dark:bg-slate-800 flex items-center gap-2 flex-shrink-0" style={{ boxShadow: '0 1px 0 #f0f0f0' }}>
        {onOpenList && (
          <button
            onClick={onOpenList}
            className="lg:hidden p-1.5 -ml-1 text-gray-400 dark:text-slate-500 hover:text-gray-600 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}

        {selectionMode ? (
          <>
            <span className="text-sm text-gray-600 dark:text-slate-400 flex-1">
              {selectedIds.size === 0 ? 'Выберите сообщения' : `Выбрано: ${selectedIds.size}`}
            </span>
            <button
              onClick={cancelSelection}
              className="px-3 py-1.5 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
            >
              Отмена
            </button>
            {selectedIds.size > 0 && (
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-40"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Удалить
              </button>
            )}
          </>
        ) : (
          <>
            <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold bg-purple-100 text-purple-700">
              {room.room_type === 'direct'
                ? `${room.other_user?.last_name?.[0] || ''}${room.other_user?.first_name?.[0] || ''}`.toUpperCase()
                : roomName[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800 dark:text-slate-200 truncate">{roomName}</p>
              {room.room_type === 'group' && (
                <p className="text-xs text-gray-400 dark:text-slate-500">{membersCount} участн.</p>
              )}
            </div>
            {room.room_type === 'group' && (
              <button
                onClick={() => setShowMembers(true)}
                className="p-2 text-gray-400 dark:text-slate-500 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
                title="Участники"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            )}
          </>
        )}
      </div>

      {/* Список сообщений */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto py-2 px-2 bg-gray-50 dark:bg-slate-900 relative"
        onScroll={handleScroll}
      >
        <div ref={topRef} className="h-1" />

        {loadingMore && (
          <div className="flex justify-center py-2">
            <span className="text-xs text-gray-400 dark:text-slate-500">Загрузка...</span>
          </div>
        )}
        {loadingHistory && (
          <div className="flex justify-center py-10 text-gray-400 dark:text-slate-500 text-sm">Загрузка...</div>
        )}
        {!loadingHistory && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-slate-500">
            <p>Нет сообщений</p>
            <p className="text-sm mt-1">Начните переписку!</p>
          </div>
        )}

        {groupByDate(messages).map(({ date, messages: dayMsgs }) => (
          <div key={date}>
            <div className="flex justify-center my-3">
              <span className="text-xs bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400 px-3 py-0.5 rounded-full">
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
                onVotePoll={handleVotePoll}
                onTakeTask={handleTakeTask}
                onReact={handleReact}
                allowedEmojis={allowedEmojis}
                selectionMode={selectionMode}
                selected={selectedIds.has(msg.id)}
                onSelect={handleToggleSelect}
                onMsgMouseDown={selectionMode ? handleMsgMouseDown : undefined}
                onMsgMouseEnter={selectionMode ? handleMsgMouseEnter : undefined}
                currentUserMention={currentUserMention}
              />
            ))}
          </div>
        ))}

        {typingUsers.length > 0 && (
          <div className="px-4 py-1">
            <span className="text-xs text-gray-400 dark:text-slate-500 italic">
              {typingUsers.map((u) => u.name).join(', ')} печатает...
            </span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Кнопка вниз / к новым */}
      {!isAtBottom && !selectionMode && (
        <button
          onClick={() => {
            scrollToBottom(true);
            setNewMsgCount(0);
            api.post(`/chat/rooms/${room.id}/read/`).catch(() => {});
          }}
          className="absolute bottom-24 right-4 z-30 flex items-center gap-1.5 bg-purple-500 hover:bg-purple-600 text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-lg transition-colors"
        >
          {newMsgCount > 0 ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              {newMsgCount} новых
            </>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </button>
      )}

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
      {!selectionMode && (
        <div className="bg-white dark:bg-slate-800 flex-shrink-0" style={{ boxShadow: '0 -1px 0 #f0f0f0' }}>
          {restrictionError && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-t border-red-100">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-red-600">{restrictionError}</p>
            </div>
          )}

          {replyTo && (
            <div className="flex items-center gap-2 px-4 pt-2 pb-1 bg-purple-50">
              <div className="flex-1 min-w-0 pl-2 border-l-2 border-purple-400">
                <p className="text-xs font-medium text-purple-600 truncate">{replyTo.sender?.display_name}</p>
                <p className="text-xs text-gray-600 dark:text-slate-400 truncate">{replyTo.text || '[файл]'}</p>
              </div>
              <button onClick={() => setReplyTo(null)} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 flex-shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* @mention dropdown */}
          {mentionState && (mentionCandidates.length > 0 || mentionState.query === '') && (
            <div className="mx-3 mb-1 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
              {(mentionState.query === '' || 'all'.startsWith(mentionState.query)) && (
                <button
                  onClick={() => insertMention('all')}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-purple-50 flex items-center gap-2"
                >
                  <span className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-700">@</span>
                  <span className="font-medium text-amber-700">@all</span>
                  <span className="text-xs text-gray-400 dark:text-slate-500 ml-1">— все участники</span>
                </button>
              )}
              {mentionCandidates.map((m) => (
                <button
                  key={m.user.id}
                  onClick={() => insertMention(m.user.last_name)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-purple-50 flex items-center gap-2"
                >
                  <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-700 flex-shrink-0">
                    {m.user.last_name[0]}{m.user.first_name[0]}
                  </div>
                  <span>{m.user.last_name} {m.user.first_name}</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2 px-3 py-3">
            <button
              onClick={() => setShowEmoji((v) => !v)}
              className={`flex-shrink-0 p-2 rounded-full transition-colors ${showEmoji ? 'text-yellow-500 bg-yellow-50' : 'text-gray-400 dark:text-slate-500 hover:text-gray-600'}`}
              title="Эмодзи"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>

            {showAttachButton && (
              <>
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
                <div className="relative flex-shrink-0">
                  <button
                    onClick={() => setShowAttachMenu((v) => !v)}
                    disabled={uploading}
                    className={`p-2 disabled:opacity-50 rounded-full transition-colors ${showAttachMenu ? 'text-purple-500 bg-purple-50' : 'text-gray-400 dark:text-slate-500 hover:text-gray-600'}`}
                    title="Прикрепить"
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
                  {showAttachMenu && (
                    <div className="absolute bottom-full left-0 mb-1 bg-white dark:bg-slate-800 shadow-lg rounded-xl border border-gray-100 dark:border-slate-700 p-1 flex flex-col gap-0.5 min-w-[130px] z-50">
                      {canFile && (
                        <button
                          onClick={() => { setShowAttachMenu(false); fileInputRef.current?.click(); }}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 text-left"
                        >
                          <svg className="w-4 h-4 text-gray-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                          Файл
                        </button>
                      )}
                      {canPoll && (
                        <button
                          onClick={() => { setShowAttachMenu(false); setShowPollModal(true); }}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 text-left"
                        >
                          <svg className="w-4 h-4 text-gray-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          Опрос
                        </button>
                      )}
                      {canTask && (
                        <button
                          onClick={() => { setShowAttachMenu(false); setShowTaskModal(true); }}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 text-left"
                        >
                          <svg className="w-4 h-4 text-gray-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                          </svg>
                          Задача
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              rows={1}
              className="flex-1 border border-gray-200 dark:border-slate-700 rounded-2xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none max-h-32 overflow-y-auto bg-gray-50 dark:bg-slate-900"
              placeholder="Написать сообщение..."
              style={{ minHeight: '38px' }}
              onClick={() => setShowEmoji(false)}
            />

            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="flex-shrink-0 p-2 bg-purple-500 text-white rounded-full hover:bg-purple-600 disabled:opacity-40 disabled:cursor-default transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      )}

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
      {showPollModal && <PollCreatorModal roomId={room.id} onClose={() => setShowPollModal(false)} />}
      {showTaskModal && <TaskCreatorModal roomId={room.id} onClose={() => setShowTaskModal(false)} />}
    </div>
  );
}

// ─── PollCreatorModal ──────────────────────────────────────────────────────────

function PollCreatorModal({ roomId, onClose }: { roomId: number; onClose: () => void }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isMultiple, setIsMultiple] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const q = question.trim();
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (!q || opts.length < 2) return;
    setSubmitting(true);
    try {
      await api.post(`/chat/rooms/${roomId}/polls/`, { question: q, options: opts, is_multiple: isMultiple });
      onClose();
    } catch { /* ignore */ }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800 dark:text-slate-200">Создать опрос</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-slate-500 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-slate-400 block mb-1">Вопрос</label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={2}
            className="w-full border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
            placeholder="Введите вопрос..."
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-slate-400 block mb-1">Варианты ответов</label>
          <div className="flex flex-col gap-2">
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={opt}
                  onChange={(e) => setOptions((prev) => prev.map((o, idx) => idx === i ? e.target.value : o))}
                  className="flex-1 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                  placeholder={`Вариант ${i + 1}`}
                />
                {options.length > 2 && (
                  <button onClick={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))} className="text-gray-400 dark:text-slate-500 hover:text-red-500 flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
            {options.length < 10 && (
              <button onClick={() => setOptions((prev) => [...prev, ''])} className="text-sm text-purple-500 hover:text-purple-700 text-left mt-1">
                + Добавить вариант
              </button>
            )}
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={isMultiple} onChange={(e) => setIsMultiple(e.target.checked)} className="rounded" />
          <span className="text-sm text-gray-700 dark:text-slate-300">Мультивыбор</span>
        </label>
        <div className="flex gap-2 justify-end mt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl">Отмена</button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !question.trim() || options.filter((o) => o.trim()).length < 2}
            className="px-4 py-2 text-sm bg-purple-500 text-white rounded-xl hover:bg-purple-600 disabled:opacity-40"
          >
            {submitting ? 'Отправка...' : 'Создать опрос'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TaskCreatorModal ──────────────────────────────────────────────────────────

function TaskCreatorModal({ roomId, onClose }: { roomId: number; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const t = title.trim();
    if (!t) return;
    setSubmitting(true);
    try {
      await api.post(`/chat/rooms/${roomId}/chat-tasks/`, {
        title: t, description: description.trim(), due_date: dueDate || null,
      });
      onClose();
    } catch { /* ignore */ }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800 dark:text-slate-200">Создать задачу в чате</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-slate-500 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-slate-400 block mb-1">Название *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
            placeholder="Название задачи..."
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-slate-400 block mb-1">Описание</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
            placeholder="Описание (необязательно)..."
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-slate-400 block mb-1">Срок выполнения</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>
        <div className="flex gap-2 justify-end mt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl">Отмена</button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !title.trim()}
            className="px-4 py-2 text-sm bg-purple-500 text-white rounded-xl hover:bg-purple-600 disabled:opacity-40"
          >
            {submitting ? 'Отправка...' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  );
}
