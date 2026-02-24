import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';
import type { LessonSession, Slide, SlideBlock } from '../types';

// ─── Константы ────────────────────────────────────────────────────────────────

const CANVAS_W = 960;
const CANVAS_H = 540;

// ─── SVG-фигуры (дублируем из редактора для read-only рендера) ────────────────

function starPoints(n: number, outerR: number, innerR: number, cx: number, cy: number): string {
  return Array.from({ length: n * 2 }, (_, i) => {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / n - Math.PI / 2;
    return `${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`;
  }).join(' ');
}

function ShapeView({ w, h, block }: { w: number; h: number; block: Partial<SlideBlock> }) {
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
    default:
      el = <rect x={half} y={half} width={Math.max(1, w - sw)} height={Math.max(1, h - sw)}
              fill={fill} stroke={stroke} strokeWidth={sw} rx={2} />;
  }

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible' }}>
      {el}
    </svg>
  );
}

// ─── SlideView ────────────────────────────────────────────────────────────────

function SlideView({ slide, scale }: { slide: Slide; scale: number }) {
  if (slide.slide_type === 'content') {
    const blocks: SlideBlock[] = (slide.content as { blocks?: SlideBlock[] })?.blocks ?? [];
    return (
      <div
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          position: 'relative',
          background: 'white',
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          flexShrink: 0,
        }}
      >
        {blocks
          .slice()
          .sort((a, b) => (a.zIndex ?? 1) - (b.zIndex ?? 1))
          .map(block => (
            <div
              key={block.id}
              style={{
                position: 'absolute',
                left: block.x,
                top: block.y,
                width: block.w,
                height: block.h,
                transform: block.rotation ? `rotate(${block.rotation}deg)` : undefined,
                zIndex: block.zIndex ?? 1,
                overflow: 'hidden',
              }}
            >
              {block.type === 'text' && (
                <div
                  className="w-full h-full text-block-content"
                  style={{ pointerEvents: 'none' }}
                  dangerouslySetInnerHTML={{ __html: block.html ?? '' }}
                />
              )}
              {block.type === 'image' && block.src && (
                <img
                  src={block.src}
                  alt={block.alt ?? ''}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', pointerEvents: 'none' }}
                  draggable={false}
                />
              )}
              {block.type === 'shape' && (
                <ShapeView w={block.w} h={block.h} block={block} />
              )}
            </div>
          ))}
      </div>
    );
  }

  // Прочие типы — заглушка
  const TYPE_LABELS: Record<string, string> = {
    discussion: 'Доска обсуждений',
    form: 'Форма',
    video: 'Видео',
    poll: 'Опрос',
    quiz: 'Викторина',
    open_question: 'Открытый вопрос',
    image: 'Изображение',
  };
  return (
    <div
      style={{
        width: CANVAS_W * scale,
        height: CANVAS_H * scale,
        background: 'white',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: 48 }}>
        {slide.slide_type === 'discussion' ? '💬'
          : slide.slide_type === 'form' ? '📋'
          : slide.slide_type === 'video' ? '📹'
          : '📄'}
      </span>
      <span style={{ fontSize: 18, color: '#6b7280', fontWeight: 500 }}>
        {TYPE_LABELS[slide.slide_type] ?? slide.slide_type}
      </span>
      {slide.title && (
        <span style={{ fontSize: 14, color: '#9ca3af' }}>{slide.title}</span>
      )}
    </div>
  );
}

// ─── Иконки ───────────────────────────────────────────────────────────────────

function IconChevronLeft() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function IconFullscreen() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
    </svg>
  );
}

function IconExitFullscreen() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4M9 9H4M9 9L4 4m11 5h5m-5 0V4m0 5l5-5M9 15v5m0-5H4m5 0l-5 5m11-5h5m-5 0v5m0-5l5 5" />
    </svg>
  );
}

// ─── Главный компонент ────────────────────────────────────────────────────────

