import { useRef, useEffect, useState, useCallback } from 'react';
import type { AnnotationStroke } from '../types';

interface Props {
  width: number;
  height: number;
  strokes: AnnotationStroke[];
  onStrokesChange: (strokes: AnnotationStroke[]) => void;
  readOnly?: boolean;
  // controlled mode — used when toolbar is rendered externally
  tool?: 'pen' | 'eraser';
  color?: string;
  penWidth?: number;   // controlled pen width (px on canvas)
  opacity?: number;    // controlled opacity for highlighter (<1)
  hideToolbar?: boolean;
}

const COLORS = ['#000000', '#ef4444', '#3b82f6', '#22c55e', '#f97316'];
const PEN_WIDTH = 3;
const ERASER_WIDTH = 20;

function drawStroke(ctx: CanvasRenderingContext2D, stroke: AnnotationStroke, w: number, h: number) {
  if (stroke.points.length < 2) return;
  const alpha = stroke.opacity ?? 1;
  ctx.globalAlpha = alpha;
  if (stroke.eraser) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = stroke.color;
  }
  ctx.lineWidth = stroke.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(stroke.points[0][0] * w, stroke.points[0][1] * h);
  for (let i = 1; i < stroke.points.length; i++) {
    ctx.lineTo(stroke.points[i][0] * w, stroke.points[i][1] * h);
  }
  ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

export default function DrawingCanvas({
  width, height, strokes, onStrokesChange, readOnly,
  tool: toolProp, color: colorProp, penWidth: penWidthProp, opacity: opacityProp,
  hideToolbar,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const currentPointsRef = useRef<[number, number][]>([]);

  const [internalTool, setInternalTool] = useState<'pen' | 'eraser'>('pen');
  const [internalColor, setInternalColor] = useState(COLORS[0]);

  const tool      = toolProp      ?? internalTool;
  const color     = colorProp     ?? internalColor;
  const penWidth  = penWidthProp  ?? PEN_WIDTH;
  const opacity   = opacityProp   ?? 1;

  // Re-render all strokes whenever strokes/size change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    for (const stroke of strokes) {
      drawStroke(ctx, stroke, width, height);
    }
  }, [strokes, width, height]);

  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent): [number, number] | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    return [(clientX - rect.left) / width, (clientY - rect.top) / height];
  }, [width, height]);

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (readOnly) return;
    // Ignore multi-touch (pinch gesture handled by parent)
    if ('touches' in e && e.touches.length > 1) return;
    e.preventDefault();
    const pos = getPos(e);
    if (!pos) return;
    isDrawingRef.current = true;
    currentPointsRef.current = [pos];
  }, [readOnly, getPos]);

  const moveDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingRef.current || readOnly) return;
    if ('touches' in e && e.touches.length > 1) return; // pinch in progress
    e.preventDefault();
    const pos = getPos(e);
    if (!pos) return;
    currentPointsRef.current.push(pos);

    // Incremental render of the current segment
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pts = currentPointsRef.current;
    const last = pts[pts.length - 2];
    const curr = pts[pts.length - 1];
    if (!last) return;

    if (tool === 'eraser') {
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = ERASER_WIDTH;
    } else {
      ctx.globalAlpha = opacity;
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth = penWidth;
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(last[0] * width, last[1] * height);
    ctx.lineTo(curr[0] * width, curr[1] * height);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }, [readOnly, getPos, tool, color, penWidth, opacity, width, height]);

  const endDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingRef.current || readOnly) return;
    e.preventDefault();
    isDrawingRef.current = false;
    const pts = currentPointsRef.current;
    currentPointsRef.current = [];
    if (pts.length < 2) return;

    const newStroke: AnnotationStroke = {
      id: `s${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      color,
      width: tool === 'eraser' ? ERASER_WIDTH : penWidth,
      points: pts,
      eraser: tool === 'eraser',
      opacity: tool === 'eraser' ? 1 : opacity,
    };
    onStrokesChange([...strokes, newStroke]);
  }, [readOnly, color, tool, penWidth, opacity, strokes, onStrokesChange]);

  const handleUndo = () => {
    if (strokes.length === 0) return;
    onStrokesChange(strokes.slice(0, -1));
  };

  const handleClear = () => {
    onStrokesChange([]);
  };

  if (readOnly) {
    return (
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
      />
    );
  }

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width, height }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ position: 'absolute', top: 0, left: 0, cursor: tool === 'eraser' ? 'cell' : 'crosshair', touchAction: 'none' }}
        onMouseDown={startDraw}
        onMouseMove={moveDraw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={moveDraw}
        onTouchEnd={endDraw}
      />

      {/* Toolbar — only rendered when not using an external toolbar */}
      {!hideToolbar && (
        <div style={{
          position: 'absolute', right: 8, top: 8,
          display: 'flex', flexDirection: 'column', gap: 4,
          background: 'rgba(17,24,39,0.75)', borderRadius: 10, padding: 6,
        }}>
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => { setInternalTool('pen'); setInternalColor(c); }}
              style={{
                width: 22, height: 22, borderRadius: '50%', background: c, border: `2px solid ${color === c && tool === 'pen' ? '#fff' : 'transparent'}`,
                cursor: 'pointer', flexShrink: 0,
              }}
              title={c}
            />
          ))}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.2)', margin: '2px 0' }} />
          <button
            onClick={() => setInternalTool('eraser')}
            style={{
              width: 22, height: 22, borderRadius: 6, fontSize: 13, background: tool === 'eraser' ? '#6b7280' : 'transparent',
              border: `1px solid ${tool === 'eraser' ? '#fff' : 'rgba(255,255,255,0.3)'}`, color: '#fff', cursor: 'pointer',
            }}
            title="Ластик"
          >E</button>
          <button
            onClick={handleUndo}
            disabled={strokes.length === 0}
            style={{
              width: 22, height: 22, borderRadius: 6, fontSize: 13, background: 'transparent',
              border: '1px solid rgba(255,255,255,0.3)', color: strokes.length === 0 ? '#6b7280' : '#fff',
              cursor: strokes.length === 0 ? 'not-allowed' : 'pointer',
            }}
            title="Отменить"
          >↩</button>
          <button
            onClick={handleClear}
            style={{
              width: 22, height: 22, borderRadius: 6, fontSize: 11, background: '#dc2626',
              border: 'none', color: '#fff', cursor: 'pointer',
            }}
            title="Очистить всё"
          >✕</button>
        </div>
      )}
    </div>
  );
}
