import { useState, useEffect, useRef } from 'react';
import type { Slide, DiscussionSticker, DiscussionArrow, User } from '../../types';

const CANVAS_W = 960;
const CANVAS_H = 540;
const STICKER_W = 180;
const STICKER_H = 130;
const STICKER_COLORS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#fed7aa', '#e9d5ff'];

function stickerEdgePoint(s: DiscussionSticker, tx: number, ty: number): [number, number] {
  const cx = s.x + STICKER_W / 2, cy = s.y + STICKER_H / 2;
  const dx = tx - cx, dy = ty - cy;
  if (dx === 0 && dy === 0) return [cx, cy];
  const hw = STICKER_W / 2, hh = STICKER_H / 2;
  const sx = dx === 0 ? Infinity : Math.abs(hw / dx);
  const sy = dy === 0 ? Infinity : Math.abs(hh / dy);
  const t = Math.min(sx, sy);
  return [cx + dx * t, cy + dy * t];
}

const DOT_R = 7;

function DiscussionStickerItem({
  sticker, canEdit, canDelete, showDots,
  onMove, onDrag, onTextChange, onDelete, onHoverIn, onHoverOut, onDotMouseDown,
}: {
  sticker: DiscussionSticker;
  canEdit: boolean;
  canDelete: boolean;
  showDots: boolean;
  onMove: (x: number, y: number) => void;
  onDrag: (x: number, y: number) => void;
  onTextChange: (t: string) => void;
  onDelete: () => void;
  onHoverIn: () => void;
  onHoverOut: () => void;
  onDotMouseDown: (dot: 'n' | 's' | 'e' | 'w', e: React.MouseEvent) => void;
}) {
  const [lx, setLx] = useState(sticker.x);
  const [ly, setLy] = useState(sticker.y);
  const dragRef = useRef<{ sx: number; sy: number; smx: number; smy: number } | null>(null);

  useEffect(() => { setLx(sticker.x); setLy(sticker.y); }, [sticker.x, sticker.y]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (!canEdit) return;
    e.preventDefault();
    dragRef.current = { sx: lx, sy: ly, smx: e.clientX, smy: e.clientY };
    const move = (me: MouseEvent) => {
      if (!dragRef.current) return;
      const nx = dragRef.current.sx + me.clientX - dragRef.current.smx;
      const ny = dragRef.current.sy + me.clientY - dragRef.current.smy;
      setLx(nx);
      setLy(ny);
      onDrag(nx, ny);
    };
    const up = (me: MouseEvent) => {
      if (!dragRef.current) return;
      onMove(dragRef.current.sx + me.clientX - dragRef.current.smx, dragRef.current.sy + me.clientY - dragRef.current.smy);
      dragRef.current = null;
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };

  const dotStyle = (top: number, left: number): React.CSSProperties => ({
    position: 'absolute', top, left,
    width: DOT_R * 2, height: DOT_R * 2, borderRadius: '50%',
    background: '#3b82f6', border: '2px solid white',
    cursor: 'crosshair', zIndex: 30,
    boxShadow: '0 1px 4px rgba(0,0,0,0.22)',
  });

  return (
    <div
      onMouseEnter={onHoverIn}
      onMouseLeave={onHoverOut}
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute', left: lx, top: ly,
        width: STICKER_W, height: STICKER_H,
        backgroundColor: sticker.color, borderRadius: 10,
        boxShadow: '0 2px 12px rgba(0,0,0,0.13)',
        display: 'flex', flexDirection: 'column',
        zIndex: 10, cursor: canEdit ? 'grab' : 'default', userSelect: 'none',
      }}
    >
      {/* Точки соединения */}
      {showDots && (
        <>
          <div onMouseDown={e => { e.stopPropagation(); onDotMouseDown('n', e); }} style={dotStyle(-DOT_R, STICKER_W / 2 - DOT_R)} />
          <div onMouseDown={e => { e.stopPropagation(); onDotMouseDown('s', e); }} style={dotStyle(STICKER_H - DOT_R, STICKER_W / 2 - DOT_R)} />
          <div onMouseDown={e => { e.stopPropagation(); onDotMouseDown('e', e); }} style={dotStyle(STICKER_H / 2 - DOT_R, STICKER_W - DOT_R)} />
          <div onMouseDown={e => { e.stopPropagation(); onDotMouseDown('w', e); }} style={dotStyle(STICKER_H / 2 - DOT_R, -DOT_R)} />
        </>
      )}
      <div style={{ height: 24, flexShrink: 0, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '0 6px 0 0' }}>
        {canDelete && (
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onDelete(); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16, lineHeight: 1, padding: 2 }}
          >×</button>
        )}
      </div>
      <textarea
        value={sticker.text}
        onChange={e => { if (canEdit) onTextChange(e.target.value); }}
        onMouseDown={e => e.stopPropagation()}
        readOnly={!canEdit}
        placeholder={canEdit ? 'Введите текст...' : ''}
        style={{ flex: 1, padding: '0 10px', fontSize: 13, background: 'transparent', resize: 'none', border: 'none', outline: 'none', color: '#1f2937', cursor: canEdit ? 'text' : 'default' }}
      />
      <div style={{ height: 24, flexShrink: 0, padding: '0 10px', fontSize: 11, color: '#6b7280', borderTop: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {sticker.author_name}
      </div>
    </div>
  );
}