export default function LessonPresenterPage() {
  const { id } = useParams<{ id: string }>();
  const sessionId = Number(id);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [session,       setSession]       = useState<LessonSession | null>(null);
  const [slides,        setSlides]        = useState<Slide[]>([]);
  const [currentSlideId, setCurrentSlideId] = useState<number | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [isConnected,   setIsConnected]   = useState(false);
  const [isFullscreen,  setIsFullscreen]  = useState(false);
  const [sessionEnded,  setSessionEnded]  = useState(false);

  const wsRef        = useRef<WebSocket | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isPresenter = !!(user && session && session.teacher === user.id);

  // ── Масштаб слайда ─────────────────────────────────────────────────────────
  const [scale, setScale] = useState(1);

  const recalcScale = useCallback(() => {
    if (!containerRef.current) return;
    const { clientWidth: w, clientHeight: h } = containerRef.current;
    // Оставляем отступ для панели управления (~80px снизу для учителя, ~60px для студента)
    const reservedH = isPresenter ? 80 : 60;
    const availH = Math.max(100, h - reservedH);
    const s = Math.min(w / CANVAS_W, availH / CANVAS_H, 1.5);
    setScale(s);
  }, [isPresenter]);

  useEffect(() => {
    recalcScale();
    window.addEventListener('resize', recalcScale);
    return () => window.removeEventListener('resize', recalcScale);
  }, [recalcScale]);

  useEffect(() => {
    if (session) recalcScale();
  }, [session, recalcScale]);

  // ── Fullscreen API ─────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // ── Загрузка данных ────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const sesRes = await api.get(`/lessons/sessions/${sessionId}/`);
        const ses: LessonSession = sesRes.data;
        setSession(ses);
        setCurrentSlideId(ses.current_slide_id);
        if (!ses.is_active) setSessionEnded(true);

        const slidesRes = await api.get(`/lessons/lessons/${ses.lesson}/slides/`);
        setSlides(slidesRes.data);
      } catch {
        navigate('/lessons');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [sessionId, navigate]);

  // ── WebSocket ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    const token = localStorage.getItem('access_token') ?? '';
    const ws = new WebSocket(`ws://localhost:8000/ws/session/${sessionId}/?token=${token}`);
    wsRef.current = ws;

    ws.onopen  = () => setIsConnected(true);
    ws.onclose = () => { setIsConnected(false); wsRef.current = null; };
    ws.onerror = () => setIsConnected(false);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'slide_changed') {
          setCurrentSlideId(data.slide_id);
        } else if (data.type === 'session_ended') {
          setSessionEnded(true);
          setIsConnected(false);
        }
      } catch { /* ignore */ }
    };

    return () => { ws.close(); };
  }, [session, sessionId]);

  // ── Навигация (учитель) ────────────────────────────────────────────────────
  const sendWs = (data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(data));
  };

  const currentIdx = slides.findIndex(s => s.id === currentSlideId);

  const goToSlide = useCallback((slide: Slide) => {
    setCurrentSlideId(slide.id);
    sendWs({ type: 'set_slide', slide_id: slide.id });
  }, []); // eslint-disable-line

  const goPrev = () => {
    if (currentIdx > 0) goToSlide(slides[currentIdx - 1]);
  };

  const goNext = () => {
    if (currentIdx < slides.length - 1) goToSlide(slides[currentIdx + 1]);
  };

  // Стрелки клавиатуры (учитель)
  useEffect(() => {
    if (!isPresenter) return;
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'ArrowRight' || e.code === 'Space') { e.preventDefault(); goNext(); }
      if (e.code === 'ArrowLeft')  { e.preventDefault(); goPrev(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isPresenter, currentIdx, slides]); // eslint-disable-line

  // ── Завершение урока ───────────────────────────────────────────────────────
  const endSession = async () => {
    try {
      sendWs({ type: 'end_session' });
      await api.patch(`/lessons/sessions/${sessionId}/`, { is_active: false });
    } catch { /* ignore */ }
    navigate('/lessons');
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center text-white">
        <div className="text-lg">Загрузка урока...</div>
      </div>
    );
  }

  if (!session) return null;

  const currentSlide = slides.find(s => s.id === currentSlideId) ?? slides[0] ?? null;

  if (sessionEnded && !isPresenter) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex flex-col items-center justify-center gap-6 text-white">
        <div className="text-5xl">🏁</div>
        <div className="text-2xl font-semibold">Урок завершён</div>
        <div className="text-gray-400">{session.lesson_title}</div>
        <button
          onClick={() => navigate('/lessons')}
          className="mt-4 px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
        >
          На главную
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-gray-900 flex flex-col"
      style={{ userSelect: 'none' }}
    >
      {/* ── Верхняя панель ── */}
      <div className="flex items-center gap-3 px-4 py-2 bg-gray-800 border-b border-gray-700 flex-shrink-0 min-h-[48px]">
        {/* Кнопка назад */}
        <button
          onClick={() => navigate('/lessons')}
          className="text-gray-400 hover:text-white transition-colors p-1 rounded"
          title="Вернуться к урокам"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>

        {/* Название */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white truncate">{session.lesson_title}</div>
          <div className="text-xs text-gray-400 truncate">
            {session.school_class_name} · {isPresenter ? 'Ведёте вы' : session.teacher_name}
          </div>
        </div>

        {/* Индикатор слайда */}
        {slides.length > 0 && (
          <div className="text-sm text-gray-400 font-mono flex-shrink-0">
            {currentIdx + 1} / {slides.length}
          </div>
        )}

        {/* Статус подключения */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
          <span className={`text-xs ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
            {isConnected ? 'Live' : 'Нет связи'}
          </span>
        </div>

        {/* Fullscreen */}
        <button
          onClick={toggleFullscreen}
          className="text-gray-400 hover:text-white transition-colors p-1.5 rounded hover:bg-gray-700"
          title={isFullscreen ? 'Выйти из полного экрана' : 'Полный экран'}
        >
          {isFullscreen ? <IconExitFullscreen /> : <IconFullscreen />}
        </button>

        {/* Завершить (только учитель) */}
        {isPresenter && (
          <button
            onClick={endSession}
            className="flex-shrink-0 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors"
          >
            Завершить
          </button>
        )}
      </div>

      {/* ── Слайд ── */}
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        {currentSlide ? (
          <div style={{ width: CANVAS_W * scale, height: CANVAS_H * scale, position: 'relative', flexShrink: 0 }}>
            <SlideView slide={currentSlide} scale={scale} />
          </div>
        ) : (
          <div className="text-gray-500 text-lg">Нет слайдов</div>
        )}
      </div>

      {/* ── Нижняя панель навигации (только учитель) ── */}
      {isPresenter && slides.length > 0 && (
        <div className="flex items-center justify-center gap-4 px-4 py-3 bg-gray-800 border-t border-gray-700 flex-shrink-0">
          <button
            onClick={goPrev}
            disabled={currentIdx <= 0}
            className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Предыдущий слайд (←)"
          >
            <IconChevronLeft />
          </button>

          {/* Точки-индикаторы (до 20 слайдов) */}
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-xs">
            {slides.slice(0, 20).map((s, i) => (
              <button
                key={s.id}
                onClick={() => goToSlide(s)}
                className={`flex-shrink-0 rounded-full transition-all ${
                  s.id === currentSlideId
                    ? 'w-3 h-3 bg-blue-400'
                    : 'w-2 h-2 bg-gray-600 hover:bg-gray-400'
                }`}
                title={`Слайд ${i + 1}`}
              />
            ))}
            {slides.length > 20 && (
              <span className="text-xs text-gray-500 ml-1">+{slides.length - 20}</span>
            )}
          </div>

          <button
            onClick={goNext}
            disabled={currentIdx >= slides.length - 1}
            className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Следующий слайд (→)"
          >
            <IconChevronRight />
          </button>
        </div>
      )}

      {/* Подсказка для студентов */}
      {!isPresenter && (
        <div className="text-center py-2 text-xs text-gray-600 flex-shrink-0">
          Слайды переключает учитель
        </div>
      )}
    </div>
  );
}
