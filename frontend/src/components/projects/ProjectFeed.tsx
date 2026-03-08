import { useState, useEffect, useRef, useCallback } from 'react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import api from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import type { ProjectPost, PostAttachment } from '../../types';

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' }) +
    ' ' + d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + ' Б';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' КБ';
  return (bytes / 1024 / 1024).toFixed(1) + ' МБ';
}

function AttachmentList({ attachments }: { attachments: PostAttachment[] }) {
  if (!attachments.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {attachments.map(a => (
        <a
          key={a.id}
          href={a.file_url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg px-3 py-1.5 text-xs text-gray-700 dark:text-slate-300 transition-colors"
        >
          <svg className="w-3.5 h-3.5 text-gray-500 dark:text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
          <span className="max-w-[150px] truncate">{a.original_name}</span>
          <span className="text-gray-400 dark:text-slate-500">{formatFileSize(a.file_size)}</span>
        </a>
      ))}
    </div>
  );
}

function PostBubble({
  post,
  isOwn,
  canDelete,
  onDelete,
}: {
  post: ProjectPost;
  isOwn: boolean;
  canDelete: boolean;
  onDelete: (id: number) => void;
}) {
  if (post.is_deleted) {
    return (
      <div className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
        <div className="text-xs text-gray-400 dark:text-slate-500 italic py-1">сообщение удалено</div>
      </div>
    );
  }

  const name = post.author
    ? `${post.author.last_name} ${post.author.first_name}`
    : 'Удалённый пользователь';
  const initials = post.author
    ? `${post.author.last_name[0] || ''}${post.author.first_name[0] || ''}`
    : '?';

  return (
    <div className={`flex gap-2 group ${isOwn ? 'flex-row-reverse' : ''}`}>
      {/* Аватар */}
      <div className="w-8 h-8 rounded-full bg-purple-100 flex-shrink-0 flex items-center justify-center text-purple-700 font-bold text-xs select-none mt-1">
        {initials}
      </div>
      <div className={`flex flex-col max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
        {!isOwn && (
          <span className="text-xs text-gray-500 dark:text-slate-400 mb-0.5 px-1">{name}</span>
        )}
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words ${
            isOwn
              ? 'bg-purple-600 text-white rounded-tr-sm'
              : 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-slate-100 rounded-tl-sm'
          }`}
        >
          {post.text}
          <AttachmentList attachments={post.attachments} />
        </div>
        <div className="flex items-center gap-2 mt-0.5 px-1">
          <span className="text-xs text-gray-400 dark:text-slate-500">{formatTime(post.created_at)}</span>
          {canDelete && (
            <button
              onClick={() => onDelete(post.id)}
              className="text-xs text-gray-300 dark:text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              удалить
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface Props {
  projectId: number;
  isTeacher: boolean;
  isAdult: boolean;
}

export default function ProjectFeed({ projectId, isTeacher }: Props) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<ProjectPost[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [typingUsers, setTypingUsers] = useState<{ id: number; name: string }[]>([]);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [restrictionError, setRestrictionError] = useState('');
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const projectIdRef = useRef(projectId);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeouts = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Закрыть emoji picker при клике вне
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handler = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmojiPicker]);

  const handleEmojiSelect = useCallback((emoji: { native: string }) => {
    const el = textareaRef.current;
    if (!el) { setInput(prev => prev + emoji.native); return; }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    setInput(prev => prev.slice(0, start) + emoji.native + prev.slice(end));
    setShowEmojiPicker(false);
    setTimeout(() => {
      el.focus();
      const pos = start + emoji.native.length;
      el.setSelectionRange(pos, pos);
    }, 0);
  }, []);

  // Load history
  useEffect(() => {
    projectIdRef.current = projectId;
    setPosts([]);
    setLoadingHistory(true);
    api.get(`/projects/${projectId}/posts/`)
      .then(res => {
        setPosts(res.data.results);
        setHasMore(res.data.has_more);
        setTimeout(scrollToBottom, 50);
      })
      .finally(() => setLoadingHistory(false));
  }, [projectId, scrollToBottom]);

  // WebSocket
  useEffect(() => {
    const connect = () => {
      const token = localStorage.getItem('access_token');
      if (!token) return;
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${window.location.host}/ws/project/${projectId}/?token=${token}`);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (projectIdRef.current !== projectId) return;

          if (data.type === 'post_new') {
            setPosts(prev => {
              if (prev.find(p => p.id === data.post.id)) return prev;
              return [...prev, data.post];
            });
            setTimeout(scrollToBottom, 50);
          } else if (data.type === 'post_deleted') {
            setPosts(prev => prev.map(p =>
              p.id === data.post_id ? { ...p, is_deleted: true, text: '' } : p
            ));
          } else if (data.type === 'post_updated') {
            setPosts(prev => prev.map(p =>
              p.id === data.post.id ? data.post : p
            ));
          } else if (data.type === 'restriction_error') {
            setRestrictionError(data.detail);
            setTimeout(() => setRestrictionError(''), 5000);
          } else if (data.type === 'user_typing') {
            setTypingUsers(prev => {
              const filtered = prev.filter(u => u.id !== data.user_id);
              return [...filtered, { id: data.user_id, name: data.display_name }];
            });
            if (typingTimeouts.current[data.user_id]) {
              clearTimeout(typingTimeouts.current[data.user_id]);
            }
            typingTimeouts.current[data.user_id] = setTimeout(() => {
              setTypingUsers(prev => prev.filter(u => u.id !== data.user_id));
            }, 3000);
          }
        } catch { /* ignore */ }
      };

      ws.onclose = (e) => {
        if (e.code !== 1000 && e.code !== 4001 && e.code !== 4003 && projectIdRef.current === projectId) {
          reconnectRef.current = setTimeout(connect, 2000);
        }
      };
    };

    connect();
    return () => {
      projectIdRef.current = -1;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [projectId, scrollToBottom]);

  const sendPost = async () => {
    if (!input.trim()) return;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      // Fallback to REST
      setSending(true);
      try {
        await api.post(`/projects/${projectId}/posts/`, { text: input.trim() });
        setInput('');
        const res = await api.get(`/projects/${projectId}/posts/`);
        setPosts(res.data.results);
        setTimeout(scrollToBottom, 50);
      } catch { /* ignore */ } finally { setSending(false); }
      return;
    }
    wsRef.current.send(JSON.stringify({ type: 'send_post', text: input.trim() }));
    setInput('');
  };

  const handleTyping = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'typing' }));
    }
  }, []);

  const handleDelete = async (postId: number) => {
    try {
      await api.delete(`/projects/${projectId}/posts/${postId}/`);
      setPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, is_deleted: true, text: '' } : p
      ));
    } catch { /* ignore */ }
  };

  const handleFileUpload = async (file: File) => {
    // Сначала создадим пост без текста — нет, лучше сначала отправим текст-пост, потом загрузим файл
    // Паттерн: создаём пост с пустым текстом, потом прикрепляем файл
    setUploading(true);
    try {
      const postRes = await api.post(`/projects/${projectId}/posts/`, {
        text: `[файл: ${file.name}]`,
      });
      const postId = postRes.data.id;
      const formData = new FormData();
      formData.append('file', file);
      await api.post(`/projects/${projectId}/posts/${postId}/files/`, formData);
      // Обновим список
      const res = await api.get(`/projects/${projectId}/posts/`);
      setPosts(res.data.results);
      setTimeout(scrollToBottom, 50);
    } catch { /* ignore */ } finally { setUploading(false); }
  };

  const loadMore = async () => {
    if (!posts.length) return;
    const oldest = posts[0];
    const res = await api.get(`/projects/${projectId}/posts/?before=${oldest.id}`);
    setPosts(prev => [...res.data.results, ...prev]);
    setHasMore(res.data.has_more);
  };

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {hasMore && (
          <button
            onClick={loadMore}
            className="w-full text-center text-xs text-purple-600 hover:underline py-1"
          >
            Загрузить предыдущие сообщения
          </button>
        )}
        {loadingHistory ? (
          <div className="text-center text-gray-400 dark:text-slate-500 text-sm py-8">Загрузка...</div>
        ) : posts.length === 0 ? (
          <div className="text-center text-gray-400 dark:text-slate-500 text-sm py-8">
            Нет сообщений. Напишите первым!
          </div>
        ) : (
          posts.map(post => (
            <PostBubble
              key={post.id}
              post={post}
              isOwn={post.author?.id === user?.id}
              canDelete={
                !post.is_deleted && (
                  post.author?.id === user?.id || isTeacher || !!user?.is_admin
                )
              }
              onDelete={handleDelete}
            />
          ))
        )}
        {typingUsers.length > 0 && (
          <div className="text-xs text-gray-400 dark:text-slate-500 italic px-2">
            {typingUsers.map(u => u.name).join(', ')} печатает...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-100 dark:border-slate-700 px-4 py-3 bg-white dark:bg-slate-800">
        {restrictionError && (
          <div className="mb-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
            {restrictionError}
          </div>
        )}
        <div className="flex gap-2 items-end relative">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex-shrink-0 p-2 rounded-lg text-gray-400 dark:text-slate-500 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-40"
            title="Прикрепить файл"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          {/* Emoji picker button */}
          <div className="relative flex-shrink-0" ref={emojiPickerRef}>
            <button
              onClick={() => setShowEmojiPicker(v => !v)}
              className="p-2 rounded-lg text-gray-400 dark:text-slate-500 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
              title="Смайлик"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            {showEmojiPicker && (
              <div className="absolute bottom-full left-0 mb-2 z-50">
                <Picker
                  data={data}
                  onEmojiSelect={handleEmojiSelect}
                  locale="ru"
                  theme="light"
                  previewPosition="none"
                  skinTonePosition="none"
                />
              </div>
            )}
          </div>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onInput={handleTyping}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendPost();
              }
            }}
            placeholder="Написать в ленту..."
            rows={1}
            className="flex-1 rounded-xl border border-gray-300 dark:border-slate-600 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none max-h-32 overflow-y-auto"
            style={{ fieldSizing: 'content' } as React.CSSProperties}
          />
          <button
            onClick={sendPost}
            disabled={!input.trim() || sending}
            className="flex-shrink-0 p-2 rounded-xl bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) handleFileUpload(f);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
