import { useState, useEffect, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle, Color, FontSize, FontFamily } from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';

interface NewsPost {
  id: number;
  title: string;
  content: string;
  author_name: string;
  created_at: string;
  updated_at: string;
  is_published: boolean;
  for_staff: boolean;
  for_parents: boolean; // DB field; UI label = «Ученики и родители»
  is_read: boolean;
}

// Custom Image extension with style attribute (for float + width)
const CustomImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: {
        default: null,
        parseHTML: el => el.getAttribute('style'),
        renderHTML: attrs => (attrs.style ? { style: attrs.style } : {}),
      },
    };
  },
});

// Update a single CSS property inside a style string, preserve the rest
function setStyleProp(style: string | null, prop: string, value: string): string | null {
  const parts = (style || '')
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.toLowerCase().startsWith(prop.toLowerCase() + ':'));
  if (value) parts.push(`${prop}: ${value}`);
  return parts.join('; ') || null;
}

// Extract a CSS property value from a style string
function getStyleProp(style: string | null, prop: string): string {
  if (!style) return '';
  const m = style.split(';').find(s => s.trim().toLowerCase().startsWith(prop.toLowerCase() + ':'));
  return m ? m.split(':').slice(1).join(':').trim() : '';
}

// ─── Constants ──────────────────────────────────────────────────────────────

