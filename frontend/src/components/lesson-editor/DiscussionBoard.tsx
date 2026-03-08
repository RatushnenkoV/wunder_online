import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import type { Slide, DiscussionSticker, DiscussionArrow } from '../../types';

const CANVAS_W = 960;
const CANVAS_H = 540;

const STICKER_W = 180;
const STICKER_H = 130;
const STICKER_COLORS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#fed7aa', '#e9d5ff'];

function stickerEdgePoint(s: DiscussionSticker, tx: number, ty: number): [number, number] {
  const cx = s.x + STICKER_W / 2;
  const cy = s.y + STICKER_H / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return [cx, cy];
  const hw = STICKER_W / 2;
  const hh = STICKER_H / 2;
  const tX = Math.abs(dx) > 0.01 ? hw / Math.abs(dx) : Infinity;
  const tY = Math.abs(dy) > 0.01 ? hh / Math.abs(dy) : Infinity;
  const t = Math.min(tX, tY);
  return [cx + dx * t, cy + dy * t];
}

const STICKER_DOT_R = 7;

interface StickerItemProps {
  sticker: DiscussionSticker;
  canEdit: boolean;
  canDelete: boolean;
  showDots: boolean;
  onMove: (x: number, y: number) => void;
  onDrag: (x: number, y: number) => void;
  onTextChange: (text: string) => void;
  onDelete: () => void;
  onHoverIn: () => void;
  onHoverOut: () => void;
  onDotMouseDown: (dot: 'n' | 's' | 'e' | 'w', e: React.MouseEvent) => void;
}

function StickerItem({ sticker, canEdit, canDelete, showDots, onMove, onDrag, onTextChange, onDelete, onHoverIn, onHoverOut, onDotMouseDown }: StickerItemProps) {
  const [localX, setLocalX] = useState(sticker.x);
  const [localY, setLocalY] = useState(sticker.y);
  const dragRef = useRef<{ startMX: number; startMY: number; startX: number; startY: number } | null>(null);

  useEffect(() => { setLocalX(sticker.x); setLocalY(sticker.y); }, [sticker.x, sticker.y]);

  const onMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation(); // Предотвращаем pan при клике на стикер
    if (!canEdit) return;
    e.preventDefault();
    dragRef.current = { startMX: e.clientX, startMY: e.clientY, startX: localX, startY: localY };
    const handleMove = (me: MouseEvent) => {
      if (!dragRef.current) return;
      const nx = dragRef.current.startX + me.clientX - dragRef.current.startMX;
      const ny = dragRef.current.startY + me.clientY - dragRef.current.startMY;
      setLocalX(nx);
      setLocalY(ny);
      onDrag(nx, ny);
    };
    const handleUp = (me: MouseEvent) => {
      if (!dragRef.current) return;
      onMove(dragRef.current.startX + me.clientX - dragRef.current.startMX, dragRef.current.startY + me.clientY - dragRef.current.startMY);
      dragRef.current = null;
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  };

  const dotStyle = (top: number, left: number): React.CSSProperties => ({
    position: 'absolute', top, left,
    width: STICKER_DOT_R * 2, height: STICKER_DOT_R * 2, borderRadius: '50%',
    background: '#3b82f6', border: '2px solid white',
    cursor: 'crosshair', zIndex: 30,
    boxShadow: '0 1px 4px rgba(0,0,0,0.22)',
  });

  return (
    <div
      onMouseEnter={onHoverIn}
      onMouseLeave={onHoverOut}
      style={{
        position: 'absolute', left: localX, top: localY,
        width: STICKER_W, height: STICKER_H,
        backgroundColor: sticker.color, borderRadius: 10,
        boxShadow: '0 2px 12px rgba(0,0,0,0.13)',
        display: 'flex', flexDirection: 'column',
        zIndex: 10, cursor: canEdit ? 'grab' : 'default',
        userSelect: 'none',
      }}
      onMouseDown={onMouseDown}
    >
      {/* Точки соединения */}
      {showDots && (
        <>
          <div onMouseDown={e => { e.stopPropagation(); onDotMouseDown('n', e); }} style={dotStyle(-STICKER_DOT_R, STICKER_W / 2 - STICKER_DOT_R)} />
          <div onMouseDown={e => { e.stopPropagation(); onDotMouseDown('s', e); }} style={dotStyle(STICKER_H - STICKER_DOT_R, STICKER_W / 2 - STICKER_DOT_R)} />
          <div onMouseDown={e => { e.stopPropagation(); onDotMouseDown('e', e); }} style={dotStyle(STICKER_H / 2 - STICKER_DOT_R, STICKER_W - STICKER_DOT_R)} />
          <div onMouseDown={e => { e.stopPropagation(); onDotMouseDown('w', e); }} style={dotStyle(STICKER_H / 2 - STICKER_DOT_R, -STICKER_DOT_R)} />
        </>
      )}
      <div style={{ height: 26, flexShrink: 0 }} className="flex items-center justify-end px-2 pt-1.5">
        {canDelete && (
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="text-gray-400 dark:text-slate-500 hover:text-red-500 w-5 h-5 flex items-center justify-center rounded hover:bg-black/10 text-base leading-none"
          >×</button>
        )}
      </div>
      <textarea
        value={sticker.text}
        onChange={e => { if (canEdit) onTextChange(e.target.value); }}
        onMouseDown={e => e.stopPropagation()}
        readOnly={!canEdit}
        placeholder={canEdit ? 'Введите текст...' : ''}
        className="flex-1 px-2.5 text-sm bg-transparent resize-none border-none outline-none text-gray-800 dark:text-slate-200 placeholder:text-gray-400"
        style={{ cursor: canEdit ? 'text' : 'default' }}
      />
      <div style={{ height: 26, flexShrink: 0 }} className="px-2.5 pb-1.5 text-[10px] text-gray-500 dark:text-slate-400 font-medium border-t border-black/10 pt-1 truncate">
        {sticker.author_name}
      </div>
    </div>
  );
}

