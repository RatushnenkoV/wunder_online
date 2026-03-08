import { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import DrawingCanvas from '../DrawingCanvas';
import api from '../../api/client';
import type { Slide, TextbookSlideContent, Textbook, AnnotationStroke } from '../../types';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const DRAW_COLORS = ['#000000', '#ef4444', '#3b82f6', '#22c55e', '#f97316'];
const HL_COLORS   = ['#fde047', '#a3e635', '#67e8f9', '#f9a8d4'];
const PEN_SIZES   = [2, 4, 8];
const ZOOM_MIN = 0.2, ZOOM_MAX = 4.0;

export default function TextbookSlideView({
  slide, isPresenter, sessionId,
}: {
  slide: Slide;
  isPresenter: boolean;
  sessionId: number;
}) {
  const content = slide.content as unknown as TextbookSlideContent;
  const { textbook_id, page_from, page_to } = content;

  const navH = 44;

  // Measure own container — independent of parent layout
  const outerRef  = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pdfWidth, setPdfWidth] = useState(0);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      const e = entries[0];
      if (e) setPdfWidth(Math.round(e.contentRect.width));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const [textbook, setTextbook]       = useState<Textbook | null>(null);
  const [currentPage, setCurrentPage] = useState(page_from || 1);
  const [numPages, setNumPages]       = useState(0);
  const [pageHeight, setPageHeight]   = useState(0);
  const [annotations, setAnnotations] = useState<Record<number, AnnotationStroke[]>>({});
  const [loadedPages, setLoadedPages] = useState<Set<number>>(new Set());
  const [zoom, setZoom]               = useState(1.0);
  const [drawTool, setDrawTool]       = useState<'pen' | 'eraser' | 'highlighter'>('pen');
  const [drawColor, setDrawColor]     = useState(DRAW_COLORS[0]);
  const [hlColor, setHlColor]         = useState(HL_COLORS[0]);
  const [penSizeIdx, setPenSizeIdx]   = useState(0);
  const saveTimerRef                  = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Pinch zoom tracking
  const pinchStartDist = useRef<number | null>(null);
  const pinchStartZoom = useRef(1);
  // Refs for Ctrl+Z handler (avoid stale closures)
  const currentPageRef  = useRef(currentPage);
  const annotationsRef  = useRef(annotations);
  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);
  useEffect(() => { annotationsRef.current = annotations; }, [annotations]);

  const effectiveTo    = numPages > 0 ? Math.min(page_to, numPages) : page_to;
  const currentStrokes = annotations[currentPage] ?? [];

  // Computed DrawingCanvas props
  const canvasTool    = drawTool === 'eraser' ? 'eraser' : 'pen';
  const canvasColor   = drawTool === 'highlighter' ? hlColor : drawColor;
  const canvasOpacity = drawTool === 'highlighter' ? 0.4 : 1;
  const canvasPenW    = drawTool === 'highlighter'
    ? PEN_SIZES[penSizeIdx] * 4   // highlighter is wider
    : PEN_SIZES[penSizeIdx];

  useEffect(() => {
    if (!textbook_id) return;
    api.get(`/lessons/textbooks/${textbook_id}/`).then(r => setTextbook(r.data)).catch(() => {});
  }, [textbook_id]);

  useEffect(() => {
    setCurrentPage(page_from || 1);
    setAnnotations({});
    setLoadedPages(new Set());
    setZoom(1);
  }, [slide.id]); // eslint-disable-line

  useEffect(() => {
    if (isPresenter || !sessionId || loadedPages.has(currentPage)) return;
    api.get(`/lessons/sessions/${sessionId}/slides/${slide.id}/textbook-annotations/`)
      .then(r => {
        const map: Record<number, AnnotationStroke[]> = {};
        for (const item of r.data) map[item.page_number] = item.strokes;
        setAnnotations(map);
        const loaded = new Set<number>(r.data.map((a: { page_number: number }) => a.page_number));
        loaded.add(currentPage);
        setLoadedPages(loaded);
      })
      .catch(() => setLoadedPages(prev => new Set([...prev, currentPage])));
  }, [currentPage, slide.id, sessionId, isPresenter]); // eslint-disable-line

  const saveAnnotations = useCallback((page: number, strokes: AnnotationStroke[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      api.put(`/lessons/sessions/${sessionId}/slides/${slide.id}/textbook-annotations/`, {
        page_number: page, strokes,
      }).catch(() => {});
    }, 800);
  }, [sessionId, slide.id]);

  const handleStrokesChange = (strokes: AnnotationStroke[]) => {
    setAnnotations(prev => ({ ...prev, [currentPage]: strokes }));
    saveAnnotations(currentPage, strokes);
  };

  // Ctrl+Z undo
  const saveAnnotationsRef = useRef(saveAnnotations);
  useEffect(() => { saveAnnotationsRef.current = saveAnnotations; }, [saveAnnotations]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        const page = currentPageRef.current;
        const strokes = annotationsRef.current[page] ?? [];
        if (strokes.length === 0) return;
        const next = strokes.slice(0, -1);
        setAnnotations(prev => ({ ...prev, [page]: next }));
        saveAnnotationsRef.current(page, next);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Ctrl+wheel zoom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom(z => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z * (1 - e.deltaY * 0.002))));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  // Pinch zoom handlers
  const onScrollTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      pinchStartDist.current = Math.hypot(dx, dy);
      pinchStartZoom.current = zoom;
    }
  };
  const onScrollTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDist.current !== null) {
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      const dist = Math.hypot(dx, dy);
      setZoom(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, pinchStartZoom.current * (dist / pinchStartDist.current))));
    }
  };
  const onScrollTouchEnd = () => { pinchStartDist.current = null; };

  const goTo = (p: number) => setCurrentPage(Math.max(page_from, Math.min(effectiveTo, p)));
  const fileUrl = textbook?.file_url;
  const zoomPct = Math.round(zoom * 100);

  return (
    <div ref={outerRef} style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: '#1f2937' }}>

      {/* Page navigation + zoom bar */}
      <div style={{ height: navH, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', background: '#111827', flexShrink: 0 }}>
        {!textbook_id ? (
          <span style={{ fontSize: 14, color: '#9ca3af' }}>📖 Учебник не выбран</span>
        ) : (
          <>
            <span style={{ fontSize: 13, color: '#9ca3af', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              📖 {textbook?.title ?? '…'}
            </span>
            {/* Page controls */}
            <button disabled={currentPage <= page_from} onClick={() => goTo(currentPage - 1)}
              style={{ width: 28, height: 28, borderRadius: 6, background: '#374151', color: '#d1d5db', border: 'none', cursor: currentPage <= page_from ? 'not-allowed' : 'pointer', opacity: currentPage <= page_from ? 0.4 : 1, fontSize: 16 }}>‹</button>
            <span style={{ fontSize: 13, color: '#d1d5db', minWidth: 56, textAlign: 'center' }}>{currentPage} / {effectiveTo}</span>
            <button disabled={currentPage >= effectiveTo} onClick={() => goTo(currentPage + 1)}
              style={{ width: 28, height: 28, borderRadius: 6, background: '#374151', color: '#d1d5db', border: 'none', cursor: currentPage >= effectiveTo ? 'not-allowed' : 'pointer', opacity: currentPage >= effectiveTo ? 0.4 : 1, fontSize: 16 }}>›</button>
            {/* Zoom controls */}
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.15)', margin: '0 4px' }} />
            <button onClick={() => setZoom(z => Math.max(ZOOM_MIN, +(z - 0.25).toFixed(2)))}
              disabled={zoom <= ZOOM_MIN}
              style={{ width: 26, height: 26, borderRadius: 6, background: '#374151', color: '#d1d5db', border: 'none', cursor: zoom <= ZOOM_MIN ? 'not-allowed' : 'pointer', opacity: zoom <= ZOOM_MIN ? 0.4 : 1, fontSize: 16 }}>−</button>
            <span style={{ fontSize: 11, color: '#9ca3af', minWidth: 38, textAlign: 'center' }}>{zoomPct}%</span>
            <button onClick={() => setZoom(z => Math.min(ZOOM_MAX, +(z + 0.25).toFixed(2)))}
              disabled={zoom >= ZOOM_MAX}
              style={{ width: 26, height: 26, borderRadius: 6, background: '#374151', color: '#d1d5db', border: 'none', cursor: zoom >= ZOOM_MAX ? 'not-allowed' : 'pointer', opacity: zoom >= ZOOM_MAX ? 0.4 : 1, fontSize: 16 }}>+</button>
            <button onClick={() => setZoom(1)} title="Сбросить масштаб"
              style={{ height: 26, padding: '0 6px', borderRadius: 6, background: zoom !== 1 ? '#4b5563' : 'transparent', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.15)', fontSize: 11, cursor: 'pointer' }}>1:1</button>
          </>
        )}
      </div>

      {/* Scrollable PDF area */}
      <div ref={scrollRef} style={{ flex: 1, overflow: 'auto' }}
        onTouchStart={onScrollTouchStart}
        onTouchMove={onScrollTouchMove}
        onTouchEnd={onScrollTouchEnd}
      >
        {!textbook_id ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af' }}>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: 40 }}>📖</div><div>Учебник не выбран</div></div>
          </div>
        ) : !fileUrl ? (
          <div style={{ color: '#6b7280', padding: 32 }}>Загрузка учебника…</div>
        ) : pdfWidth > 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            {/* Layout container — sets scroll area to zoomed dimensions */}
            <div style={{
              width: Math.round(pdfWidth * zoom),
              height: pageHeight > 0 ? Math.round(pageHeight * zoom) : undefined,
              position: 'relative',
              flexShrink: 0,
            }}>
              {/* PDF rendered at base width, scaled via CSS — no re-render on zoom change */}
              <div style={{
                position: 'absolute', top: 0, left: 0,
                width: pdfWidth,
                transform: `scale(${zoom})`,
                transformOrigin: 'top left',
              }}>
                <Document
                  file={fileUrl}
                  onLoadSuccess={({ numPages: n }) => setNumPages(n)}
                  loading={<div style={{ color: '#6b7280', padding: 32 }}>Загрузка…</div>}
                  error={<div style={{ color: '#ef4444', padding: 32 }}>Не удалось загрузить PDF</div>}
                >
                  <Page
                    pageNumber={currentPage}
                    width={pdfWidth}
                    onRenderSuccess={({ height }) => setPageHeight(height)}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
                </Document>
              </div>
              {/* Canvas at zoomed dimensions — pointer coords stay correct */}
              {!isPresenter && pageHeight > 0 && (
                <div style={{ position: 'absolute', top: 0, left: 0, width: Math.round(pdfWidth * zoom), height: Math.round(pageHeight * zoom) }}>
                  <DrawingCanvas
                    width={Math.round(pdfWidth * zoom)} height={Math.round(pageHeight * zoom)}
                    strokes={currentStrokes} onStrokesChange={handleStrokesChange}
                    tool={canvasTool} color={canvasColor} opacity={canvasOpacity} penWidth={canvasPenW}
                    hideToolbar
                  />
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Drawing toolbar — pinned in corner */}
      {!isPresenter && textbook_id && (
        <div style={{
          position: 'absolute', right: 10, top: navH + 10, zIndex: 20,
          display: 'flex', flexDirection: 'column', gap: 3,
          background: 'rgba(17,24,39,0.88)', borderRadius: 10, padding: 5,
          backdropFilter: 'blur(4px)',
        }}>
          {/* Pen colors */}
          {DRAW_COLORS.map(c => (
            <button key={c} onClick={() => { setDrawTool('pen'); setDrawColor(c); }}
              style={{ width: 20, height: 20, borderRadius: '50%', background: c,
                border: `2px solid ${drawColor === c && drawTool === 'pen' ? '#fff' : 'transparent'}`,
                cursor: 'pointer', flexShrink: 0 }} title={`Ручка: ${c}`} />
          ))}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.2)', margin: '2px 0' }} />
          {/* Highlighter colors */}
          {HL_COLORS.map(c => (
            <button key={c} onClick={() => { setDrawTool('highlighter'); setHlColor(c); }}
              style={{ width: 20, height: 20, borderRadius: '50%',
                background: c + '99',  // semi-transparent preview
                border: `2px solid ${hlColor === c && drawTool === 'highlighter' ? '#fff' : 'rgba(255,255,255,0.3)'}`,
                cursor: 'pointer', flexShrink: 0 }} title={`Маркер`} />
          ))}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.2)', margin: '2px 0' }} />
          {/* Pen sizes */}
          {PEN_SIZES.map((_, i) => (
            <button key={i} onClick={() => setPenSizeIdx(i)}
              style={{ width: 20, height: 20, borderRadius: 4,
                background: penSizeIdx === i ? '#4b5563' : 'transparent',
                border: `1px solid ${penSizeIdx === i ? '#fff' : 'rgba(255,255,255,0.25)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
              title={`Размер ${i + 1}`}>
              <div style={{ width: PEN_SIZES[i], height: PEN_SIZES[i], borderRadius: '50%', background: '#d1d5db' }} />
            </button>
          ))}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.2)', margin: '2px 0' }} />
          {/* Eraser */}
          <button onClick={() => setDrawTool('eraser')}
            style={{ width: 20, height: 20, borderRadius: 4, fontSize: 11,
              background: drawTool === 'eraser' ? '#6b7280' : 'transparent',
              border: `1px solid ${drawTool === 'eraser' ? '#fff' : 'rgba(255,255,255,0.3)'}`,
              color: '#fff', cursor: 'pointer' }} title="Ластик">⌫</button>
          {/* Undo */}
          <button onClick={() => handleStrokesChange(currentStrokes.slice(0, -1))}
            disabled={currentStrokes.length === 0}
            style={{ width: 20, height: 20, borderRadius: 4, fontSize: 11, background: 'transparent',
              border: '1px solid rgba(255,255,255,0.3)',
              color: currentStrokes.length === 0 ? '#6b7280' : '#fff',
              cursor: currentStrokes.length === 0 ? 'not-allowed' : 'pointer' }} title="Отменить (Ctrl+Z)">↩</button>
          {/* Clear */}
          <button onClick={() => handleStrokesChange([])}
            style={{ width: 20, height: 20, borderRadius: 4, fontSize: 9, background: '#dc2626', border: 'none', color: '#fff', cursor: 'pointer' }} title="Очистить">✕</button>
        </div>
      )}
    </div>
  );
}

