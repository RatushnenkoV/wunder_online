import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';
import SlideView from '../components/lesson-presenter/SlideView';
import TextbookSlideView from '../components/lesson-presenter/TextbookSlideView';
import type { LessonSession, Slide, FormResults, FormAnswerValue, QuizLeaderboardData, QuizLeaderboardEntry } from '../types';

const CANVAS_W = 960;
const CANVAS_H = 540;
const MEDALS = ['🥇', '🥈', '🥉'];

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

  // ── Форма: ответы студентов и результаты для учителя ───────────────────────
  const [formResults,   setFormResults]   = useState<Record<number, FormResults>>({});
  const [formSubmitted, setFormSubmitted] = useState<Record<number, boolean>>({});
  const [formAnswers,   setFormAnswers]   = useState<Record<number, FormAnswerValue[]>>({});

  // ── Видео-синк ─────────────────────────────────────────────────────────────
  const [videoControl, setVideoControl] = useState<{ action: string; ts: number } | null>(null);

  // ── Викторина ──────────────────────────────────────────────────────────────
  const [quizStarted,       setQuizStarted]       = useState<{ slideId: number; questionIdx: number; timeLimitSec: number; startedAt: number } | null>(null);
  const [quizAnswered,      setQuizAnswered]       = useState<Record<string, { optionIndex: number; points: number; isCorrect: boolean }>>({});
  const [quizAnsweredCount, setQuizAnsweredCount]  = useState<Record<string, number>>({});
  const [quizLeaderboard,   setQuizLeaderboard]    = useState<Record<string, QuizLeaderboardData>>({});
  const [quizCurrentQuestion, setQuizCurrentQuestion] = useState<Record<number, number>>({});
  const [lastLeaderboard,   setLastLeaderboard]    = useState<QuizLeaderboardEntry[] | null>(null);

  const wsRef        = useRef<WebSocket | null>(null);
  const slideAreaRef = useRef<HTMLDivElement>(null);
  const [slideAreaSize, setSlideAreaSize] = useState({ w: 0, h: 0 });

  const isPresenter = !!(user && session && session.teacher === user.id);

  // Scale derived from actual slide area size — no cap, fills the area
  const scale = slideAreaSize.w > 0 && slideAreaSize.h > 0
    ? Math.min(slideAreaSize.w / CANVAS_W, slideAreaSize.h / CANVAS_H)
    : 1;

  // Track slide area dimensions — depends on `loading` so effect re-runs after the
  // loading screen unmounts and slideAreaRef becomes attached to the real element.
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
    let active = true;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const doConnect = () => {
      if (!active) return;

      const token = localStorage.getItem('access_token') ?? '';
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(
        `${protocol}://${window.location.host}/ws/session/${sessionId}/?token=${token}`,
      );
      wsRef.current = ws;

      ws.onopen = () => {
        if (active) setIsConnected(true);
      };

      ws.onclose = (e) => {
        // eslint-disable-next-line no-console
        console.log(`[WS session] closed — code ${e.code}, reason: "${e.reason}"`);
        // Обнуляем ref только если он всё ещё указывает на этот конкретный WS.
        // Иначе onclose от старого соединения обнулит ссылку на уже новое соединение
        // (React StrictMode запускает cleanup и новый effect почти одновременно).
        if (wsRef.current === ws) wsRef.current = null;
        if (!active) return;
        setIsConnected(false);
        // Авто-реконнект при любом неожиданном закрытии
        // (1000 = нормальное, 4001 = нет авторизации, 4403 = нет доступа)
        if (e.code !== 1000 && e.code !== 4001 && e.code !== 4403) {
          reconnectTimer = setTimeout(doConnect, 2000);
        }
      };

      ws.onerror = () => {
        if (active) setIsConnected(false);
      };

      ws.onmessage = (event) => {
        if (!active) return;
        try {
          const data = JSON.parse(event.data);
          // eslint-disable-next-line no-console
          console.log('[WS session] received:', data.type, data);
          if (data.type === 'init') {
            if (data.current_slide_id != null) setCurrentSlideId(data.current_slide_id);
            if (!data.is_active) setSessionEnded(true);
          } else if (data.type === 'slide_changed') {
            setCurrentSlideId(data.slide_id);
          } else if (data.type === 'session_ended') {
            setSessionEnded(true);
            setIsConnected(false);
          } else if (data.type === 'form_results_updated') {
            // eslint-disable-next-line no-console
            console.log('[WS session] form_results_updated → slide_id', data.slide_id, 'results:', data.results);
            setFormResults(prev => ({ ...prev, [data.slide_id]: data.results }));
          } else if (data.type === 'video_control') {
            setVideoControl({ action: data.action as string, ts: Date.now() });
          } else if (data.type === 'quiz_started') {
            setQuizStarted({ slideId: data.slide_id, questionIdx: data.question_idx, timeLimitSec: data.time_limit_sec, startedAt: Date.now() });
          } else if (data.type === 'quiz_answer_received') {
            const key = `${data.slide_id}_${data.question_idx}`;
            setQuizAnsweredCount(prev => ({ ...prev, [key]: data.answered_count }));
          } else if (data.type === 'quiz_answer_confirmed') {
            const key = `${data.slide_id}_${data.question_idx}`;
            setQuizAnswered(prev => ({ ...prev, [key]: { optionIndex: data.option_index, points: data.points, isCorrect: data.is_correct } }));
          } else if (data.type === 'quiz_leaderboard') {
            const key = `${data.slide_id}_${data.question_idx}`;
            const lb: QuizLeaderboardData = {
              slide_id: data.slide_id,
              question_idx: data.question_idx,
              correct_index: data.correct_index,
              leaderboard: data.leaderboard,
              answer_stats: data.answer_stats,
            };
            setQuizLeaderboard(prev => ({ ...prev, [key]: lb }));
            setLastLeaderboard(data.leaderboard);
          }
        } catch { /* ignore */ }
      };
    };

    doConnect();

    return () => {
      active = false;
      if (reconnectTimer !== null) clearTimeout(reconnectTimer);
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    };
  }, [sessionId]);

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

  // ── Видео-синк (учитель → ученики) ────────────────────────────────────────
  const handleVideoControl = (action: string) => {
    sendWs({ type: 'video_control', action });
  };

  // ── Викторина ──────────────────────────────────────────────────────────────
  const handleQuizStart = (slideId: number, questionIdx: number) => {
    sendWs({ type: 'quiz_start', slide_id: slideId, question_idx: questionIdx });
  };

  const handleQuizShowResults = (slideId: number, questionIdx: number) => {
    sendWs({ type: 'quiz_show_results', slide_id: slideId, question_idx: questionIdx });
  };

  const handleQuizAnswer = (slideId: number, questionIdx: number, optionIndex: number, elapsedMs: number) => {
    sendWs({ type: 'quiz_answer', slide_id: slideId, question_idx: questionIdx, option_index: optionIndex, elapsed_ms: elapsedMs });
  };

  const handleQuizNextQuestion = (slideId: number) => {
    setQuizCurrentQuestion(prev => ({ ...prev, [slideId]: (prev[slideId] ?? 0) + 1 }));
  };

  // ── Отправка ответов на форму (студент) ────────────────────────────────────
  const handleFormSubmit = (slideId: number, answers: FormAnswerValue[]) => {
    // eslint-disable-next-line no-console
    console.log('[form_answer] sending slide_id:', slideId, 'answers:', answers, 'ws ready?', wsRef.current?.readyState === WebSocket.OPEN);
    sendWs({ type: 'form_answer', slide_id: slideId, answers });
    setFormSubmitted(prev => ({ ...prev, [slideId]: true }));
    setFormAnswers(prev => ({ ...prev, [slideId]: answers }));
  };

  // ── Загрузка начальных результатов формы для учителя ──────────────────────
  useEffect(() => {
    const slide = slides.find(s => s.id === currentSlideId) ?? null;
    if (!slide || slide.slide_type !== 'form' || !isPresenter) return;
    if (formResults[slide.id] !== undefined) return; // уже загружено
    api.get(`/lessons/sessions/${sessionId}/slides/${slide.id}/form-results/`)
      .then(res => setFormResults(prev => ({ ...prev, [slide.id]: res.data })))
      .catch(() => {});
  }, [currentSlideId, isPresenter]); // eslint-disable-line

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-900 dark:bg-slate-900 flex items-center justify-center text-white">
        <div className="text-lg">Загрузка урока...</div>
      </div>
    );
  }

  if (!session) return null;

  const currentSlide = slides.find(s => s.id === currentSlideId) ?? slides[0] ?? null;

  if (sessionEnded && !isPresenter) {
    const topPlayers = lastLeaderboard?.slice(0, 3) ?? [];
    return (
      <div className="fixed inset-0 bg-gray-900 dark:bg-slate-900 flex flex-col items-center justify-center gap-6 text-white px-4">
        <div className="text-5xl">🏁</div>
        <div className="text-2xl font-semibold">Урок завершён</div>
        <div className="text-gray-400 dark:text-slate-500">{session.lesson_title}</div>

        {topPlayers.length > 0 && (
          <div className="w-full max-w-sm space-y-2">
            <div className="text-sm text-gray-400 dark:text-slate-500 text-center mb-3">Итоговый рейтинг</div>
            {topPlayers.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 bg-gray-800 dark:bg-slate-700 rounded-xl px-4 py-3">
                <span className="text-2xl w-8 text-center">{MEDALS[i]}</span>
                <span className="flex-1 font-medium truncate">{p.name}</span>
                <span className="text-yellow-400 font-bold">{p.points} оч.</span>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => navigate('/lessons')}
          className="mt-4 px-6 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-medium"
        >
          На главную
        </button>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-gray-900 dark:bg-slate-900 flex flex-col"
      style={{ userSelect: 'none' }}
    >
      {/* ── Верхняя панель ── */}
      <div className="flex items-center gap-3 px-4 py-2 bg-gray-800 dark:bg-slate-700 border-b border-gray-700 flex-shrink-0 min-h-[48px]">
        {/* Кнопка назад */}
        <button
          onClick={() => navigate('/lessons')}
          className="text-gray-400 dark:text-slate-500 hover:text-white transition-colors p-1 rounded"
          title="Вернуться к урокам"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>

        {/* Название */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white truncate">{session.lesson_title}</div>
          <div className="text-xs text-gray-400 dark:text-slate-500 truncate">
            {session.school_class_name} · {isPresenter ? 'Ведёте вы' : session.teacher_name}
          </div>
        </div>

        {/* Индикатор слайда */}
        {slides.length > 0 && (
          <div className="text-sm text-gray-400 dark:text-slate-500 font-mono flex-shrink-0">
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
          className="text-gray-400 dark:text-slate-500 hover:text-white transition-colors p-1.5 rounded hover:bg-gray-700"
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
      <div ref={slideAreaRef} className="flex-1 relative overflow-hidden">
        {currentSlide?.slide_type === 'textbook' ? (
          <TextbookSlideView
            slide={currentSlide}
            isPresenter={isPresenter}
            sessionId={sessionId}
          />
        ) : currentSlide ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div style={{
              width: CANVAS_W * scale,
              height: CANVAS_H * scale,
              flexShrink: 0,
              overflow: 'hidden',
            }}>
              <SlideView
                slide={currentSlide}
                scale={scale}
                isPresenter={isPresenter}
                user={user}
                sessionId={sessionId}
                formResults={formResults}
                onFormSubmit={handleFormSubmit}
                formSubmitted={formSubmitted}
                formAnswers={formAnswers}
                onVideoControl={handleVideoControl}
                videoControl={videoControl}
                quizStarted={quizStarted}
                quizAnswered={quizAnswered}
                quizAnsweredCount={quizAnsweredCount}
                quizLeaderboard={quizLeaderboard}
                quizCurrentQuestion={quizCurrentQuestion}
                onQuizStart={handleQuizStart}
                onQuizShowResults={handleQuizShowResults}
                onQuizAnswer={handleQuizAnswer}
                onQuizNextQuestion={handleQuizNextQuestion}
              />
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500 dark:text-slate-400 text-lg">Нет слайдов</div>
        )}
      </div>

      {/* ── Нижняя панель навигации (только учитель) ── */}
      {isPresenter && slides.length > 0 && (
        <div className="flex items-center justify-center gap-4 px-4 py-3 bg-gray-800 dark:bg-slate-700 border-t border-gray-700 flex-shrink-0">
          <button
            onClick={goPrev}
            disabled={currentIdx <= 0}
            className="p-2 rounded-lg text-gray-300 dark:text-slate-600 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
                    ? 'w-3 h-3 bg-purple-400'
                    : 'w-2 h-2 bg-gray-600 hover:bg-gray-400'
                }`}
                title={`Слайд ${i + 1}`}
              />
            ))}
            {slides.length > 20 && (
              <span className="text-xs text-gray-500 dark:text-slate-400 ml-1">+{slides.length - 20}</span>
            )}
          </div>

          <button
            onClick={goNext}
            disabled={currentIdx >= slides.length - 1}
            className="p-2 rounded-lg text-gray-300 dark:text-slate-600 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Следующий слайд (→)"
          >
            <IconChevronRight />
          </button>
        </div>
      )}

      {/* Подсказка для студентов */}
      {!isPresenter && (
        <div className="text-center py-2 text-xs text-gray-600 dark:text-slate-400 flex-shrink-0">
          Слайды переключает учитель
        </div>
      )}
    </div>
  );
}
