import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { Rnd } from 'react-rnd';
import { useEditor } from '@tiptap/react';
import api from '../../api/client';
import TiptapToolbar from './TiptapToolbar';
import ShapeToolbar from './ShapeToolbar';
import ShapeSvg from './ShapeSvg';
import BgColorButton from './BgColorButton';
import TextBlock from './TextBlock';
import ImageBlock from './ImageBlock';
import type { Slide, SlideBlock, ShapeType } from '../../types';

const CANVAS_W = 960;
const CANVAS_H = 540;
const MIN_W    = 20;
const MIN_H    = 20;
const WORKSPACE_PAD = 600; // рабочая область вокруг слайда

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
export function emptyContent() {
  return { blocks: [defaultTextBlock()] };
}

const SHAPE_OPTIONS: { type: ShapeType; label: string }[] = [
  { type: 'rect',     label: 'Прямоугольник' },
  { type: 'circle',   label: 'Эллипс'        },
  { type: 'triangle', label: 'Треугольник'   },
  { type: 'diamond',  label: 'Ромб'          },
  { type: 'star',     label: 'Звезда'        },
  { type: 'line',     label: 'Линия'         },
];

function IconTrash() {
  return <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
}
function IconImage() {
  return <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
}
function IconText() {
  return <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h10M4 18h10" /></svg>;
}

