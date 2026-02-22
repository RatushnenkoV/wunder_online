import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Rnd } from 'react-rnd';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle, Color, FontSize } from '@tiptap/extension-text-style';
import api from '../api/client';
import type { Lesson, Slide, SlideBlock, ShapeType, SlideType } from '../types';

// ─── Константы ────────────────────────────────────────────────────────────────

const CANVAS_W = 960;
const CANVAS_H = 540;
const MIN_W    = 20;
const MIN_H    = 20;
const WORKSPACE_PAD = 600; // рабочая область вокруг слайда

const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 96];

function newBlockId() {
  return `b${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}
function defaultTextBlock(): SlideBlock {
  return { id: newBlockId(), type: 'text', x: 50, y: 50, w: 860, h: 120, zIndex: 1, rotation: 0, html: '<p>Введите текст</p>' };
}
function defaultImageBlock(): SlideBlock {
  return { id: newBlockId(), type: 'image', x: 230, y: 150, w: 500, h: 300, zIndex: 1, rotation: 0, src: '', alt: '' };
}
function defaultShapeBlock(shape: ShapeType): SlideBlock {
  const isLine = shape === 'line';
  return {
    id: newBlockId(), type: 'shape', shape,
    x: 230, y: 170,
    w: isLine ? 300 : 220,
    h: isLine ? 8   : 180,
    zIndex: 1, rotation: 0,
    fillColor:   shape === 'line' ? 'transparent' : '#6366f1',
    strokeColor: shape === 'line' ? '#6366f1'      : 'transparent',
    strokeWidth: 3,
  };
}
function emptyContent() {
  return { blocks: [defaultTextBlock()] };
}

// ─── SVG-фигуры ───────────────────────────────────────────────────────────────

function starPoints(n: number, outerR: number, innerR: number, cx: number, cy: number): string {
  return Array.from({ length: n * 2 }, (_, i) => {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / n - Math.PI / 2;
    return `${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`;
  }).join(' ');
}

// w/h — реальные размеры блока в canvas-координатах.
// viewBox совпадает с реальными размерами → strokeWidth = реальные пиксели, без искажений.
function ShapeSvg({ w, h, block }: { w: number; h: number; block: Partial<SlideBlock> }) {
  const { shape = 'rect', fillColor = '#6366f1', strokeColor = 'transparent', strokeWidth = 3 } = block;

  const fill   = fillColor   === 'transparent' ? 'none' : fillColor;
  const stroke = strokeColor === 'transparent' ? 'none' : strokeColor;
  const sw = Math.max(0, strokeWidth ?? 3);
  const half = sw / 2;

  let el: React.ReactNode;
  switch (shape) {
    case 'circle':
      el = <ellipse cx={w / 2} cy={h / 2} rx={Math.max(1, w / 2 - half)} ry={Math.max(1, h / 2 - half)}
              fill={fill} stroke={stroke} strokeWidth={sw} />;
      break;
    case 'triangle':
      el = <polygon points={`${w / 2},${half} ${w - half},${h - half} ${half},${h - half}`}
              fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />;
      break;
    case 'diamond':
      el = <polygon points={`${w / 2},${half} ${w - half},${h / 2} ${w / 2},${h - half} ${half},${h / 2}`}
              fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />;
      break;
    case 'star': {
      const minDim = Math.min(w, h);
      const outerR = Math.max(1, minDim / 2 - half);
      const innerR = outerR * 0.4;
      el = <polygon points={starPoints(5, outerR, innerR, w / 2, h / 2)}
              fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />;
      break;
    }
    case 'line':
      el = <line x1={half} y1={h / 2} x2={w - half} y2={h / 2}
              stroke={strokeColor === 'transparent' ? '#6366f1' : stroke}
              strokeWidth={Math.max(sw, 1)} strokeLinecap="round" />;
      break;
    default: // rect
      el = <rect x={half} y={half} width={Math.max(1, w - sw)} height={Math.max(1, h - sw)}
              fill={fill} stroke={stroke} strokeWidth={sw} rx={2} />;
  }

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible' }}>
      {el}
    </svg>
  );
}

const SHAPE_OPTIONS: { type: ShapeType; label: string }[] = [
  { type: 'rect',     label: 'Прямоугольник' },
  { type: 'circle',   label: 'Эллипс'        },
  { type: 'triangle', label: 'Треугольник'   },
  { type: 'diamond',  label: 'Ромб'          },
  { type: 'star',     label: 'Звезда'        },
  { type: 'line',     label: 'Линия'         },
];

// ─── Иконки ───────────────────────────────────────────────────────────────────

function IconArrowLeft() {
  return <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>;
}
function IconPlus() {
  return <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>;
}
function IconTrash() {
  return <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
}
function IconDrag() {
  return <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-300" fill="currentColor" viewBox="0 0 24 24"><path d="M8 6a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4zm8-16a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4z" /></svg>;
}
function IconCheck() {
  return <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>;
}
function IconImage() {
  return <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
}
function IconText() {
  return <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h10M4 18h10" /></svg>;
}

// ─── Тулбар текстового блока ──────────────────────────────────────────────────

type SaveStatus = 'saved' | 'saving' | 'unsaved';

function TiptapToolbar({ editor }: { editor: ReturnType<typeof useEditor> | null }) {
  const colorRef = useRef<HTMLInputElement>(null);

  if (!editor) return <div className="h-10 border-b border-gray-200 bg-white" />;

  const currentColor    = (editor.getAttributes('textStyle').color as string | undefined) ?? '#1f2937';
  const rawSize         = (editor.getAttributes('textStyle').fontSize as string | undefined) ?? '';
  const currentFontSize = rawSize.replace('px', '') || '16';

  const btn = (active: boolean, onClick: () => void, label: string, title: string) => (
    <button
      key={title}
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title}
      className={`px-2 py-1 text-sm rounded transition-colors ${active ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
    >{label}</button>
  );

  return (
    <div className="flex items-center gap-0.5 px-3 py-1 bg-white border-b border-gray-200 flex-wrap min-h-[40px]">
      {/* Форматирование */}
      {btn(editor.isActive('bold'),                   () => editor.chain().focus().toggleBold().run(),               'B',  'Жирный')}
      {btn(editor.isActive('italic'),                 () => editor.chain().focus().toggleItalic().run(),             'I',  'Курсив')}
      {btn(editor.isActive('strike'),                 () => editor.chain().focus().toggleStrike().run(),             'S̶', 'Зачёркнутый')}
      <div className="w-px h-5 bg-gray-200 mx-1" />
      {btn(editor.isActive('bulletList'),             () => editor.chain().focus().toggleBulletList().run(),         '•≡', 'Маркированный список')}
      {btn(editor.isActive('orderedList'),            () => editor.chain().focus().toggleOrderedList().run(),        '1≡', 'Нумерованный список')}
      <div className="w-px h-5 bg-gray-200 mx-1" />

      {/* Размер шрифта */}
      <select
        value={currentFontSize}
        onMouseDown={e => e.stopPropagation()}
        onChange={e => {
          const sz = e.target.value;
          editor.chain().focus().setMark('textStyle', { fontSize: `${sz}px` }).run();
        }}
        className="text-xs border border-gray-200 rounded px-1 h-6 text-gray-600 bg-white cursor-pointer"
        title="Размер шрифта"
      >
        {FONT_SIZES.map(s => <option key={s} value={String(s)}>{s}</option>)}
      </select>

      {/* Цвет текста */}
      <div className="flex items-center gap-1 ml-1">
        <div
          className="w-6 h-6 rounded border border-gray-300 cursor-pointer flex-shrink-0 overflow-hidden flex flex-col"
          onClick={() => colorRef.current?.click()}
          title="Цвет текста"
        >
          <div className="flex-1 flex items-center justify-center text-xs font-bold" style={{ color: currentColor }}>A</div>
          <div className="h-1.5" style={{ backgroundColor: currentColor }} />
        </div>
        <input
          ref={colorRef}
          type="color"
          value={currentColor}
          onChange={e => editor.chain().focus().setColor(e.target.value).run()}
          className="w-0 h-0 opacity-0 absolute pointer-events-none"
        />
        <button
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().unsetColor().run(); }}
          className="w-6 h-6 rounded border border-gray-200 flex items-center justify-center text-[11px] text-gray-400 hover:bg-gray-50"
          title="Сбросить цвет"
        >∅</button>
      </div>
    </div>
  );
}