export default function DiscussionBoard({ slide }: { slide: Slide }) {
  const { user: currentUser } = useAuth();

  const [stickers,       setStickers]       = useState<DiscussionSticker[]>([]);
  const [arrows,         setArrows]         = useState<DiscussionArrow[]>([]);
  const [topic,          setTopic]          = useState('');
  const [topicEdit,      setTopicEdit]      = useState(false);
  const [topicDraft,     setTopicDraft]     = useState('');
  const [hoveredArrow,   setHoveredArrow]   = useState<string | null>(null);
  const [isConnected,    setIsConnected]    = useState(false);
  const [hoverStickerId, setHoverStickerId] = useState<string | null>(null);
  const [dragPositions,  setDragPositions]  = useState<Record<string, { x: number; y: number }>>({});
  const [drawing,        setDrawing]        = useState<{
    fromId: string; fromDot: 'n' | 's' | 'e' | 'w'; curX: number; curY: number;
  } | null>(null);
  const [panOffset,    setPanOffset]    = useState({ x: 0, y: 0 });
  const [isPanning,    setIsPanning]    = useState(false);
  const [pendingColor, setPendingColor] = useState<string | null>(null);
  const [pendingText,  setPendingText]  = useState('');

  const wsRef        = useRef<WebSocket | null>(null);
  const boardRef     = useRef<HTMLDivElement>(null);
  const panRef       = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);
  const panOffsetRef = useRef(panOffset);
  const drawingRef   = useRef(drawing);
  const isTeacherOrAdmin = currentUser?.is_admin || currentUser?.is_teacher;

  useEffect(() => { panOffsetRef.current = panOffset; }, [panOffset]);
  useEffect(() => { drawingRef.current = drawing; }, [drawing]);

  useEffect(() => {
    const token = localStorage.getItem('access_token') ?? '';
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${window.location.host}/ws/discussion/${slide.id}/?token=${token}`);
    wsRef.current = ws;

    ws.onopen  = () => setIsConnected(true);
    ws.onclose = () => { setIsConnected(false); if (wsRef.current === ws) wsRef.current = null; };
    ws.onerror = () => setIsConnected(false);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case 'init':
            setStickers(data.stickers ?? []);
            setArrows(data.arrows ?? []);
            setTopic(data.topic ?? '');
            break;
          case 'sticker_added':
            setStickers(prev => [...prev, data.sticker]);
            break;
          case 'sticker_updated':
            setStickers(prev => prev.map(s => s.id === data.sticker.id ? data.sticker : s));
            break;
          case 'sticker_deleted':
            setStickers(prev => prev.filter(s => s.id !== data.id));
            setArrows(prev => prev.filter(a => a.from_id !== data.id && a.to_id !== data.id));
            break;
          case 'arrow_added':
            setArrows(prev => [...prev, data.arrow]);
            break;
          case 'arrow_deleted':
            setArrows(prev => prev.filter(a => a.id !== data.id));
            break;
          case 'topic_updated':
            setTopic(data.topic ?? '');
            break;
        }
      } catch { /* ignore */ }
    };

    return () => { ws.close(); };
  }, [slide.id]);

  const sendWs = (data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(data));
  };

  // ── Стикер: модаль ──────────────────────────────────────────────────────────
  const openStickerModal = (color: string) => {
    setPendingColor(color);
    setPendingText('');
  };
  const confirmSticker = () => {
    if (!pendingColor || !pendingText.trim()) return;
    const bw = boardRef.current?.clientWidth  ?? CANVAS_W;
    const bh = boardRef.current?.clientHeight ?? CANVAS_H;
    const x = Math.max(0, bw / 2 - STICKER_W / 2 - panOffset.x + (Math.random() - 0.5) * 200);
    const y = Math.max(0, bh / 2 - STICKER_H / 2 - panOffset.y + (Math.random() - 0.5) * 150);
    sendWs({ type: 'add_sticker', x, y, text: pendingText.trim(), color: pendingColor, created_at: new Date().toISOString() });
    setPendingColor(null);
    setPendingText('');
  };

  const moveStickerLocal = (id: string, x: number, y: number) => {
    sendWs({ type: 'update_sticker', id, x, y });
    setStickers(prev => prev.map(s => s.id === id ? { ...s, x, y } : s));
  };

  const updateStickerText = (id: string, text: string) => {
    sendWs({ type: 'update_sticker', id, text });
    setStickers(prev => prev.map(s => s.id === id ? { ...s, text } : s));
  };

  const deleteSticker = (id: string) => sendWs({ type: 'delete_sticker', id });
  const deleteArrow   = (id: string) => sendWs({ type: 'delete_arrow', id });

  // ── Pan ────────────────────────────────────────────────────────────────────
  const startPan = (e: React.MouseEvent) => {
    if (drawing) return;
    e.preventDefault();
    panRef.current = { startX: e.clientX, startY: e.clientY, ox: panOffset.x, oy: panOffset.y };
    setIsPanning(true);
    const onMove = (me: MouseEvent) => {
      if (!panRef.current) return;
      setPanOffset({ x: panRef.current.ox + me.clientX - panRef.current.startX, y: panRef.current.oy + me.clientY - panRef.current.startY });
    };
    const onUp = () => {
      panRef.current = null;
      setIsPanning(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // ── Рисование стрелки по hover-точкам ─────────────────────────────────────
  const startDraw = (fromId: string, fromDot: 'n' | 's' | 'e' | 'w', clientX: number, clientY: number) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const { x: ox, y: oy } = panOffsetRef.current;
    setDrawing({ fromId, fromDot, curX: clientX - rect.left - ox, curY: clientY - rect.top - oy });
  };

  useEffect(() => {
    if (!drawing) return;
    const onMove = (e: MouseEvent) => {
      const rect = boardRef.current?.getBoundingClientRect();
      if (!rect) return;
      const { x: ox, y: oy } = panOffsetRef.current;
      setDrawing(prev => prev ? { ...prev, curX: e.clientX - rect.left - ox, curY: e.clientY - rect.top - oy } : null);
    };
    const onUp = (e: MouseEvent) => {
      const rect = boardRef.current?.getBoundingClientRect();
      const cur = drawingRef.current;
      if (rect && cur) {
        const { x: ox, y: oy } = panOffsetRef.current;
        const bx = e.clientX - rect.left - ox;
        const by = e.clientY - rect.top - oy;
        const target = stickers.find(s =>
          s.id !== cur.fromId &&
          bx >= s.x && bx <= s.x + STICKER_W && by >= s.y && by <= s.y + STICKER_H,
        );
        if (target) sendWs({ type: 'add_arrow', from_id: cur.fromId, to_id: target.id });
      }
      setDrawing(null);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, [drawing, stickers]); // eslint-disable-line

  const getDotPos = (s: DiscussionSticker, dot: 'n' | 's' | 'e' | 'w'): [number, number] => {
    switch (dot) {
      case 'n': return [s.x + STICKER_W / 2, s.y];
      case 's': return [s.x + STICKER_W / 2, s.y + STICKER_H];
      case 'e': return [s.x + STICKER_W, s.y + STICKER_H / 2];
      case 'w': return [s.x, s.y + STICKER_H / 2];
    }
  };

  const saveTopic = () => {
    sendWs({ type: 'update_topic', topic: topicDraft });
    setTopic(topicDraft);
    setTopicEdit(false);
  };

  const canEditItem   = (authorId: number) => !!(currentUser && (isTeacherOrAdmin || authorId === currentUser.id));
  const canDeleteItem = (authorId: number) => !!(currentUser && (isTeacherOrAdmin || authorId === currentUser.id));

  return (
    <div className="flex flex-col h-full">

      {/* Строка темы */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 flex items-center gap-2 min-h-[44px]">
        {topicEdit && isTeacherOrAdmin ? (
          <>
            <input
              autoFocus
              value={topicDraft}
              onChange={e => setTopicDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveTopic(); if (e.key === 'Escape') setTopicEdit(false); }}
              className="flex-1 text-base font-semibold text-gray-800 dark:text-slate-200 bg-white dark:bg-slate-800 border border-purple-300 rounded px-2 py-0.5 outline-none focus:ring-2 focus:ring-purple-200"
              placeholder="Тема обсуждения..."
              maxLength={200}
            />
            <button onClick={saveTopic} className="text-xs px-2.5 py-1 bg-purple-500 text-white rounded hover:bg-purple-600">Сохранить</button>
            <button onClick={() => setTopicEdit(false)} className="text-xs px-2.5 py-1 text-gray-500 dark:text-slate-400 hover:text-gray-700">Отмена</button>
          </>
        ) : (
          <>
            <span className="flex-1 text-base font-semibold text-gray-700 dark:text-slate-300 truncate">
              {topic || <span className="text-gray-400 dark:text-slate-500 font-normal italic text-sm">Тема не задана</span>}
            </span>
            {isTeacherOrAdmin && (
              <button
                onClick={() => { setTopicDraft(topic); setTopicEdit(true); }}
                className="text-xs text-gray-400 dark:text-slate-500 hover:text-purple-500 px-1.5 py-1 rounded hover:bg-purple-50 transition-colors flex-shrink-0"
              >Изменить</button>
            )}
          </>
        )}
      </div>

      {/* Панель инструментов */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex-wrap min-h-[44px]">
        <span className="text-xs text-gray-400 dark:text-slate-500">Стикер:</span>
        {STICKER_COLORS.map(c => (
          <button
            key={c}
            onClick={() => { if (isConnected) openStickerModal(c); }}
            disabled={!isConnected}
            title="Добавить стикер"
            className="flex-shrink-0 rounded transition-transform hover:scale-110 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ width: 18, height: 18, background: c, border: '2px solid rgba(0,0,0,0.12)', borderRadius: 4, padding: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.15)', cursor: isConnected ? 'pointer' : 'not-allowed' }}
          />
        ))}
        <span className="text-xs text-gray-400 dark:text-slate-500 ml-2">Наведите на стикер чтобы соединить</span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
          <span className={`text-xs ${isConnected ? 'text-green-600' : 'text-red-500'}`}>
            {isConnected ? 'Подключено' : 'Нет связи'}
          </span>
        </div>
      </div>

      {/* Доска */}
      <div className="flex-1 overflow-hidden bg-white dark:bg-slate-900">
        <div
          ref={boardRef}
          onMouseDown={startPan}
          style={{
            width: '100%', height: '100%', position: 'relative',
            background: 'white', overflow: 'hidden',
            cursor: drawing ? 'crosshair' : isPanning ? 'grabbing' : 'grab',
          }}
        >
          {/* Трансформированный контейнер для стрелок и стикеров */}
          <div style={{ position: 'absolute', inset: 0, transform: `translate(${panOffset.x}px, ${panOffset.y}px)` }}>
            {/* SVG-слой стрелок + рисуемая линия */}
            <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 5, overflow: 'visible' }}>
              <defs>
                <marker id="db-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#9ca3af" />
                </marker>
                <marker id="db-arrow-del" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
                </marker>
                <marker id="db-arrow-tmp" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#3b82f6" />
                </marker>
              </defs>

              {arrows.map(arrow => {
                const from = stickers.find(s => s.id === arrow.from_id);
                const to   = stickers.find(s => s.id === arrow.to_id);
                if (!from || !to) return null;
                const fp = dragPositions[from.id] ?? { x: from.x, y: from.y };
                const tp = dragPositions[to.id]   ?? { x: to.x,   y: to.y };
                const fromS = { ...from, ...fp };
                const toS   = { ...to,   ...tp };
                const [x1, y1] = stickerEdgePoint(fromS, tp.x + STICKER_W / 2, tp.y + STICKER_H / 2);
                const [x2, y2] = stickerEdgePoint(toS,   fp.x + STICKER_W / 2, fp.y + STICKER_H / 2);
                const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
                const isHovered = hoveredArrow === arrow.id;
                const canDel = canDeleteItem(arrow.author_id);
                return (
                  <g key={arrow.id}>
                    <line x1={x1} y1={y1} x2={x2} y2={y2}
                      stroke={isHovered ? '#ef4444' : '#9ca3af'} strokeWidth={isHovered ? 2.5 : 2}
                      markerEnd={isHovered ? 'url(#db-arrow-del)' : 'url(#db-arrow)'}
                      style={{ pointerEvents: 'none' }} />
                    <line x1={x1} y1={y1} x2={x2} y2={y2}
                      stroke="transparent" strokeWidth={18}
                      style={{ pointerEvents: 'stroke', cursor: canDel ? 'pointer' : 'default' }}
                      onMouseEnter={() => setHoveredArrow(arrow.id)}
                      onMouseLeave={() => setHoveredArrow(null)}
                      onClick={canDel ? () => deleteArrow(arrow.id) : undefined}
                    />
                    {isHovered && canDel && (
                      <g transform={`translate(${mx},${my})`} style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                        onMouseEnter={() => setHoveredArrow(arrow.id)}
                        onMouseLeave={() => setHoveredArrow(null)}
                        onClick={() => deleteArrow(arrow.id)}>
                        <circle r={10} fill="white" stroke="#fca5a5" strokeWidth={1.5} />
                        <text textAnchor="middle" dominantBaseline="middle" fontSize={14} fill="#ef4444" fontWeight="bold">×</text>
                      </g>
                    )}
                  </g>
                );
              })}
              {/* Рисуемая стрелка */}
              {drawing && (() => {
                const fromS = stickers.find(s => s.id === drawing.fromId);
                if (!fromS) return null;
                const [sx, sy] = getDotPos(fromS, drawing.fromDot);
                return (
                  <line x1={sx} y1={sy} x2={drawing.curX} y2={drawing.curY}
                    stroke="#3b82f6" strokeWidth={2} strokeDasharray="6,3"
                    markerEnd="url(#db-arrow-tmp)" style={{ pointerEvents: 'none' }} />
                );
              })()}
            </svg>

            {/* Стикеры */}
            {stickers.map(s => (
              <StickerItem
                key={s.id} sticker={s}
                canEdit={canEditItem(s.author_id)}
                canDelete={canDeleteItem(s.author_id)}
                showDots={hoverStickerId === s.id || drawing?.fromId === s.id}
                onDrag={(x, y) => setDragPositions(prev => ({ ...prev, [s.id]: { x, y } }))}
                onMove={(x, y) => {
                  moveStickerLocal(s.id, x, y);
                  setDragPositions(prev => { const n = { ...prev }; delete n[s.id]; return n; });
                }}
                onTextChange={text => updateStickerText(s.id, text)}
                onDelete={() => deleteSticker(s.id)}
                onHoverIn={() => { if (!drawing) setHoverStickerId(s.id); }}
                onHoverOut={() => { if (!drawing) setHoverStickerId(prev => prev === s.id ? null : prev); }}
                onDotMouseDown={(dot, e) => { e.preventDefault(); startDraw(s.id, dot, e.clientX, e.clientY); }}
              />
            ))}
          </div>

          {stickers.length === 0 && !drawing && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400 dark:text-slate-500 text-sm pointer-events-none" style={{ zIndex: 20 }}>
              Нажмите на квадратик цвета чтобы добавить стикер
            </div>
          )}

          {/* Модаль создания стикера */}
          {pendingColor && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)' }}
              onMouseDown={e => e.stopPropagation()}>
              <div style={{ background: 'white', borderRadius: 12, padding: '20px 24px', minWidth: 260, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="text-base font-semibold text-gray-900 dark:text-slate-100">Текст стикера</div>
                <div className="flex items-start gap-2">
                  <div style={{ width: 24, height: 24, borderRadius: 4, background: pendingColor, border: '1px solid rgba(0,0,0,0.12)', flexShrink: 0, marginTop: 4 }} />
                  <textarea
                    autoFocus
                    value={pendingText}
                    onChange={e => setPendingText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); confirmSticker(); }
                      if (e.key === 'Escape') { setPendingColor(null); setPendingText(''); }
                    }}
                    placeholder="Введите текст стикера..."
                    rows={3}
                    className="flex-1 resize-none rounded border border-gray-300 dark:border-slate-600 px-2 py-1.5 text-sm text-gray-700 dark:text-slate-300 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-200"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => { setPendingColor(null); setPendingText(''); }}
                    className="px-3.5 py-1.5 text-sm rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800"
                  >Отмена</button>
                  <button
                    onClick={confirmSticker}
                    disabled={!pendingText.trim()}
                    className="px-3.5 py-1.5 text-sm rounded font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: '#3b82f6' }}
                  >Создать</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
