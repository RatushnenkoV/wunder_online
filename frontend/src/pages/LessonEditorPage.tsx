import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import StartSessionDialog from '../components/StartSessionDialog';
import SlideCanvas from '../components/lesson-editor/SlideCanvas';
import { emptyContent } from '../components/lesson-editor/SlideCanvas';
import VideoEditor from '../components/lesson-editor/VideoEditor';
import FormEditor from '../components/lesson-editor/FormEditor';
import QuizEditor from '../components/lesson-editor/QuizEditor';
import VocabEditor from '../components/lesson-editor/VocabEditor';
import TextbookSlideEditor from '../components/lesson-editor/TextbookSlideEditor';
import DiscussionBoard from '../components/lesson-editor/DiscussionBoard';
import SlideThumb from '../components/lesson-editor/SlideThumb';
import SlideTypePicker from '../components/lesson-editor/SlideTypePicker';
import type { Lesson, Slide, SlideType } from '../types';

type SaveStatus = 'saved' | 'saving' | 'unsaved';





function IconArrowLeft() {
  return <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>;
}
function IconPlus() {
  return <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>;
}
function IconCheck() {
  return <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>;
}

// ─── Главный компонент ────────────────────────────────────────────────────────

export default function LessonEditorPage() {
  const { id } = useParams<{ id: string }>();
  const lessonId = Number(id);
  const { user } = useAuth();

  const [lesson,      setLesson]      = useState<Lesson | null>(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [slides,      setSlides]      = useState<Slide[]>([]);
  const [selectedId,  setSelectedId]  = useState<number | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [saveStatus,  setSaveStatus]  = useState<SaveStatus>('saved');

  const [showTypePicker,  setShowTypePicker]  = useState(false);
  const [showStartDialog, setShowStartDialog] = useState(false);

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

  const addSlide = async (type: SlideType = 'content') => {
    const initialContent = type === 'content' ? emptyContent() : {};
    const res = await api.post(`/lessons/lessons/${lessonId}/slides/`, { slide_type: type, content: initialContent });
    const newSlide: Slide = res.data;
    setSlides(prev => [...prev, newSlide]);
    setSelectedId(newSlide.id);
  };

  const openTypePicker = () => setShowTypePicker(true);

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
        {(user?.is_teacher || user?.is_admin) && (
          <button
            onClick={() => setShowStartDialog(true)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded-lg transition-colors"
            title="Начать урок в реальном времени"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
            Начать урок
          </button>
        )}
      </header>

      {showStartDialog && lesson && (
        <StartSessionDialog
          lessonId={lessonId}
          lessonTitle={lesson.title}
          onClose={() => setShowStartDialog(false)}
        />
      )}

      <div className="flex flex-1 min-h-0">
        <aside className="w-48 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Слайды</span>
            <button onClick={openTypePicker} title="Добавить слайд" className="p-1 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><IconPlus /></button>
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
            <button onClick={openTypePicker} className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
              <IconPlus />Добавить слайд
            </button>
          </div>
        </aside>

        <main className="flex-1 flex flex-col min-w-0 min-h-0">
          {selectedSlide ? (
            <>
              {(selectedSlide.slide_type === 'content' || !['form', 'quiz', 'video', 'discussion', 'vocab', 'textbook'].includes(selectedSlide.slide_type)) && (
                <SlideCanvas key={selectedSlide.id} slide={selectedSlide} lessonId={lessonId} coverColor={lesson.cover_color} onSaved={handleSlideUpdated} />
              )}
              {selectedSlide.slide_type === 'form' && (
                <FormEditor key={selectedSlide.id} slide={selectedSlide} lessonId={lessonId} onSaved={handleSlideUpdated} />
              )}
              {selectedSlide.slide_type === 'quiz' && (
                <QuizEditor key={selectedSlide.id} slide={selectedSlide} lessonId={lessonId} onSaved={handleSlideUpdated} />
              )}
              {selectedSlide.slide_type === 'video' && (
                <VideoEditor key={selectedSlide.id} slide={selectedSlide} lessonId={lessonId} onSaved={handleSlideUpdated} />
              )}
              {selectedSlide.slide_type === 'discussion' && (
                <DiscussionBoard key={selectedSlide.id} slide={selectedSlide} />
              )}
              {selectedSlide.slide_type === 'vocab' && (
                <VocabEditor key={selectedSlide.id} slide={selectedSlide} lessonId={lessonId} onSaved={handleSlideUpdated} />
              )}
              {selectedSlide.slide_type === 'textbook' && (
                <TextbookSlideEditor key={selectedSlide.id} slide={selectedSlide} lessonId={lessonId} onSaved={handleSlideUpdated} />
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400 bg-gray-50">
              <span className="text-5xl">📄</span>
              <p className="text-sm">Добавьте первый слайд</p>
              <button onClick={openTypePicker} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">Добавить слайд</button>
            </div>
          )}
        </main>
      </div>

      {showTypePicker && (
        <SlideTypePicker
          onSelect={type => { setShowTypePicker(false); addSlide(type); }}
          onClose={() => setShowTypePicker(false)}
        />
      )}
    </div>
  );
}