// ─── Тулбар фигуры ────────────────────────────────────────────────────────────

function ShapeToolbar({ block, onChange }: { block: SlideBlock; onChange: (p: Partial<SlideBlock>) => void }) {
  const fillRef   = useRef<HTMLInputElement>(null);
  const strokeRef = useRef<HTMLInputElement>(null);
  const transparentBg = 'repeating-conic-gradient(#ccc 0% 25%, white 0% 50%) 0 0 / 8px 8px';
  const isFillTransp   = block.fillColor   === 'transparent';
  const isStrokeTransp = block.strokeColor === 'transparent';

  return (
    <div className="flex items-center gap-3 px-3 py-1 bg-white border-b border-gray-200 flex-wrap min-h-[40px] text-xs">

      {/* Заливка */}
      <div className="flex items-center gap-1.5">
        <span className="text-gray-500">Заливка</span>
        <div
          className="w-6 h-6 rounded border border-gray-300 cursor-pointer flex-shrink-0"
          style={{ background: isFillTransp ? transparentBg : (block.fillColor ?? '#6366f1') }}
          onClick={() => !isFillTransp && fillRef.current?.click()}
          title={isFillTransp ? 'Прозрачная заливка' : 'Изменить цвет заливки'}
        />
        <input ref={fillRef} type="color"
          value={isFillTransp ? '#6366f1' : (block.fillColor ?? '#6366f1')}
          onChange={e => onChange({ fillColor: e.target.value })}
          className="w-0 h-0 opacity-0 absolute pointer-events-none"
        />
        <button
          onClick={() => onChange({ fillColor: isFillTransp ? '#6366f1' : 'transparent' })}
          className={`w-6 h-6 rounded border flex items-center justify-center text-[11px] transition-colors ${isFillTransp ? 'bg-gray-100 border-gray-400 text-gray-700' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}
          title={isFillTransp ? 'Убрать прозрачность' : 'Прозрачная заливка'}
        >∅</button>
      </div>

      <div className="w-px h-5 bg-gray-200" />

      {/* Граница */}
      <div className="flex items-center gap-1.5">
        <span className="text-gray-500">Граница</span>
        <div
          className="w-6 h-6 rounded border border-gray-300 cursor-pointer flex-shrink-0"
          style={{ background: isStrokeTransp ? transparentBg : (block.strokeColor ?? '#374151') }}
          onClick={() => !isStrokeTransp && strokeRef.current?.click()}
          title={isStrokeTransp ? 'Без границы' : 'Изменить цвет границы'}
        />
        <input ref={strokeRef} type="color"
          value={isStrokeTransp ? '#374151' : (block.strokeColor ?? '#374151')}
          onChange={e => onChange({ strokeColor: e.target.value })}
          className="w-0 h-0 opacity-0 absolute pointer-events-none"
        />
        <button
          onClick={() => onChange({ strokeColor: isStrokeTransp ? '#374151' : 'transparent' })}
          className={`w-6 h-6 rounded border flex items-center justify-center text-[11px] transition-colors ${isStrokeTransp ? 'bg-gray-100 border-gray-400 text-gray-700' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}
          title={isStrokeTransp ? 'Убрать прозрачность' : 'Без границы'}
        >∅</button>
      </div>

      {/* Слайдер толщины — только когда граница видима */}
      {!isStrokeTransp && (
        <>
          <div className="w-px h-5 bg-gray-200" />
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Толщина</span>
            <input
              type="range"
              min={1}
              max={30}
              value={block.strokeWidth ?? 3}
              onChange={e => onChange({ strokeWidth: Number(e.target.value) })}
              className="w-24 h-1.5 accent-blue-500 cursor-pointer"
              title="Толщина границы"
            />
            <span className="w-6 text-center text-gray-600">{block.strokeWidth ?? 3}</span>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Текстовый блок ───────────────────────────────────────────────────────────

interface TextBlockProps {
  block: SlideBlock;
  isEditing: boolean;
  onActivate: () => void;
  onSave: (html: string) => void;
  setActiveEditor: (ed: ReturnType<typeof useEditor> | null) => void;
}

const TextBlock = memo(function TextBlock({ block, isEditing, onActivate, onSave, setActiveEditor }: TextBlockProps) {
  const editor = useEditor({
    extensions: [StarterKit, TextStyle, Color, FontSize],
    content: block.html ?? '<p></p>',
    editable: false,
    onBlur: ({ editor }) => { onSave(editor.getHTML()); },
  }, [block.id]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(isEditing);
    if (isEditing) {
      setActiveEditor(editor);
      // Двойной rAF гарантирует, что ProseMirror уже выставил contenteditable в DOM
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (editor.isEditable) editor.commands.focus('end');
      }));
    } else {
      setActiveEditor(null);
    }
  }, [isEditing, editor]);

  useEffect(() => {
    if (!editor || isEditing) return;
    if (editor.getHTML() !== block.html) {
      editor.commands.setContent(block.html ?? '<p></p>', false);
    }
  }, [block.html, isEditing]);

  return (
    <div
      className="w-full h-full overflow-hidden"
      onClick={e => e.stopPropagation()}
      onDoubleClick={e => { e.stopPropagation(); onActivate(); }}
      style={{ cursor: isEditing ? 'text' : 'default' }}
    >
      <EditorContent editor={editor} className="w-full h-full" style={{ pointerEvents: isEditing ? 'auto' : 'none' }} />
    </div>
  );
});

// ─── Блок изображения ─────────────────────────────────────────────────────────

const ImageBlock = memo(function ImageBlock({ block, lessonId, onSave }: { block: SlideBlock; lessonId: number; onSave: (src: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post(`/lessons/lessons/${lessonId}/upload/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      onSave(res.data.url);
    } finally { setUploading(false); }
  };

  if (block.src) {
    return (
      <div className="w-full h-full relative group" onClick={e => e.stopPropagation()}>
        <img src={block.src} alt={block.alt ?? ''} className="w-full h-full object-contain" draggable={false} onDragStart={e => e.preventDefault()} />
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
          className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 text-xs bg-black/50 text-white rounded"
        >Заменить</button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); }} />
      </div>
    );
  }

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded bg-gray-50 text-gray-400 cursor-pointer hover:border-blue-400 hover:text-blue-400 transition-colors"
      onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
    >
      {uploading ? <span className="text-sm">Загрузка...</span> : <><IconImage /><span className="text-xs">Нажмите для загрузки</span></>}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); }} />
    </div>
  );
});

// ─── Холст слайда ─────────────────────────────────────────────────────────────

function SlideCanvas({ slide, lessonId, coverColor, onSaved }: { slide: Slide; lessonId: number; coverColor: string; onSaved: (s: Slide) => void }) {
  const content = slide.content?.blocks ? slide.content : emptyContent();
  const [blocks,       setBlocks]       = useState<SlideBlock[]>(content.blocks);
  const [selectedId,   setSelectedId]   = useState<string | null>(null);
  const [editingId,    setEditingId]     = useState<string | null>(null);
  const [activeEditor, setActiveEditor] = useState<ReturnType<typeof useEditor> | null>(null);
  const [baseScale,    setBaseScale]    = useState(1);
  const [zoomMul,      setZoomMul]      = useState(1);
  const [showShapePicker, setShowShapePicker] = useState(false);

  const containerRef      = useRef<HTMLDivElement>(null);
  const innerCanvasRef    = useRef<HTMLDivElement>(null);
  const isDraggingRef     = useRef(false);
  const saveTimer         = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shapePickerRef    = useRef<HTMLDivElement>(null);
  const copiedBlockRef    = useRef<SlideBlock | null>(null);
  const initialScrollDone = useRef(false);

  const scale = baseScale * zoomMul;

  useEffect(() => {
    const c = slide.content?.blocks ? slide.content : emptyContent();
    setBlocks(c.blocks);
    setSelectedId(null);
    setEditingId(null);
    setActiveEditor(null);
  }, [slide.id]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width;
      setBaseScale(Math.min(1, (w - 64) / CANVAS_W));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Центрирование холста при первом монтировании слайда
  useEffect(() => {
    if (initialScrollDone.current || baseScale === 0) return;
    const el = containerRef.current;
    if (!el) return;
    initialScrollDone.current = true;
    const tid = setTimeout(() => {
      const sc = baseScale;
      el.scrollLeft = Math.max(0, WORKSPACE_PAD * sc + (CANVAS_W * sc - el.clientWidth)  / 2);
      el.scrollTop  = Math.max(0, WORKSPACE_PAD * sc + (CANVAS_H * sc - el.clientHeight) / 2);
    }, 0);
    return () => clearTimeout(tid);
  }, [baseScale]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (shapePickerRef.current && !shapePickerRef.current.contains(e.target as Node)) {
        setShowShapePicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Сохранение ──────────────────────────────────────────────────────────────

  const saveBlocks = useCallback((next: SlideBlock[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await api.put(`/lessons/lessons/${lessonId}/slides/${slide.id}/`, { content: { blocks: next } });
        onSaved(res.data);
      } catch { /* ignore */ }
    }, 400);
  }, [lessonId, slide.id, onSaved]);

  const updateBlock = useCallback((id: string, patch: Partial<SlideBlock>) => {
    setBlocks(prev => {
      const next = prev.map(b => b.id === id ? { ...b, ...patch } : b);
      saveBlocks(next);
      return next;
    });
  }, [saveBlocks]);

  // Ctrl+C / Ctrl+V — копирование блоков
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (editingId) return; // не перехватываем когда редактируем текст
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === 'c') {
        const block = blocks.find(b => b.id === selectedId);
        if (!block) return;
        copiedBlockRef.current = { ...block };
        e.preventDefault();
      } else if (e.key === 'v' && copiedBlockRef.current) {
        const src = copiedBlockRef.current;
        const newBlock: SlideBlock = {
          ...src,
          id: newBlockId(),
          x: src.x + 20,
          y: src.y + 20,
          zIndex: (blocks.length > 0 ? Math.max(...blocks.map(b => b.zIndex)) : 0) + 1,
        };
        setBlocks(prev => { const next = [...prev, newBlock]; saveBlocks(next); return next; });
        setSelectedId(newBlock.id);
        e.preventDefault();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [blocks, editingId, selectedId, saveBlocks]);

  // ── Слои ────────────────────────────────────────────────────────────────────

  const bringToFront = useCallback((id: string) => {
    setBlocks(prev => { const maxZ = Math.max(...prev.map(b => b.zIndex)); const next = prev.map(b => b.id === id ? { ...b, zIndex: maxZ + 1 } : b); saveBlocks(next); return next; });
  }, [saveBlocks]);
  const sendToBack = useCallback((id: string) => {
    setBlocks(prev => { const minZ = Math.min(...prev.map(b => b.zIndex)); const next = prev.map(b => b.id === id ? { ...b, zIndex: Math.max(0, minZ - 1) } : b); saveBlocks(next); return next; });
  }, [saveBlocks]);
  const moveUp   = useCallback((id: string) => { setBlocks(prev => { const next = prev.map(b => b.id === id ? { ...b, zIndex: b.zIndex + 1 } : b); saveBlocks(next); return next; }); }, [saveBlocks]);
  const moveDown = useCallback((id: string) => { setBlocks(prev => { const next = prev.map(b => b.id === id ? { ...b, zIndex: Math.max(0, b.zIndex - 1) } : b); saveBlocks(next); return next; }); }, [saveBlocks]);

  // ── Вращение ────────────────────────────────────────────────────────────────

  const handleRotateStart = useCallback((e: React.MouseEvent, block: SlideBlock) => {
    e.stopPropagation();
    e.preventDefault();
    const inner = innerCanvasRef.current;
    if (!inner) return;
    const cx = block.x + block.w / 2;
    const cy = block.y + block.h / 2;

    const onMove = (me: MouseEvent) => {
      const rect = inner.getBoundingClientRect();
      const mx = (me.clientX - rect.left) / scale;
      const my = (me.clientY - rect.top)  / scale;
      let angle = Math.atan2(my - cy, mx - cx) * (180 / Math.PI) + 90;
      if (me.shiftKey) angle = Math.round(angle / 15) * 15;
      else angle = Math.round(angle);
      updateBlock(block.id, { rotation: angle });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [scale, updateBlock]);

  // ── Добавление / удаление ───────────────────────────────────────────────────

  const addBlock = (type: 'text' | 'image' | 'shape', shape?: ShapeType) => {
    const block = type === 'text' ? defaultTextBlock() : type === 'image' ? defaultImageBlock() : defaultShapeBlock(shape ?? 'rect');
    block.zIndex = (blocks.length > 0 ? Math.max(...blocks.map(b => b.zIndex)) : 0) + 1;
    setBlocks(prev => { const next = [...prev, block]; saveBlocks(next); return next; });
    setSelectedId(block.id);
  };

  const deleteBlock = (id: string) => {
    setBlocks(prev => { const next = prev.filter(b => b.id !== id); saveBlocks(next); return next; });
    if (selectedId === id) setSelectedId(null);
    if (editingId  === id) setEditingId(null);
  };

  const handleCanvasClick = () => {
    if (isDraggingRef.current) return;
    if (activeEditor && editingId) updateBlock(editingId, { html: activeEditor.getHTML() });
    setSelectedId(null);
    setEditingId(null);
    setActiveEditor(null);
    setShowShapePicker(false);
  };

  const selectedBlock = blocks.find(b => b.id === selectedId) ?? null;

  // ── Кастомные ручки resize (вращаются вместе с блоком) ──────────────────────

  const handleCustomResize = useCallback((
    e: React.MouseEvent,
    blockId: string,
    corner: 'tl' | 'tr' | 'bl' | 'br',
  ) => {
    e.stopPropagation();
    e.preventDefault();
    isDraggingRef.current = true;

    const block = blocks.find(b => b.id === blockId);
    if (!block) return;

    const startClient = { x: e.clientX, y: e.clientY };
    const startW = block.w;
    const startH = block.h;
    const angle = (block.rotation ?? 0) * Math.PI / 180;
    const cosA  = Math.cos(angle);
    const sinA  = Math.sin(angle);

    // Центр блока в canvas-координатах
    const cx = block.x + block.w / 2;
    const cy = block.y + block.h / 2;

    // Неподвижный угол (противоположный перетаскиваемому) в canvas-координатах
    const fixedLocalMap: { [k: string]: { lx: number; ly: number } } = {
      br: { lx: -startW / 2, ly: -startH / 2 }, // tl зафиксирован
      bl: { lx:  startW / 2, ly: -startH / 2 }, // tr зафиксирован
      tr: { lx: -startW / 2, ly:  startH / 2 }, // bl зафиксирован
      tl: { lx:  startW / 2, ly:  startH / 2 }, // br зафиксирован
    };
    const fl = fixedLocalMap[corner];
    const fixedWorld = {
      x: cx + fl.lx * cosA - fl.ly * sinA,
      y: cy + fl.lx * sinA + fl.ly * cosA,
    };

    const onMove = (me: MouseEvent) => {
      const dx = (me.clientX - startClient.x) / scale;
      const dy = (me.clientY - startClient.y) / scale;

      // Перевод смещения мыши в локальное пространство блока (поворот на -angle)
      const localDx =  dx * cosA + dy * sinA;
      const localDy = -dx * sinA + dy * cosA;

      let newW: number, newH: number;
      if      (corner === 'br') { newW = Math.max(MIN_W, startW + localDx); newH = Math.max(MIN_H, startH + localDy); }
      else if (corner === 'bl') { newW = Math.max(MIN_W, startW - localDx); newH = Math.max(MIN_H, startH + localDy); }
      else if (corner === 'tr') { newW = Math.max(MIN_W, startW + localDx); newH = Math.max(MIN_H, startH - localDy); }
      else                       { newW = Math.max(MIN_W, startW - localDx); newH = Math.max(MIN_H, startH - localDy); }

      // Новый центр: fixedWorld + R(angle) * (вектор от фикс. угла до нового центра)
      const halfLocalMap: { [k: string]: { lx: number; ly: number } } = {
        br: { lx:  newW / 2, ly:  newH / 2 },
        bl: { lx: -newW / 2, ly:  newH / 2 },
        tr: { lx:  newW / 2, ly: -newH / 2 },
        tl: { lx: -newW / 2, ly: -newH / 2 },
      };
      const hl = halfLocalMap[corner];
      const newCx = fixedWorld.x + hl.lx * cosA - hl.ly * sinA;
      const newCy = fixedWorld.y + hl.lx * sinA + hl.ly * cosA;

      updateBlock(blockId, { x: newCx - newW / 2, y: newCy - newH / 2, w: newW, h: newH });
    };

    const onUp = () => {
      setTimeout(() => { isDraggingRef.current = false; }, 100);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [blocks, scale, updateBlock]);

  // ── Контекстный тулбар ──────────────────────────────────────────────────────
  let toolbar: React.ReactNode;
  if (editingId && activeEditor)          toolbar = <TiptapToolbar editor={activeEditor} />;
  else if (selectedBlock?.type === 'shape') toolbar = <ShapeToolbar block={selectedBlock} onChange={p => updateBlock(selectedBlock.id, p)} />;
  else                                      toolbar = <div className="h-10 border-b border-gray-200 bg-white" />;

  return (
    <div className="flex flex-col h-full">
      {toolbar}

      <div
        ref={containerRef}
        className="flex-1 bg-gray-100 overflow-auto"
        style={{ position: 'relative' }}
        onClick={handleCanvasClick}
      >
        <div className="flex items-start justify-center" style={{ padding: WORKSPACE_PAD * scale }}>
          {/* Внешняя обёртка — scaled-размер холста, якорь для плавающей панели */}
          <div style={{ width: CANVAS_W * scale, height: CANVAS_H * scale, position: 'relative', flexShrink: 0 }}>

            {/* Внутренний холст 960×540 */}
            <div
              ref={innerCanvasRef}
              style={{
                width: CANVAS_W, height: CANVAS_H,
                transform: `scale(${scale})`, transformOrigin: 'top left',
                position: 'absolute', top: 0, left: 0,
                backgroundColor: 'white',
                boxShadow: '0 4px 32px rgba(0,0,0,0.15)',
                borderRadius: 4,
                overflow: 'visible',
              }}
              onClick={e => { e.stopPropagation(); handleCanvasClick(); }}
            >
              <div style={{ height: 4, backgroundColor: coverColor, borderRadius: '4px 4px 0 0' }} />
              <div style={{ position: 'absolute', top: 0, left: 0, width: CANVAS_W, height: CANVAS_H, border: '1px dashed rgba(0,0,0,0.08)', borderRadius: 4, pointerEvents: 'none', zIndex: 0 }} />

              {blocks.map(block => (
                <Rnd
                  key={block.id}
                  position={{ x: block.x, y: block.y }}
                  size={{ width: block.w, height: block.h }}
                  minWidth={MIN_W}
                  minHeight={MIN_H}
                  disableDragging={editingId === block.id}
                  enableResizing={false}
                  style={{ zIndex: block.zIndex }}
                  onMouseDown={e => { e.stopPropagation(); setSelectedId(block.id); }}
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  onDragStart={() => { isDraggingRef.current = true; }}
                  onDragStop={(_, d) => {
                    setTimeout(() => { isDraggingRef.current = false; }, 100);
                    updateBlock(block.id, { x: d.x, y: d.y });
                  }}
                >
                  {/* Вращение на внутреннем div — react-draggable не перезаписывает его transform */}
                  <div
                    style={{
                      width: '100%', height: '100%',
                      transform: `rotate(${block.rotation ?? 0}deg)`,
                      transformOrigin: 'center center',
                      position: 'relative',
                    }}
                  >
                    {/* Контент с рамкой выделения */}
                    <div
                      style={{
                        width: '100%', height: '100%',
                        outline: selectedId === block.id ? `2px solid ${coverColor}` : 'none',
                        outlineOffset: 1,
                        borderRadius: 2,
                        position: 'relative',
                        overflow: block.type === 'text' ? 'hidden' : 'visible',
                      }}
                    >
                      {block.type === 'text' && (
                        <TextBlock
                          block={block}
                          isEditing={editingId === block.id}
                          onActivate={() => { setSelectedId(block.id); setEditingId(block.id); }}
                          onSave={html => updateBlock(block.id, { html })}
                          setActiveEditor={setActiveEditor}
                        />
                      )}
                      {block.type === 'image' && (
                        <ImageBlock block={block} lessonId={lessonId} onSave={src => updateBlock(block.id, { src })} />
                      )}
                      {block.type === 'shape' && (
                        <div className="w-full h-full" onClick={e => e.stopPropagation()}>
                          <ShapeSvg w={block.w} h={block.h} block={block} />
                        </div>
                      )}
                    </div>

                    {/* Угловые ручки resize — внутри rotation div, вращаются вместе с блоком */}
                    {selectedId === block.id && editingId !== block.id && (
                      (['tl', 'tr', 'bl', 'br'] as const).map(corner => {
                        const s: React.CSSProperties = {
                          position: 'absolute',
                          width: 10, height: 10,
                          backgroundColor: 'white',
                          border: `2px solid ${coverColor}`,
                          borderRadius: 2,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                          zIndex: 10000,
                          cursor: corner === 'tl' ? 'nw-resize' : corner === 'tr' ? 'ne-resize' : corner === 'bl' ? 'sw-resize' : 'se-resize',
                        };
                        if (corner[0] === 't') s.top = -5; else s.bottom = -5;
                        if (corner[1] === 'l') s.left = -5; else s.right = -5;
                        return <div key={corner} style={s} onMouseDown={e => handleCustomResize(e, block.id, corner)} />;
                      })
                    )}
                  </div>
                </Rnd>
              ))}
            </div>

            {/* Плавающая панель (в scaled-пространстве) */}
            {selectedBlock && editingId !== selectedBlock.id && (() => {
              const b = selectedBlock;
              const cx = (b.x + b.w / 2) * scale;
              const ty = Math.max(-WORKSPACE_PAD * scale + 4, b.y * scale - 38);
              return (
                <div
                  style={{ position: 'absolute', left: cx, top: ty, transform: 'translateX(-50%)', zIndex: 9999, pointerEvents: 'all', userSelect: 'none' }}
                  onClick={e => e.stopPropagation()}
                  onMouseDown={e => e.stopPropagation()}
                >
                  <div className="flex items-center gap-0.5 bg-white rounded-lg shadow-lg border border-gray-200 px-1.5 py-1 text-xs whitespace-nowrap">
                    <div
                      className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 cursor-grab text-base leading-none"
                      onMouseDown={e => handleRotateStart(e, b)}
                      title="Повернуть (Shift = привязка к 15°)"
                    >↻</div>
                    {(b.rotation ?? 0) !== 0 && (
                      <>
                        <span className="text-gray-400 text-[10px] min-w-[28px] text-center">{b.rotation}°</span>
                        <button className="text-[10px] text-gray-400 hover:text-gray-700 px-0.5" onClick={() => updateBlock(b.id, { rotation: 0 })} title="Сбросить угол">✕</button>
                      </>
                    )}
                    <div className="w-px h-5 bg-gray-200 mx-0.5" />
                    <button className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-base" onClick={() => bringToFront(b.id)} title="На передний план">⬆</button>
                    <button className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-base" onClick={() => moveUp(b.id)} title="Уровень выше">↑</button>
                    <button className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-base" onClick={() => moveDown(b.id)} title="Уровень ниже">↓</button>
                    <button className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-base" onClick={() => sendToBack(b.id)} title="На задний план">⬇</button>
                    <div className="w-px h-5 bg-gray-200 mx-0.5" />
                    <button
                      className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-sm text-gray-500 hover:text-gray-800"
                      onClick={() => { copiedBlockRef.current = { ...b }; }}
                      title="Копировать (Ctrl+C)"
                    >⧉</button>
                    <div className="w-px h-5 bg-gray-200 mx-0.5" />
                    <button className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 text-gray-400 hover:text-red-500" onClick={() => deleteBlock(b.id)} title="Удалить">
                      <IconTrash />
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Zoom controls */}
        <div className="sticky bottom-4 flex justify-end pr-4 pointer-events-none" style={{ marginTop: -40 }}>
          <div
            className="flex items-center gap-1 bg-white/95 rounded-lg shadow border border-gray-200 px-2 py-1 select-none pointer-events-all"
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
          >
            <button onClick={() => setZoomMul(z => Math.max(0.25, Math.round((z - 0.25) * 100) / 100))} className="w-6 h-6 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded text-lg leading-none">−</button>
            <span className="text-xs text-gray-600 w-10 text-center">{Math.round(scale * 100)}%</span>
            <button onClick={() => setZoomMul(z => Math.min(3, Math.round((z + 0.25) * 100) / 100))} className="w-6 h-6 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded text-lg leading-none">+</button>
            <button onClick={() => setZoomMul(1)} className="ml-1 px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100 rounded">Fit</button>
          </div>
        </div>
      </div>

      {/* Панель добавления */}
      <div className="flex items-center gap-2 px-4 py-2 bg-white border-t border-gray-200">
        <button onClick={() => addBlock('text')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
          <IconText />+ Текст
        </button>
        <button onClick={() => addBlock('image')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
          <IconImage />+ Изображение
        </button>

        <div ref={shapePickerRef} className="relative">
          <button
            onClick={e => { e.stopPropagation(); setShowShapePicker(v => !v); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg transition-colors ${showShapePicker ? 'border-blue-400 text-blue-600 bg-blue-50' : 'text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50'}`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <rect x="3" y="3" width="8" height="8" rx="1" />
              <circle cx="17" cy="7" r="4" />
              <polygon points="12,22 2,22 7,14" />
              <polygon points="14,14 24,14 24,24 14,24" />
            </svg>
            + Фигура ▾
          </button>

          {showShapePicker && (
            <div
              className="absolute bottom-full left-0 mb-1 bg-white rounded-xl shadow-xl border border-gray-200 p-2 grid grid-cols-3 gap-1 z-50"
              style={{ width: 210 }}
              onClick={e => e.stopPropagation()}
            >
              {SHAPE_OPTIONS.map(({ type, label }) => (
                <button
                  key={type}
                  onClick={() => { addBlock('shape', type); setShowShapePicker(false); }}
                  className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-gray-50 transition-colors text-gray-600 hover:text-blue-600"
                >
                  <div className="w-10 h-8">
                    <ShapeSvg w={40} h={32} block={{ type: 'shape', shape: type, fillColor: '#6366f1', strokeColor: 'transparent', strokeWidth: 3 }} />
                  </div>
                  <span className="text-[10px]">{label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Миниатюра слайда ─────────────────────────────────────────────────────────

interface SlideThumbProps {
  slide: Slide; index: number; isSelected: boolean; isDragOver: boolean;
  onClick: () => void; onDelete: () => void;
  onDragStart: (e: React.DragEvent) => void; onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void; onDrop: (e: React.DragEvent) => void;
}

function SlideThumb({ slide, index, isSelected, isDragOver, onClick, onDelete, onDragStart, onDragOver, onDragLeave, onDrop }: SlideThumbProps) {
  const blocks = slide.content?.blocks ?? [];
  const firstText = blocks.find(b => b.type === 'text');
  const label = firstText?.html
    ? firstText.html.replace(/<[^>]+>/g, '').slice(0, 30) || `Слайд ${index + 1}`
    : `Слайд ${index + 1}`;

  return (
    <div
      draggable
      onDragStart={onDragStart} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} onClick={onClick}
      className={`group flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors border-b border-gray-100 ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'} ${isDragOver ? 'border-t-2 border-t-blue-400' : ''}`}
    >
      <span className="cursor-grab flex-shrink-0 opacity-40 group-hover:opacity-70 transition-opacity"><IconDrag /></span>
      <span className="text-xs text-gray-400 w-5 text-center flex-shrink-0 font-medium">{index + 1}</span>
      <span className={`flex-1 text-xs truncate ${isSelected ? 'text-blue-700 font-medium' : 'text-gray-600'}`}>{label}</span>
      <button onClick={e => { e.stopPropagation(); onDelete(); }} className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all rounded"><IconTrash /></button>
    </div>
  );
}

// ─── Главный компонент ────────────────────────────────────────────────────────

export default function LessonEditorPage() {
  const { id } = useParams<{ id: string }>();
  const lessonId = Number(id);

  const [lesson,      setLesson]      = useState<Lesson | null>(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [slides,      setSlides]      = useState<Slide[]>([]);
  const [selectedId,  setSelectedId]  = useState<number | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [saveStatus,  setSaveStatus]  = useState<SaveStatus>('saved');

  const [dragIdx,     setDragIdx]     = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragCounter = useRef(0);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [lRes, sRes] = await Promise.all([
          api.get(`/lessons/lessons/${lessonId}/`),
          api.get(`/lessons/lessons/${lessonId}/slides/`),
        ]);
        setLesson(lRes.data);
        setLessonTitle(lRes.data.title);
        setSlides(sRes.data);
        if (sRes.data.length > 0) setSelectedId(sRes.data[0].id);
      } finally { setLoading(false); }
    };
    load();
  }, [lessonId]);

  const selectedSlide = slides.find(s => s.id === selectedId) ?? null;

  const saveLessonTitle = useCallback(async () => {
    if (!lesson || lessonTitle === lesson.title) return;
    setSaveStatus('saving');
    try {
      const res = await api.put(`/lessons/lessons/${lessonId}/`, { title: lessonTitle });
      setLesson(res.data); setSaveStatus('saved');
    } catch { setSaveStatus('unsaved'); }
  }, [lesson, lessonId, lessonTitle]);

  const addSlide = async () => {
    const res = await api.post(`/lessons/lessons/${lessonId}/slides/`, { slide_type: 'content' as SlideType, content: emptyContent() });
    const newSlide: Slide = res.data;
    setSlides(prev => [...prev, newSlide]);
    setSelectedId(newSlide.id);
  };

  const deleteSlide = async (slide: Slide) => {
    if (!confirm(`Удалить слайд ${slides.indexOf(slide) + 1}?`)) return;
    await api.delete(`/lessons/lessons/${lessonId}/slides/${slide.id}/`);
    setSlides(prev => {
      const next = prev.filter(s => s.id !== slide.id);
      if (selectedId === slide.id) setSelectedId(next[0]?.id ?? null);
      return next;
    });
  };

  const handleSlideUpdated = useCallback((updated: Slide) => {
    setSlides(prev => prev.map(s => s.id === updated.id ? updated : s));
    setSaveStatus('saved');
  }, []);

  const handleDragStart = (e: React.DragEvent, idx: number) => { e.dataTransfer.effectAllowed = 'move'; setDragIdx(idx); };
  const handleDragOver  = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOverIdx(idx); };
  const handleDragLeave = () => { dragCounter.current--; if (dragCounter.current <= 0) { setDragOverIdx(null); dragCounter.current = 0; } };
  const handleDrop = async (e: React.DragEvent, toIdx: number) => {
    e.preventDefault(); dragCounter.current = 0; setDragOverIdx(null);
    if (dragIdx === null || dragIdx === toIdx) { setDragIdx(null); return; }
    const reordered = [...slides];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setSlides(reordered); setDragIdx(null);
    await api.post(`/lessons/lessons/${lessonId}/slides/reorder/`, { order: reordered.map(s => s.id) });
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh] text-gray-400">Загрузка редактора...</div>;
  if (!lesson) return <div className="text-center py-16 text-gray-500">Урок не найден. <Link to="/lessons" className="text-blue-600 hover:underline">Вернуться</Link></div>;

  return (
    <div className="flex flex-col -mx-4 sm:-mx-6 lg:-mx-8" style={{ height: 'calc(100vh - 5.5rem)' }}>

      <header className="flex items-center gap-3 px-4 py-2.5 bg-white border-b border-gray-200 flex-shrink-0">
        <Link to="/lessons" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors flex-shrink-0">
          <IconArrowLeft /><span className="hidden sm:inline">Уроки</span>
        </Link>
        <div className="w-px h-5 bg-gray-200 flex-shrink-0" />
        <input
          type="text" value={lessonTitle}
          onChange={e => setLessonTitle(e.target.value)} onBlur={saveLessonTitle}
          className="flex-1 text-sm font-semibold text-gray-800 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none pb-0.5 min-w-0 transition-colors"
          placeholder="Название урока"
        />
        <div className="flex-shrink-0 flex items-center gap-1.5 text-xs">
          {saveStatus === 'saved'   && <span className="text-green-500 flex items-center gap-1"><IconCheck />Сохранено</span>}
          {saveStatus === 'saving'  && <span className="text-gray-400">Сохраняю...</span>}
          {saveStatus === 'unsaved' && <span className="text-amber-500">Не сохранено</span>}
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className="w-48 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Слайды</span>
            <button onClick={addSlide} title="Добавить слайд" className="p-1 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><IconPlus /></button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {slides.length === 0
              ? <div className="p-4 text-center text-xs text-gray-400">Нет слайдов</div>
              : slides.map((slide, idx) => (
                <SlideThumb
                  key={slide.id} slide={slide} index={idx}
                  isSelected={slide.id === selectedId}
                  isDragOver={dragOverIdx === idx && dragIdx !== idx}
                  onClick={() => setSelectedId(slide.id)}
                  onDelete={() => deleteSlide(slide)}
                  onDragStart={e => handleDragStart(e, idx)}
                  onDragOver={e => handleDragOver(e, idx)}
                  onDragLeave={handleDragLeave}
                  onDrop={e => handleDrop(e, idx)}
                />
              ))
            }
          </div>
          <div className="border-t border-gray-100 p-2">
            <button onClick={addSlide} className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
              <IconPlus />Добавить слайд
            </button>
          </div>
        </aside>

        <main className="flex-1 flex flex-col min-w-0 min-h-0">
          {selectedSlide
            ? <SlideCanvas key={selectedSlide.id} slide={selectedSlide} lessonId={lessonId} coverColor={lesson.cover_color} onSaved={handleSlideUpdated} />
            : (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400 bg-gray-50">
                <span className="text-5xl">📄</span>
                <p className="text-sm">Добавьте первый слайд</p>
                <button onClick={addSlide} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">Добавить слайд</button>
              </div>
            )
          }
        </main>
      </div>
    </div>
  );
}