export default function SlideCanvas({ slide, lessonId, coverColor, onSaved }: { slide: Slide; lessonId: number; coverColor: string; onSaved: (s: Slide) => void }) {
  const content = slide.content?.blocks ? slide.content : emptyContent();
  const [blocks,       setBlocks]       = useState<SlideBlock[]>(content.blocks);
  const [selectedIds,  setSelectedIds]  = useState<string[]>([]);
  const [editingId,    setEditingId]     = useState<string | null>(null);
  const [activeEditor, setActiveEditor] = useState<ReturnType<typeof useEditor> | null>(null);
  const [baseScale,    setBaseScale]    = useState(1);
  const [zoomMul,      setZoomMul]      = useState(1);
  const [showShapePicker, setShowShapePicker] = useState(false);
  const [background,   setBackground]   = useState<string>((slide.content as Record<string, unknown>)?.background as string ?? '#ffffff');
  const bgRef = useRef<string>((slide.content as Record<string, unknown>)?.background as string ?? '#ffffff');
  const blocksRef = useRef<SlideBlock[]>(content.blocks);
  bgRef.current = background;
  blocksRef.current = blocks;

  const containerRef          = useRef<HTMLDivElement>(null);
  const innerCanvasRef        = useRef<HTMLDivElement>(null);
  const outerCanvasRef        = useRef<HTMLDivElement>(null);
  const isDraggingRef         = useRef(false);
  const saveTimer             = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shapePickerRef        = useRef<HTMLDivElement>(null);
  const copiedBlockRef        = useRef<SlideBlock[] | null>(null);
  const dragStartBlocksRef    = useRef<{ [id: string]: { x: number; y: number } }>({});
  const zoomPivotRef          = useRef<{ sl: number; st: number; px: number; py: number; prevScale: number } | null>(null);
  const scaleRef              = useRef(1);
  const initialScrollDone     = useRef(false);
  const touchStateRef         = useRef<{ dist: number } | null>(null);

  const scale = baseScale * zoomMul;

  // Синхронизируем scaleRef с актуальным scale
  scaleRef.current = scale;

  // Сброс при смене слайда
  useEffect(() => {
    const c = slide.content?.blocks ? slide.content : emptyContent();
    setBlocks(c.blocks);
    blocksRef.current = c.blocks;
    const bg = (slide.content as Record<string, unknown>)?.background as string ?? '#ffffff';
    setBackground(bg);
    bgRef.current = bg;
    setSelectedIds([]);
    setEditingId(null);
    setActiveEditor(null);
  }, [slide.id]);

  // Центрирование: запускаем каждый раз когда baseScale меняется,
  // но только один раз на жизнь компонента (initialScrollDone.current).
  // baseScale устанавливается ResizeObserver-ом — к моменту когда таймаут
  // сработает, scrollWidth уже посчитан на правильном масштабе.
  useEffect(() => {
    if (initialScrollDone.current) return;
    const el = containerRef.current;
    if (!el) return;
    const tid = setTimeout(() => {
      if (!el.clientWidth) return; // макет ещё не готов
      el.scrollLeft = Math.max(0, (el.scrollWidth  - el.clientWidth)  / 2);
      el.scrollTop  = Math.max(0, (el.scrollHeight - el.clientHeight) / 2);
      initialScrollDone.current = true;
    }, 100);
    return () => clearTimeout(tid);
  }, [baseScale]); // перезапускаем когда baseScale меняется, пока не сцентрировали

  // Корректируем позицию прокрутки при зуме, чтобы точка под курсором не смещалась.
  // useLayoutEffect — выполняется до отрисовки браузером, поэтому курсор не «прыгает».
  useLayoutEffect(() => {
    const el  = containerRef.current;
    const piv = zoomPivotRef.current;
    if (!el || !piv) return;
    zoomPivotRef.current = null;
    const ratio = scale / piv.prevScale;
    el.scrollLeft = Math.max(0, (piv.sl + piv.px) * ratio - piv.px);
    el.scrollTop  = Math.max(0, (piv.st + piv.py) * ratio - piv.py);
  }, [scale]);

  // Zoom через Ctrl+Колёсико и пинч на тачпаде (trackpad pinch = wheel с ctrlKey)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomPivotRef.current = {
        sl: el.scrollLeft, st: el.scrollTop,
        px: e.clientX - rect.left, py: e.clientY - rect.top,
        prevScale: scaleRef.current,
      };
      // deltaY: отрицательное = приближение (pinch-out / Ctrl+↑)
      const step = e.deltaY < 0 ? 0.02 : -0.02;
      setZoomMul(z => Math.min(3, Math.max(0.25, Math.round((z + step) * 100) / 100)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Zoom через пинч двумя пальцами на сенсорном экране
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchStateRef.current = { dist: Math.hypot(dx, dy) };
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !touchStateRef.current) return;
      e.preventDefault();
      const dx   = e.touches[0].clientX - e.touches[1].clientX;
      const dy   = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / touchStateRef.current.dist;
      touchStateRef.current.dist = dist;
      const mx   = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const my   = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const rect = el.getBoundingClientRect();
      zoomPivotRef.current = {
        sl: el.scrollLeft, st: el.scrollTop,
        px: mx - rect.left, py: my - rect.top,
        prevScale: scaleRef.current,
      };
      setZoomMul(z => Math.min(3, Math.max(0.25, z * ratio)));
    };
    const onTouchEnd = () => { touchStateRef.current = null; };
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove',  onTouchMove,  { passive: false });
    el.addEventListener('touchend',   onTouchEnd,   { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove',  onTouchMove);
      el.removeEventListener('touchend',   onTouchEnd);
    };
  }, []);

  // Отслеживаем ширину контейнера → baseScale
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

  // Закрытие shape picker по клику вне
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

  const buildContent = (nextBlocks: SlideBlock[], bg: string) => {
    const c: Record<string, unknown> = { blocks: nextBlocks };
    if (bg && bg !== '#ffffff') c.background = bg;
    return c;
  };

  const saveBlocks = useCallback((next: SlideBlock[]) => {
    blocksRef.current = next;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await api.put(`/lessons/lessons/${lessonId}/slides/${slide.id}/`, {
          content: buildContent(next, bgRef.current),
        });
        onSaved(res.data);
      } catch { /* ignore */ }
    }, 400);
  }, [lessonId, slide.id, onSaved]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveBg = useCallback((newBg: string) => {
    setBackground(newBg);
    bgRef.current = newBg;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await api.put(`/lessons/lessons/${lessonId}/slides/${slide.id}/`, {
          content: buildContent(blocksRef.current, newBg),
        });
        onSaved(res.data);
      } catch { /* ignore */ }
    }, 400);
  }, [lessonId, slide.id, onSaved]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateBlock = useCallback((id: string, patch: Partial<SlideBlock>) => {
    setBlocks(prev => {
      const next = prev.map(b => b.id === id ? { ...b, ...patch } : b);
      saveBlocks(next);
      return next;
    });
  }, [saveBlocks]);

  // ── Клавиатурные сокращения ──────────────────────────────────────────────────
  // Используем фазу захвата (capture), чтобы наш обработчик срабатывал раньше
  // Tiptap/ProseMirror и другие элементы не могли заблокировать событие.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Игнорируем события из полей ввода (заголовок урока и т.п.)
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
      // Игнорируем, когда пользователь редактирует текстовый блок
      if (editingId) return;

      // Удаление выделенных блоков по Delete
      if (e.key === 'Delete') {
        if (selectedIds.length === 0) return;
        setBlocks(prev => { const next = prev.filter(b => !selectedIds.includes(b.id)); saveBlocks(next); return next; });
        setSelectedIds([]);
        setEditingId(null);
        e.preventDefault();
        return;
      }

      if (!(e.ctrlKey || e.metaKey)) return;

      if (e.code === 'KeyC') {
        // Копируем все выделенные блоки
        const selected = blocks.filter(b => selectedIds.includes(b.id));
        if (selected.length === 0) return;
        copiedBlockRef.current = selected.map(b => ({ ...b }));
        e.preventDefault();
      } else if (e.code === 'KeyV' && copiedBlockRef.current) {
        const sources = copiedBlockRef.current;
        const maxZ = blocks.length > 0 ? Math.max(...blocks.map(b => b.zIndex)) : 0;
        const newBlocks: SlideBlock[] = sources.map((src, i) => ({
          ...src,
          id: newBlockId(),
          x: src.x + 20,
          y: src.y + 20,
          zIndex: maxZ + i + 1,
        }));
        setBlocks(prev => { const next = [...prev, ...newBlocks]; saveBlocks(next); return next; });
        setSelectedIds(newBlocks.map(b => b.id));
        e.preventDefault();
      }
    };
    // capture: true — срабатываем до того, как элемент на странице обработает событие
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [blocks, editingId, selectedIds, saveBlocks]);

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
    setSelectedIds([block.id]);
  };

  const deleteBlock = (id: string) => {
    setBlocks(prev => { const next = prev.filter(b => b.id !== id); saveBlocks(next); return next; });
    setSelectedIds(prev => prev.filter(sid => sid !== id));
    if (editingId === id) setEditingId(null);
  };

  const handleCanvasClick = () => {
    if (isDraggingRef.current) return;
    if (activeEditor && editingId) updateBlock(editingId, { html: activeEditor.getHTML() });
    setSelectedIds([]);
    setEditingId(null);
    setActiveEditor(null);
    setShowShapePicker(false);
  };

  // selectedBlock — только при одиночном выделении (для плавающей панели)
  const selectedBlock = selectedIds.length === 1 ? (blocks.find(b => b.id === selectedIds[0]) ?? null) : null;

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

    const cx = block.x + block.w / 2;
    const cy = block.y + block.h / 2;

    const fixedLocalMap: { [k: string]: { lx: number; ly: number } } = {
      br: { lx: -startW / 2, ly: -startH / 2 },
      bl: { lx:  startW / 2, ly: -startH / 2 },
      tr: { lx: -startW / 2, ly:  startH / 2 },
      tl: { lx:  startW / 2, ly:  startH / 2 },
    };
    const fl = fixedLocalMap[corner];
    const fixedWorld = {
      x: cx + fl.lx * cosA - fl.ly * sinA,
      y: cy + fl.lx * sinA + fl.ly * cosA,
    };

    const onMove = (me: MouseEvent) => {
      const dx = (me.clientX - startClient.x) / scale;
      const dy = (me.clientY - startClient.y) / scale;

      const localDx =  dx * cosA + dy * sinA;
      const localDy = -dx * sinA + dy * cosA;

      let newW: number, newH: number;
      if      (corner === 'br') { newW = Math.max(MIN_W, startW + localDx); newH = Math.max(MIN_H, startH + localDy); }
      else if (corner === 'bl') { newW = Math.max(MIN_W, startW - localDx); newH = Math.max(MIN_H, startH + localDy); }
      else if (corner === 'tr') { newW = Math.max(MIN_W, startW + localDx); newH = Math.max(MIN_H, startH - localDy); }
      else                       { newW = Math.max(MIN_W, startW - localDx); newH = Math.max(MIN_H, startH - localDy); }

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
  let toolbarInner: React.ReactNode;
  if (editingId && activeEditor)              toolbarInner = <TiptapToolbar editor={activeEditor} />;
  else if (selectedBlock?.type === 'shape')   toolbarInner = <ShapeToolbar block={selectedBlock} onChange={p => updateBlock(selectedBlock.id, p)} />;
  else                                        toolbarInner = <div className="flex-1 h-10" />;

  const toolbar = (
    <div className="flex items-stretch border-b border-gray-200 bg-white">
      <div className="flex-1 min-w-0">{toolbarInner}</div>
      <div className="flex items-center pr-3 flex-shrink-0">
        <BgColorButton bg={background} onChange={saveBg} />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {toolbar}

      <div
        ref={containerRef}
        className="flex-1 bg-gray-100 overflow-auto"
        style={{ position: 'relative' }}
        onClick={handleCanvasClick}
      >
        <div className="flex items-center justify-center" style={{ padding: WORKSPACE_PAD * scale, minHeight: '100%', boxSizing: 'border-box' }}>
          {/* Внешняя обёртка — scaled-размер холста, якорь для плавающей панели */}
          <div ref={outerCanvasRef} style={{ width: CANVAS_W * scale, height: CANVAS_H * scale, position: 'relative', flexShrink: 0 }}>

            {/* Внутренний холст 960×540 */}
            <div
              ref={innerCanvasRef}
              style={{
                width: CANVAS_W, height: CANVAS_H,
                transform: `scale(${scale})`, transformOrigin: 'top left',
                position: 'absolute', top: 0, left: 0,
                backgroundColor: background,
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
                  scale={scale}
                  disableDragging={editingId === block.id}
                  enableResizing={false}
                  style={{ zIndex: block.zIndex }}
                  onMouseDown={e => {
                    e.stopPropagation();
                    if (e.shiftKey) {
                      // Shift+клик: добавляем/убираем из выделения
                      setSelectedIds(prev =>
                        prev.includes(block.id)
                          ? prev.filter(id => id !== block.id)
                          : [...prev, block.id]
                      );
                    } else if (!selectedIds.includes(block.id)) {
                      // Клик по НЕ выделенному блоку: сделать его единственным выделенным
                      if (editingId && editingId !== block.id) {
                        if (activeEditor) updateBlock(editingId, { html: activeEditor.getHTML() });
                        setEditingId(null);
                        setActiveEditor(null);
                      }
                      setSelectedIds([block.id]);
                    }
                    // Если блок уже в выделении — ничего не меняем (чтобы не сбросить мультивыделение при начале перетаскивания)
                  }}
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  onDragStart={(_, d) => {
                    isDraggingRef.current = true;
                    // Сохраняем стартовые позиции всех блоков
                    dragStartBlocksRef.current = Object.fromEntries(
                      blocks.map(b => [b.id, { x: b.x, y: b.y }])
                    );
                    // react-rnd передаёт стартовую позицию в d
                    dragStartBlocksRef.current[block.id] = { x: d.x, y: d.y };
                  }}
                  onDrag={(_, d) => {
                    // В реальном времени двигаем все ОСТАЛЬНЫЕ выделенные блоки.
                    // scale передан в <Rnd>, поэтому react-rnd сам компенсирует
                    // CSS-трансформ родителя — d.x/d.y уже в логических координатах.
                    if (!selectedIds.includes(block.id) || selectedIds.length < 2) return;
                    const orig = dragStartBlocksRef.current[block.id];
                    if (!orig) return;
                    const dx = d.x - orig.x;
                    const dy = d.y - orig.y;
                    setBlocks(prev => prev.map(b => {
                      if (b.id === block.id) return b; // этот блок ведёт react-rnd
                      const bs = dragStartBlocksRef.current[b.id];
                      if (bs && selectedIds.includes(b.id)) {
                        return { ...b, x: bs.x + dx, y: bs.y + dy };
                      }
                      return b;
                    }));
                  }}
                  onDragStop={(_, d) => {
                    setTimeout(() => { isDraggingRef.current = false; }, 100);
                    if (selectedIds.includes(block.id) && selectedIds.length > 1) {
                      // Фиксируем финальные позиции всех выделенных блоков
                      const orig = dragStartBlocksRef.current[block.id];
                      const dx = orig ? d.x - orig.x : 0;
                      const dy = orig ? d.y - orig.y : 0;
                      setBlocks(prev => {
                        const next = prev.map(b => {
                          const bs = dragStartBlocksRef.current[b.id];
                          if (bs && selectedIds.includes(b.id)) {
                            return { ...b, x: bs.x + dx, y: bs.y + dy };
                          }
                          return b;
                        });
                        saveBlocks(next);
                        return next;
                      });
                    } else {
                      updateBlock(block.id, { x: d.x, y: d.y });
                    }
                  }}
                >
                  {/* Вращение на внутреннем div */}
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
                        outline: selectedIds.includes(block.id) ? `2px solid ${coverColor}` : 'none',
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
                          onActivate={() => { setSelectedIds([block.id]); setEditingId(block.id); }}
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

                    {/* Угловые ручки resize — только при одиночном выделении */}
                    {selectedIds.length === 1 && selectedIds[0] === block.id && editingId !== block.id && (
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

            {/* Плавающая панель — одиночное выделение */}
            {selectedBlock && editingId !== selectedBlock.id && (() => {
              const b = selectedBlock;
              const cx = (b.x + b.w / 2) * scale;
              const ty = Math.max(-WORKSPACE_PAD * scale + 4, b.y * scale - 38);
              return (
                <div
                  style={{ position: 'absolute', left: cx, top: ty, transform: 'translateX(-50%)', zIndex: 9999, pointerEvents: 'auto', userSelect: 'none' }}
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
                    {/* Дублировать — создаёт копию чуть ниже и правее */}
                    <button
                      className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-sm text-gray-500 hover:text-gray-800"
                      onClick={() => {
                        const newBlock: SlideBlock = {
                          ...b,
                          id: newBlockId(),
                          x: b.x + 20,
                          y: b.y + 20,
                          zIndex: (blocks.length > 0 ? Math.max(...blocks.map(bl => bl.zIndex)) : 0) + 1,
                        };
                        setBlocks(prev => { const next = [...prev, newBlock]; saveBlocks(next); return next; });
                        setSelectedIds([newBlock.id]);
                      }}
                      title="Дублировать"
                    >⧉</button>
                    <div className="w-px h-5 bg-gray-200 mx-0.5" />
                    <button className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 text-gray-400 hover:text-red-500" onClick={() => deleteBlock(b.id)} title="Удалить (Delete)">
                      <IconTrash />
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Плавающая панель — множественное выделение */}
            {selectedIds.length > 1 && (() => {
              const selBlocks = blocks.filter(b => selectedIds.includes(b.id));
              if (selBlocks.length === 0) return null;
              const avgCx = selBlocks.reduce((s, b) => s + (b.x + b.w / 2), 0) / selBlocks.length * scale;
              const minY  = Math.min(...selBlocks.map(b => b.y)) * scale;
              const ty    = Math.max(-WORKSPACE_PAD * scale + 4, minY - 38);
              return (
                <div
                  style={{ position: 'absolute', left: avgCx, top: ty, transform: 'translateX(-50%)', zIndex: 9999, pointerEvents: 'auto', userSelect: 'none' }}
                  onClick={e => e.stopPropagation()}
                  onMouseDown={e => e.stopPropagation()}
                >
                  <div className="flex items-center gap-0.5 bg-white rounded-lg shadow-lg border border-gray-200 px-1.5 py-1 text-xs whitespace-nowrap">
                    <span className="text-gray-400 px-1 text-[11px]">{selectedIds.length} эл.</span>
                    <div className="w-px h-5 bg-gray-200 mx-0.5" />
                    <button
                      className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                      onClick={() => {
                        setBlocks(prev => { const next = prev.filter(b => !selectedIds.includes(b.id)); saveBlocks(next); return next; });
                        setSelectedIds([]);
                        setEditingId(null);
                      }}
                      title="Удалить выделенные (Delete)"
                    >
                      <IconTrash />
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Zoom controls */}
        <div className="sticky bottom-4 flex justify-end pr-4" style={{ marginTop: -40, pointerEvents: 'none' }}>
          <div
            className="flex items-center gap-1 bg-white/95 rounded-lg shadow border border-gray-200 px-2 py-1 select-none"
            style={{ pointerEvents: 'auto' }}
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
          >
            <button
              onClick={() => {
                const el = containerRef.current;
                if (el) zoomPivotRef.current = { sl: el.scrollLeft, st: el.scrollTop, px: el.clientWidth / 2, py: el.clientHeight / 2, prevScale: scaleRef.current };
                setZoomMul(z => Math.max(0.25, Math.round((z - 0.25) * 100) / 100));
              }}
              className="w-6 h-6 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded text-lg leading-none"
            >−</button>
            <span className="text-xs text-gray-600 w-10 text-center">{Math.round(scale * 100)}%</span>
            <button
              onClick={() => {
                const el = containerRef.current;
                if (el) zoomPivotRef.current = { sl: el.scrollLeft, st: el.scrollTop, px: el.clientWidth / 2, py: el.clientHeight / 2, prevScale: scaleRef.current };
                setZoomMul(z => Math.min(3, Math.round((z + 0.25) * 100) / 100));
              }}
              className="w-6 h-6 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded text-lg leading-none"
            >+</button>
            <button
              onClick={() => {
                const el = containerRef.current;
                if (el) zoomPivotRef.current = { sl: el.scrollLeft, st: el.scrollTop, px: el.clientWidth / 2, py: el.clientHeight / 2, prevScale: scaleRef.current };
                setZoomMul(1);
              }}
              className="ml-1 px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100 rounded"
            >Fit</button>
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