// ─── DiscussionSlideView ──────────────────────────────────────────────────────

export default function DiscussionSlideView({ slide, scale, user }: { slide: Slide; scale: number; user: User }) {
  const [stickers,       setStickers]       = useState<DiscussionSticker[]>([]);
  const [arrows,         setArrows]         = useState<DiscussionArrow[]>([]);
  const [topic,          setTopic]          = useState('');
  const [isConn,         setIsConn]         = useState(false);
  const [hoverStickerId, setHoverStickerId] = useState<string | null>(null);
  const [hoveredArrow,   setHoveredArrow]   = useState<string | null>(null);
  const [dragPositions,  setDragPositions]  = useState<Record<string, { x: number; y: number }>>({});
  const [drawing,        setDrawing]        = useState<{
    fromId: string; fromDot: 'n' | 's' | 'e' | 'w'; curX: number; curY: number;
  } | null>(null);
  const wsRef    = useRef<WebSocket | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const isStaff  = user.is_admin || user.is_teacher;

  useEffect(() => {
    const token = localStorage.getItem('access_token') ?? '';
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${window.location.host}/ws/discussion/${slide.id}/?token=${token}`);
    wsRef.current = ws;
    ws.onopen  = () => setIsConn(true);
    ws.onclose = () => { setIsConn(false); if (wsRef.current === ws) wsRef.current = null; };
    ws.onerror = () => setIsConn(false);
    ws.onmessage = (ev) => {
      try {
        const d = JSON.parse(ev.data);
        if (d.type === 'init')            { setStickers(d.stickers ?? []); setArrows(d.arrows ?? []); setTopic(d.topic ?? ''); }
        if (d.type === 'sticker_added')   setStickers(p => [...p, d.sticker]);
        if (d.type === 'sticker_updated') setStickers(p => p.map(s => s.id === d.sticker.id ? d.sticker : s));
        if (d.type === 'sticker_deleted') { setStickers(p => p.filter(s => s.id !== d.id)); setArrows(p => p.filter(a => a.from_id !== d.id && a.to_id !== d.id)); }
        if (d.type === 'arrow_added')     setArrows(p => [...p, d.arrow]);
        if (d.type === 'arrow_deleted')   setArrows(p => p.filter(a => a.id !== d.id));
        if (d.type === 'topic_updated')   setTopic(d.topic ?? '');
      } catch { /* ignore */ }
    };
    return () => { ws.close(); };
  }, [slide.id]);

  const send = (data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(data));
  };

  // ── Рисование стрелки ──────────────────────────────────────────────────────
  const startDraw = (fromId: string, fromDot: 'n' | 's' | 'e' | 'w', clientX: number, clientY: number) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDrawing({ fromId, fromDot, curX: clientX - rect.left, curY: clientY - rect.top });
  };

  useEffect(() => {
    if (!drawing) return;
    const onMove = (e: MouseEvent) => {
      const rect = boardRef.current?.getBoundingClientRect();
      if (!rect) return;
      setDrawing(prev => prev ? { ...prev, curX: e.clientX - rect.left, curY: e.clientY - rect.top } : null);
    };
    const onUp = (e: MouseEvent) => {
      const rect = boardRef.current?.getBoundingClientRect();
      if (rect && drawing) {
        const bx = e.clientX - rect.left;
        const by = e.clientY - rect.top;
        const target = stickers.find(s =>
          s.id !== drawing.fromId &&
          bx >= s.x && bx <= s.x + STICKER_W && by >= s.y && by <= s.y + STICKER_H,
        );
        if (target) send({ type: 'add_arrow', from_id: drawing.fromId, to_id: target.id });
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

  const addSticker  = (c: string) => send({ type: 'add_sticker', x: 60 + Math.random() * 500, y: 40 + Math.random() * 250, text: '', color: c, created_at: new Date().toISOString() });
  const moveSticker = (id: string, x: number, y: number) => { send({ type: 'update_sticker', id, x, y }); setStickers(p => p.map(s => s.id === id ? { ...s, x, y } : s)); };
  const textSticker = (id: string, text: string) => { send({ type: 'update_sticker', id, text }); setStickers(p => p.map(s => s.id === id ? { ...s, text } : s)); };
  const delSticker  = (id: string) => send({ type: 'delete_sticker', id });
  const delArrow    = (id: string) => send({ type: 'delete_arrow', id });
  const canEdit     = (authorId: number) => isStaff || authorId === user.id;
  const canDel      = (authorId: number) => isStaff || authorId === user.id;

  const fs = Math.max(11, 13 * scale);
  const fromSticker = drawing ? stickers.find(s => s.id === drawing.fromId) : null;
  const drawStart   = drawing && fromSticker ? getDotPos(fromSticker, drawing.fromDot) : null;

  return (
    <div style={{ width: CANVAS_W * scale, height: CANVAS_H * scale, display: 'flex', flexDirection: 'column', background: 'white', flexShrink: 0, overflow: 'hidden' }}>
      {topic && (
        <div style={{ padding: `${Math.max(4, 6 * scale)}px ${Math.max(8, 12 * scale)}px`, background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontSize: fs, fontWeight: 600, color: '#374151', flexShrink: 0 }}>
          {topic}
        </div>
      )}
      {/* Тулбар: цветные квадраты создают стикеры */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: `${Math.max(4, 6 * scale)}px ${Math.max(8, 10 * scale)}px`, borderBottom: '1px solid #e5e7eb', flexShrink: 0, background: 'white' }}>
        <span style={{ fontSize: Math.max(10, 11 * scale), color: '#9ca3af', flexShrink: 0 }}>Стикер:</span>
        {STICKER_COLORS.map(c => (
          <button
            key={c} onClick={() => { if (isConn) addSticker(c); }} disabled={!isConn} title="Добавить стикер"
            style={{ width: Math.max(16, 18 * scale), height: Math.max(16, 18 * scale), borderRadius: 3, border: '2px solid rgba(0,0,0,0.12)', background: c, cursor: isConn ? 'pointer' : 'default', opacity: isConn ? 1 : 0.4, padding: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.12)', flexShrink: 0 }}
          />
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: isConn ? '#4ade80' : '#f87171', display: 'inline-block' }} />
          <span style={{ fontSize: Math.max(9, 11 * scale), color: isConn ? '#16a34a' : '#dc2626' }}>{isConn ? 'Подключено' : 'Нет связи'}</span>
        </div>
      </div>
      {/* Доска */}
      <div ref={boardRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#f8fafc', cursor: drawing ? 'crosshair' : 'default' }}>
        {/* SVG: стрелки + рисуемая линия */}
        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 5, overflow: 'visible' }}>
          <defs>
            <marker id="pres-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#9ca3af" />
            </marker>
            <marker id="pres-arrow-del" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
            </marker>
            <marker id="pres-arrow-tmp" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
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
            const isHov = hoveredArrow === arrow.id;
            const cd = canDel(arrow.author_id);
            return (
              <g key={arrow.id}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={isHov ? '#ef4444' : '#9ca3af'} strokeWidth={isHov ? 2.5 : 2} markerEnd={isHov ? 'url(#pres-arrow-del)' : 'url(#pres-arrow)'} style={{ pointerEvents: 'none' }} />
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={16}
                  style={{ pointerEvents: 'stroke', cursor: cd ? 'pointer' : 'default' }}
                  onMouseEnter={() => setHoveredArrow(arrow.id)}
                  onMouseLeave={() => setHoveredArrow(null)}
                  onClick={cd ? () => delArrow(arrow.id) : undefined}
                />
                {isHov && cd && (
                  <g transform={`translate(${mx},${my})`} style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredArrow(arrow.id)}
                    onMouseLeave={() => setHoveredArrow(null)}
                    onClick={() => delArrow(arrow.id)}>
                    <circle r={10} fill="white" stroke="#fca5a5" strokeWidth={1.5} />
                    <text textAnchor="middle" dominantBaseline="middle" fontSize={14} fill="#ef4444" fontWeight="bold">×</text>
                  </g>
                )}
              </g>
            );
          })}
          {/* Рисуемая стрелка */}
          {drawing && drawStart && (
            <line x1={drawStart[0]} y1={drawStart[1]} x2={drawing.curX} y2={drawing.curY}
              stroke="#3b82f6" strokeWidth={2} strokeDasharray="6,3" markerEnd="url(#pres-arrow-tmp)" style={{ pointerEvents: 'none' }} />
          )}
        </svg>
        {stickers.map(s => (
          <DiscussionStickerItem
            key={s.id} sticker={s}
            canEdit={canEdit(s.author_id)}
            canDelete={canDel(s.author_id)}
            showDots={hoverStickerId === s.id || drawing?.fromId === s.id}
            onDrag={(x, y) => setDragPositions(prev => ({ ...prev, [s.id]: { x, y } }))}
            onMove={(x, y) => {
              moveSticker(s.id, x, y);
              setDragPositions(prev => { const n = { ...prev }; delete n[s.id]; return n; });
            }}
            onTextChange={t => textSticker(s.id, t)}
            onDelete={() => delSticker(s.id)}
            onHoverIn={() => { if (!drawing) setHoverStickerId(s.id); }}
            onHoverOut={() => { if (!drawing) setHoverStickerId(prev => prev === s.id ? null : prev); }}
            onDotMouseDown={(dot, e) => { e.preventDefault(); startDraw(s.id, dot, e.clientX, e.clientY); }}
          />
        ))}
        {stickers.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: fs, pointerEvents: 'none' }}>
            Нажмите на квадратик цвета чтобы добавить стикер
          </div>
        )}
      </div>
    </div>
  );
}
