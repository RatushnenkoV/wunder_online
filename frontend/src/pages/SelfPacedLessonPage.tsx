import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import type { Lesson, Slide, Textbook, TextbookSlideContent, AnnotationStroke } from '../types';
import DrawingCanvas from '../components/DrawingCanvas';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const CANVAS_W = 960;
const CANVAS_H = 540;

// ─── TextbookSelfView ─────────────────────────────────────────────────────────

const DRAW_COLORS = ['#000000', '#ef4444', '#3b82f6', '#22c55e', '#f97316'];
const HL_COLORS   = ['#fde047', '#a3e635', '#67e8f9', '#f9a8d4'];
const PEN_SIZES   = [2, 4, 8];
const ZOOM_MIN = 0.2, ZOOM_MAX = 4.0;

function TextbookSelfView({ slide }: { slide: Slide }) {
  const content = slide.content as unknown as TextbookSlideContent;
  const { textbook_id, page_from, page_to } = content;

  const navH = 44;

  // Measure own container — fills parent via position: absolute inset: 0
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
  const [loaded, setLoaded]           = useState(false);
  const [zoom, setZoom]               = useState(1.0);
  const [drawTool, setDrawTool]       = useState<'pen' | 'eraser' | 'highlighter'>('pen');
  const [drawColor, setDrawColor]     = useState(DRAW_COLORS[0]);
  const [hlColor, setHlColor]         = useState(HL_COLORS[0]);
  const [penSizeIdx, setPenSizeIdx]   = useState(0);
  const saveTimerRef                  = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Pinch zoom tracking
  const pinchStartDist = useRef<number | null>(null);
  const pinchStartZoom = useRef(1);
  // Refs for Ctrl+Z handler
  const currentPageRef = useRef(currentPage);
  const annotationsRef = useRef(annotations);
  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);
  useEffect(() => { annotationsRef.current = annotations; }, [annotations]);

  const effectiveTo    = numPages > 0 ? Math.min(page_to, numPages) : page_to;
  const currentStrokes = annotations[currentPage] ?? [];

  // Computed DrawingCanvas props
  const canvasTool    = drawTool === 'eraser' ? 'eraser' : 'pen';
  const canvasColor   = drawTool === 'highlighter' ? hlColor : drawColor;
  const canvasOpacity = drawTool === 'highlighter' ? 0.4 : 1;
  const canvasPenW    = drawTool === 'highlighter' ? PEN_SIZES[penSizeIdx] * 4 : PEN_SIZES[penSizeIdx];

  useEffect(() => {
    if (!textbook_id) return;
    api.get(`/lessons/textbooks/${textbook_id}/`).then(r => setTextbook(r.data)).catch(() => {});
  }, [textbook_id]);

  useEffect(() => {
    setCurrentPage(page_from || 1);
    setAnnotations({});
    setLoaded(false);
    setZoom(1);
  }, [slide.id]); // eslint-disable-line

  useEffect(() => {
    if (loaded) return;
    const key = `self_paced_annotations_${slide.id}`;
    try {
      const stored = JSON.parse(localStorage.getItem(key) || '{}');
      setAnnotations(stored);
    } catch { /* ignore */ }
    setLoaded(true);
  }, [slide.id, loaded]);

  const saveAnnotations = useCallback((page: number, strokes: AnnotationStroke[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const key = `self_paced_annotations_${slide.id}`;
      try {
        const existing = JSON.parse(localStorage.getItem(key) || '{}');
        existing[page] = strokes;
        localStorage.setItem(key, JSON.stringify(existing));
      } catch { /* ignore */ }
    }, 500);
  }, [slide.id]);

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
                <Document file={fileUrl} onLoadSuccess={({ numPages: n }) => setNumPages(n)}
                  loading={<div style={{ color: '#6b7280', padding: 32 }}>Загрузка…</div>}
                  error={<div style={{ color: '#ef4444', padding: 32 }}>Не удалось загрузить PDF</div>}>
                  <Page pageNumber={currentPage} width={pdfWidth}
                    onRenderSuccess={({ height }) => setPageHeight(height)}
                    renderTextLayer={false} renderAnnotationLayer={false} />
                </Document>
              </div>
              {/* Canvas at zoomed dimensions — pointer coords stay correct */}
              {pageHeight > 0 && (
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

      {/* Drawing toolbar — pinned in corner, outside scroll area */}
      {textbook_id && (
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
                background: c + '99',
                border: `2px solid ${hlColor === c && drawTool === 'highlighter' ? '#fff' : 'rgba(255,255,255,0.3)'}`,
                cursor: 'pointer', flexShrink: 0 }} title="Маркер" />
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

// ─── SlideContent (read-only render) ─────────────────────────────────────────

function SlideContent({ slide, scale }: { slide: Slide; scale: number }) {
  if (slide.slide_type === 'content' || slide.slide_type === 'image') {
    const blocks = (slide.content as { blocks?: { id: string; type: string; x: number; y: number; w: number; h: number; rotation?: number; text?: string; src?: string; fillColor?: string }[] })?.blocks ?? [];
    return (
      <div style={{ width: CANVAS_W * scale, height: CANVAS_H * scale, position: 'relative', background: 'white', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ width: CANVAS_W, height: CANVAS_H, position: 'absolute', top: 0, left: 0, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          {blocks.map(b => (
            <div key={b.id} style={{
              position: 'absolute',
              left: b.x, top: b.y, width: b.w, height: b.h,
              transform: b.rotation ? `rotate(${b.rotation}deg)` : undefined,
              transformOrigin: 'center center',
            }}>
              {b.type === 'text' && (
                <div style={{ width: '100%', height: '100%', overflow: 'hidden', fontSize: 16 }}
                  dangerouslySetInnerHTML={{ __html: b.text || '' }} />
              )}
              {b.type === 'image' && b.src && (
                <img src={b.src} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="" />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (slide.slide_type === 'video') {
    const url: string = (slide.content as { url?: string })?.url ?? '';
    let embedUrl = '';
    try {
      const u = new URL(url);
      if (u.hostname.includes('youtube') || u.hostname.includes('youtu.be')) {
        const v = u.searchParams.get('v') || u.pathname.split('/').pop();
        if (v) embedUrl = `https://www.youtube.com/embed/${v}`;
      } else if (u.hostname.includes('vimeo')) {
        const v = u.pathname.split('/').pop();
        if (v) embedUrl = `https://player.vimeo.com/video/${v}`;
      }
    } catch { /* ignore */ }
    return (
      <div style={{ width: CANVAS_W * scale, height: CANVAS_H * scale, background: '#000', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {embedUrl
          ? <iframe src={embedUrl} style={{ width: '100%', height: '100%' }} allowFullScreen title={slide.title} />
          : <div style={{ color: '#6b7280', fontSize: 16 }}>Видео не настроено</div>}
      </div>
    );
  }

  // Generic placeholder for interactive slides
  const ICONS: Record<string, string> = { poll: '📊', quiz: '🏆', open_question: '💬', form: '📝', discussion: '🗣️', vocab: '📚', textbook: '📖' };
  const LABELS: Record<string, string> = { poll: 'Опрос', quiz: 'Викторина', open_question: 'Открытый вопрос', form: 'Форма', discussion: 'Обсуждение', vocab: 'Словарь', textbook: 'Учебник' };
  return (
    <div style={{ width: CANVAS_W * scale, height: CANVAS_H * scale, background: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, flexShrink: 0 }}>
      <span style={{ fontSize: 48 }}>{ICONS[slide.slide_type] ?? '📄'}</span>
      <span style={{ fontSize: 18, color: '#6b7280', fontWeight: 500 }}>{slide.title || LABELS[slide.slide_type] || slide.slide_type}</span>
    </div>
  );
}

// ─── SelfPacedLessonPage ──────────────────────────────────────────────────────

export default function SelfPacedLessonPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  useAuth(); // сессия авторизации

  const [lesson, setLesson]     = useState<Lesson | null>(null);
  const [slides, setSlides]     = useState<Slide[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading]   = useState(true);

  const slideAreaRef = useRef<HTMLDivElement>(null);
  const [slideAreaSize, setSlideAreaSize] = useState({ w: 0, h: 0 });

  // Scale derived from slide area — no cap, fills the area
  const scale = slideAreaSize.w > 0 && slideAreaSize.h > 0
    ? Math.min(slideAreaSize.w / CANVAS_W, slideAreaSize.h / CANVAS_H)
    : 1;

  useEffect(() => {
    const load = async () => {
      try {
        const [lessonRes, slidesRes] = await Promise.all([
          api.get(`/lessons/lessons/${id}/`),
          api.get(`/lessons/lessons/${id}/slides/`),
        ]);
        setLesson(lessonRes.data);
        setSlides(slidesRes.data);
      } catch {
        navigate('/lessons');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, navigate]);

  useEffect(() => {
    const el = slideAreaRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      const e = entries[0];
      if (e) setSlideAreaSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [loading]);

  if (loading) {
    return <div className="flex items-center justify-center h-screen bg-gray-900 dark:bg-slate-900 text-white">Загрузка…</div>;
  }

  if (!lesson || slides.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 dark:bg-slate-900 text-white gap-4">
        <span className="text-5xl">📄</span>
        <p>Слайды не найдены</p>
        <button onClick={() => navigate('/lessons')} className="px-4 py-2 bg-purple-600 rounded-lg text-sm">К урокам</button>
      </div>
    );
  }

  const currentSlide = slides[currentIdx];

  return (
    <div className="fixed inset-0 bg-gray-900 dark:bg-slate-900 flex flex-col" style={{ userSelect: 'none' }}>
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-gray-800 dark:bg-slate-700 border-b border-gray-700 flex-shrink-0 min-h-[48px]">
        <button onClick={() => navigate('/lessons')} className="text-gray-400 dark:text-slate-500 hover:text-white transition-colors p-1 rounded">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white truncate">{lesson.title}</div>
          <div className="text-xs text-gray-400 dark:text-slate-500">Самостоятельное прохождение</div>
        </div>
        <div className="text-sm text-gray-400 dark:text-slate-500 font-mono flex-shrink-0">{currentIdx + 1} / {slides.length}</div>
      </div>

      {/* Slide area */}
      <div ref={slideAreaRef} className="flex-1 relative overflow-hidden">
        {currentSlide?.slide_type === 'textbook' ? (
          <TextbookSelfView slide={currentSlide} />
        ) : currentSlide ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div style={{
              width: CANVAS_W * scale,
              height: CANVAS_H * scale,
              flexShrink: 0,
              overflow: 'hidden',
            }}>
              <SlideContent slide={currentSlide} scale={scale} />
            </div>
          </div>
        ) : null}
      </div>

      {/* Bottom nav */}
      <div className="flex items-center justify-center gap-4 px-4 py-3 bg-gray-800 dark:bg-slate-700 border-t border-gray-700 flex-shrink-0">
        <button
          onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
          disabled={currentIdx === 0}
          className="px-4 py-2 bg-gray-700 dark:bg-slate-600 text-white rounded-lg text-sm font-medium hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          ← Назад
        </button>

        <div className="flex gap-1">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIdx(i)}
              className={`w-2 h-2 rounded-full transition-colors ${i === currentIdx ? 'bg-purple-400' : 'bg-gray-600 hover:bg-gray-400'}`}
            />
          ))}
        </div>

        {currentIdx < slides.length - 1 ? (
          <button
            onClick={() => setCurrentIdx(i => Math.min(slides.length - 1, i + 1))}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-500 transition-colors"
          >
            Далее →
          </button>
        ) : (
          <button
            onClick={() => navigate('/lessons')}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-500 transition-colors"
          >
            ✓ Завершить
          </button>
        )}
      </div>
    </div>
  );
}