const FONT_SIZES = ['12', '14', '16', '18', '20', '24', '28', '32', '36', '48'];
const FONT_FAMILIES = [
  { label: 'По умолчанию', value: '' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Courier New', value: '"Courier New", monospace' },
  { label: 'Times New Roman', value: '"Times New Roman", serif' },
];
const COLORS = [
  '#000000', '#374151', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff',
];
const PAGE_SIZE = 5;

// ─── Toolbar button ──────────────────────────────────────────────────────────

function Btn({
  active, onClick, title, children,
}: {
  active?: boolean; onClick: () => void; title?: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      className={`px-2 py-1 rounded text-sm transition-colors ${
        active ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  );
}

// ─── Icons for list buttons ──────────────────────────────────────────────────

function IconBulletList() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="1.5" cy="4" r="1.5" />
      <circle cx="1.5" cy="8" r="1.5" />
      <circle cx="1.5" cy="12" r="1.5" />
      <rect x="4" y="3.2" width="12" height="1.6" rx="0.8" />
      <rect x="4" y="7.2" width="10" height="1.6" rx="0.8" />
      <rect x="4" y="11.2" width="11" height="1.6" rx="0.8" />
    </svg>
  );
}

function IconOrderedList() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
      {/* "1." "2." "3." */}
      <text x="0" y="5.5" fontSize="5.5" fontFamily="monospace" fontWeight="bold">1.</text>
      <text x="0" y="9.5" fontSize="5.5" fontFamily="monospace" fontWeight="bold">2.</text>
      <text x="0" y="13.5" fontSize="5.5" fontFamily="monospace" fontWeight="bold">3.</text>
      <rect x="5" y="3.2" width="11" height="1.6" rx="0.8" />
      <rect x="5" y="7.2" width="9" height="1.6" rx="0.8" />
      <rect x="5" y="11.2" width="10" height="1.6" rx="0.8" />
    </svg>
  );
}

// ─── News editor toolbar ─────────────────────────────────────────────────────

function NewsEditor({
  editor,
  onImageUpload,
}: {
  editor: ReturnType<typeof useEditor> | null;
  onImageUpload: (file: File) => Promise<string>;
}) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const colorRef = useRef<HTMLDivElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) setShowColorPicker(false);
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setShowEmojiPicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!editor) return null;

  const rawSize = editor.getAttributes('textStyle').fontSize || '';
  const currentSize = rawSize.replace('px', '') || '16';
  const currentFamily = editor.getAttributes('textStyle').fontFamily || '';

  // Image state (computed from editor on each render — useEditor triggers re-renders on state change)
  const isImageSelected = editor.isActive('image');
  const imgStyle = isImageSelected ? (editor.getAttributes('image').style || '') : '';
  const imgSrc = isImageSelected ? (editor.getAttributes('image').src || '') : '';
  const currentWidth = getStyleProp(imgStyle, 'width');

  const handleImageFile = async (file: File) => {
    const url = await onImageUpload(file);
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  const setImageFloat = (floatCss: string) => {
    // Preserve existing width
    const w = getStyleProp(imgStyle, 'width');
    let s = floatCss;
    if (w) s = s ? `${s}; width: ${w}` : `width: ${w}`;
    editor.chain().focus().updateAttributes('image', { style: s || null }).run();
  };

  const applyImageWidth = (val: string) => {
    const trimmed = val.trim();
    const newStyle = setStyleProp(imgStyle, 'width', trimmed);
    editor.chain().focus().updateAttributes('image', { style: newStyle }).run();
  };

  return (
    <div className="border-b border-gray-200">
      {/* Row 1: font + text decoration */}
      <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 border-b border-gray-100">
        <select
          className="text-sm border border-gray-200 rounded px-1 py-0.5 mr-1"
          value={currentFamily}
          onChange={e => {
            if (e.target.value) editor.chain().focus().setFontFamily(e.target.value).run();
            else editor.chain().focus().unsetFontFamily().run();
          }}
        >
          {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>

        <select
          className="text-sm border border-gray-200 rounded px-1 py-0.5 mr-2"
          value={currentSize}
          onChange={e => editor.chain().focus().setFontSize(`${e.target.value}px`).run()}
        >
          {FONT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <Btn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Жирный"><b>B</b></Btn>
        <Btn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Курсив"><i>I</i></Btn>
        <Btn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Подчёркнутый"><u>U</u></Btn>
        <Btn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Зачёркнутый"><s>S</s></Btn>

        {/* Color */}
        <div ref={colorRef} className="relative ml-1">
          <button
            type="button"
            title="Цвет текста"
            onMouseDown={e => { e.preventDefault(); setShowColorPicker(v => !v); }}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 text-sm text-gray-700"
          >
            <span className="font-bold" style={{ color: editor.getAttributes('textStyle').color || '#000' }}>A</span>
            <svg className="w-3 h-3 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
          {showColorPicker && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3">
              <div className="grid grid-cols-5 gap-1.5">
                {COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onMouseDown={e => { e.preventDefault(); editor.chain().focus().setColor(c).run(); setShowColorPicker(false); }}
                    className="w-6 h-6 rounded border border-gray-300 hover:scale-110 transition-transform"
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); editor.chain().focus().unsetColor().run(); setShowColorPicker(false); }}
                className="mt-2 text-xs text-gray-500 hover:text-gray-700 w-full text-center"
              >
                Сбросить цвет
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: lists + image + emoji */}
      <div className="flex flex-wrap items-center gap-0.5 px-3 py-2">
        <Btn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Маркированный список">
          <IconBulletList />
        </Btn>
        <Btn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Нумерованный список">
          <IconOrderedList />
        </Btn>

        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* Image upload */}
        <button
          type="button"
          title="Вставить изображение"
          onMouseDown={e => { e.preventDefault(); imageInputRef.current?.click(); }}
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 text-sm text-gray-700"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Фото
        </button>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) handleImageFile(file);
            e.target.value = '';
          }}
        />

        {/* Image controls — visible when image is selected */}
        {isImageSelected && (
          <>
            <div className="w-px h-5 bg-gray-200 mx-1" />
            <span className="text-xs text-gray-500">Обтекание:</span>
            <button
              type="button"
              title="Текст справа от картинки"
              onMouseDown={e => { e.preventDefault(); setImageFloat('float: left; margin: 0 16px 8px 0'); }}
              className="px-2 py-1 rounded hover:bg-gray-100 text-xs text-gray-700 font-medium"
            >
              ◧ Слева
            </button>
            <button
              type="button"
              title="Текст слева от картинки"
              onMouseDown={e => { e.preventDefault(); setImageFloat('float: right; margin: 0 0 8px 16px'); }}
              className="px-2 py-1 rounded hover:bg-gray-100 text-xs text-gray-700 font-medium"
            >
              ◨ Справа
            </button>
            <button
              type="button"
              title="По центру без обтекания"
              onMouseDown={e => { e.preventDefault(); setImageFloat('display: block; margin: 8px auto'); }}
              className="px-2 py-1 rounded hover:bg-gray-100 text-xs text-gray-700 font-medium"
            >
              ▣ Центр
            </button>

            <div className="w-px h-5 bg-gray-200 mx-1" />
            <span className="text-xs text-gray-500">Ширина:</span>
            <input
              key={imgSrc}
              type="text"
              defaultValue={currentWidth}
              placeholder="авто"
              title="Ширина: 300px, 50%, 100% …"
              className="w-20 text-xs border border-gray-200 rounded px-1.5 py-0.5 text-gray-700 focus:outline-none focus:border-blue-400"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  applyImageWidth((e.target as HTMLInputElement).value);
                }
              }}
              onBlur={e => applyImageWidth(e.target.value)}
            />
          </>
        )}

        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* Emoji */}
        <div ref={emojiRef} className="relative">
          <button
            type="button"
            title="Вставить эмодзи"
            onMouseDown={e => { e.preventDefault(); setShowEmojiPicker(v => !v); }}
            className="px-2 py-1 rounded hover:bg-gray-100 text-sm text-gray-700"
          >
            😊 Эмодзи
          </button>
          {showEmojiPicker && (
            <div className="absolute top-full left-0 mt-1 z-50">
              <Picker
                data={data}
                locale="ru"
                onEmojiSelect={(emoji: { native: string }) => {
                  editor.chain().focus().insertContent(emoji.native).run();
                  setShowEmojiPicker(false);
                }}
                theme="light"
                previewPosition="none"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function AudienceBadge({ forStaff, forParents }: { forStaff: boolean; forParents: boolean }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {forStaff && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
          Сотрудники
        </span>
      )}
      {forParents && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
          Ученики и родители
        </span>
      )}
    </div>
  );
}

// ─── Editor modal ─────────────────────────────────────────────────────────────

interface EditorModalProps {
  initial?: NewsPost | null;
  onClose: () => void;
  onSaved: (post: NewsPost) => void;
}

function EditorModal({ initial, onClose, onSaved }: EditorModalProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [forStaff, setForStaff] = useState(initial?.for_staff ?? false);
  const [forParents, setForParents] = useState(initial?.for_parents ?? false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');

  const editor = useEditor({
    extensions: [StarterKit, TextStyle, Color, FontSize, FontFamily, Underline, CustomImage.configure({ allowBase64: false })],
    content: initial?.content ?? '',
  });

  const uploadImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file);
    const res = await api.post('/news/upload-image/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.url;
  };

  const save = async (publish?: boolean) => {
    if (!title.trim()) { setError('Введите заголовок'); return; }
    const content = editor?.getHTML() ?? '';
    const body = { title, content, for_staff: forStaff, for_parents: forParents };

    try {
      setSaving(true);
      setError('');
      let post: NewsPost;
      if (initial) {
        const res = await api.put(`/news/${initial.id}/`, body);
        post = res.data;
      } else {
        const res = await api.post('/news/', body);
        post = res.data;
      }

      if (publish && !post.is_published) {
        setPublishing(true);
        const res2 = await api.post(`/news/${post.id}/publish/`);
        post = { ...post, is_published: res2.data.is_published };
      }

      onSaved(post);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err.response?.data?.detail ?? 'Ошибка сохранения');
    } finally {
      setSaving(false);
      setPublishing(false);
    }
  };

  const canPublish = forStaff || forParents;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-4xl" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {initial ? 'Редактировать новость' : 'Новая новость'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Title input */}
        <div className="px-6 py-3 border-b border-gray-100">
          <input
            type="text"
            placeholder="Заголовок новости"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full text-xl font-semibold text-gray-900 placeholder-gray-300 outline-none"
          />
        </div>

        {/* Toolbar */}
        <NewsEditor editor={editor} onImageUpload={uploadImage} />

        {/* Editor content */}
        <div className="flex-1 overflow-y-auto px-6 py-4" style={{ minHeight: '200px' }}>
          <EditorContent
            editor={editor}
            className="prose prose-sm max-w-none focus:outline-none min-h-[180px] [&_.tiptap]:outline-none"
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Аудитория:</p>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={forStaff}
                  onChange={e => setForStaff(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Сотрудники</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={forParents}
                  onChange={e => setForParents(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <span className="text-sm text-gray-700">Ученики и родители</span>
              </label>
            </div>
            {!canPublish && (
              <p className="text-xs text-amber-600 mt-1.5">Выберите аудиторию для публикации</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {error && <span className="text-sm text-red-600">{error}</span>}
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              Отмена
            </button>
            <button
              onClick={() => save(false)}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {saving && !publishing ? 'Сохраняю...' : 'Сохранить черновик'}
            </button>
            <button
              onClick={() => save(true)}
              disabled={saving || !canPublish}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {publishing ? 'Публикую...' : (initial?.is_published ? 'Обновить' : 'Опубликовать')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NewsPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editingPost, setEditingPost] = useState<NewsPost | null>(null);

  const isAdmin = user?.is_admin;
  const hasMore = posts.length < total;

  const load = useCallback(async (offset = 0) => {
    try {
      if (offset === 0) setLoading(true);
      else setLoadingMore(true);

      const res = await api.get(`/news/?limit=${PAGE_SIZE}&offset=${offset}`);
      const { results, count }: { results: NewsPost[]; count: number } = res.data;

      setPosts(prev => offset === 0 ? results : [...prev, ...results]);
      setTotal(count);

      // Auto-mark visible unread published posts as read
      const unread = results.filter((p: NewsPost) => !p.is_read && p.is_published);
      if (unread.length > 0) {
        setPosts(prev => prev.map(p => unread.some(u => u.id === p.id) ? { ...p, is_read: true } : p));
        Promise.all(unread.map(p => api.post(`/news/${p.id}/read/`).catch(() => {})));
        window.dispatchEvent(new CustomEvent('news:read'));
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { load(0); }, [load]);

  const handleSaved = (post: NewsPost) => {
    const isNew = !posts.some(p => p.id === post.id);
    setPosts(prev => isNew ? [post, ...prev] : prev.map(p => p.id === post.id ? post : p));
    if (isNew) setTotal(t => t + 1);
    setShowEditor(false);
    setEditingPost(null);
  };

  const handlePublishToggle = async (post: NewsPost) => {
    try {
      const res = await api.post(`/news/${post.id}/publish/`);
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, is_published: res.data.is_published } : p));
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      alert(err.response?.data?.detail ?? 'Ошибка');
    }
  };

  const handleDelete = async (post: NewsPost) => {
    if (!confirm(`Удалить новость «${post.title}»?`)) return;
    try {
      await api.delete(`/news/${post.id}/`);
      setPosts(prev => prev.filter(p => p.id !== post.id));
      setTotal(t => t - 1);
    } catch {
      alert('Ошибка при удалении');
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Новости</h1>
        {isAdmin && (
          <button
            onClick={() => { setEditingPost(null); setShowEditor(true); }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Создать новость
          </button>
        )}
      </div>

      {/* Feed */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Загрузка...</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l6 6v10a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-400 text-sm">Новостей пока нет</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-5">
            {posts.map(post => {
              const isDraft = !post.is_published;
              return (
                <article
                  key={post.id}
                  className={`bg-white rounded-xl border shadow-sm ${
                    isDraft ? 'border-dashed border-gray-300' : 'border-gray-200'
                  }`}
                >
                  {/* Card header */}
                  <div className="px-5 pt-5 pb-3">
                    <div className="flex items-start gap-3 justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isDraft && isAdmin && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                            Черновик
                          </span>
                        )}
                        <AudienceBadge forStaff={post.for_staff} forParents={post.for_parents} />
                      </div>
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900 leading-snug mb-1">
                      {post.title || <span className="text-gray-400 italic">Без заголовка</span>}
                    </h2>
                    <p className="text-xs text-gray-400">
                      {post.author_name} · {formatDate(post.created_at)}
                    </p>
                  </div>

                  {/* Content — always expanded */}
                  <div className="px-5 pb-4">
                    <div
                      className="prose prose-sm max-w-none text-gray-700"
                      // eslint-disable-next-line react/no-danger
                      dangerouslySetInnerHTML={{ __html: post.content }}
                    />
                    {/* Clearfix for floated images */}
                    <div style={{ clear: 'both' }} />

                    {/* Admin controls */}
                    {isAdmin && (
                      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                        <button
                          onClick={() => { setEditingPost(post); setShowEditor(true); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Редактировать
                        </button>
                        <button
                          onClick={() => handlePublishToggle(post)}
                          disabled={!post.is_published && !(post.for_staff || post.for_parents)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-40 ${
                            post.is_published
                              ? 'text-amber-700 border border-amber-200 hover:bg-amber-50'
                              : 'text-green-700 border border-green-200 hover:bg-green-50'
                          }`}
                        >
                          {post.is_published ? 'Снять с публикации' : 'Опубликовать'}
                        </button>
                        <button
                          onClick={() => handleDelete(post)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors ml-auto"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Удалить
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {/* Load more */}
          {hasMore && (
            <div className="mt-6 text-center">
              <button
                onClick={() => load(posts.length)}
                disabled={loadingMore}
                className="px-6 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {loadingMore ? 'Загружаю...' : `Загрузить ещё (осталось ${total - posts.length})`}
              </button>
            </div>
          )}
        </>
      )}

      {/* Editor modal */}
      {showEditor && (
        <EditorModal
          initial={editingPost}
          onClose={() => { setShowEditor(false); setEditingPost(null); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
