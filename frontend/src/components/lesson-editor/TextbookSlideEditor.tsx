import { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import api from '../../api/client';
import type { Slide, TextbookSlideContent, Textbook, TextbookGradeLevel } from '../../types';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export default function TextbookSlideEditor({ slide, lessonId, onSaved }: { slide: Slide; lessonId: number; onSaved: (s: Slide) => void }) {
  const getContent = (): TextbookSlideContent => {
    const c = slide.content as Partial<TextbookSlideContent>;
    return { textbook_id: c.textbook_id ?? null, page_from: c.page_from ?? 1, page_to: c.page_to ?? 1 };
  };

  const [content, setContent]             = useState<TextbookSlideContent>(getContent);
  const [gradeLevels, setGradeLevels]     = useState<TextbookGradeLevel[]>([]);
  const [selectedGL, setSelectedGL]       = useState<TextbookGradeLevel | null>(null);
  const [textbooks, setTextbooks]         = useState<Textbook[]>([]);
  const [loadingBooks, setLoadingBooks]   = useState(false);
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);
  const [activeTb, setActiveTb]           = useState<Textbook | null>(null);  // currently shown in preview
  const [previewPage, setPreviewPage]     = useState(1);
  const [numPages, setNumPages]           = useState(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const [pdfWidth, setPdfWidth] = useState(560);

  // Load grade levels once
  useEffect(() => {
    api.get('/lessons/textbooks/grade-levels/').then(r => {
      const data: TextbookGradeLevel[] = r.data;
      setGradeLevels(data);
      if (data.length === 1) setSelectedGL(data[0]);
    }).catch(() => {});
  }, []);

  // Load textbooks when GL changes
  useEffect(() => {
    if (!selectedGL) return;
    setLoadingBooks(true);
    setSubjectFilter(null);
    api.get(`/lessons/textbooks/?grade_level_id=${selectedGL.id}`)
      .then(r => setTextbooks(r.data))
      .catch(() => {})
      .finally(() => setLoadingBooks(false));
  }, [selectedGL]);

  // Load existing textbook on mount (if slide already has one)
  useEffect(() => {
    const c = getContent();
    setContent(c);
    setPreviewPage(c.page_from || 1);
    if (c.textbook_id) {
      api.get(`/lessons/textbooks/${c.textbook_id}/`).then(r => setActiveTb(r.data)).catch(() => {});
    } else {
      setActiveTb(null);
    }
  }, [slide.id]); // eslint-disable-line

  // Fit PDF width to container
  useEffect(() => {
    const el = pdfContainerRef.current;
    if (!el) return;
    const update = () => setPdfWidth(Math.max(300, el.clientWidth - 40));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const doSave = (c: TextbookSlideContent) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const res = await api.put(`/lessons/lessons/${lessonId}/slides/${slide.id}/`, { content: c });
      onSaved(res.data);
    }, 400);
  };

  const update = (patch: Partial<TextbookSlideContent>) => {
    const next = { ...content, ...patch };
    setContent(next);
    doSave(next);
  };

  const selectTextbook = (tb: Textbook) => {
    setActiveTb(tb);
    setNumPages(0);
    setPreviewPage(1);
    update({ textbook_id: tb.id, page_from: 1, page_to: 1 });
  };

  const setFrom = (v: number) => {
    const from = Math.max(1, v);
    const to   = Math.max(from, content.page_to);
    update({ page_from: from, page_to: to });
    setPreviewPage(from);
  };
  const setTo = (v: number) => {
    const to = Math.max(content.page_from, v);
    update({ page_to: to });
  };

  // Unique subjects in loaded textbooks
  const subjects = Array.from(
    new Set(textbooks.filter(t => t.subject_name).map(t => t.subject_name as string))
  ).sort();
  const visibleBooks = subjectFilter
    ? textbooks.filter(t => t.subject_name === subjectFilter)
    : textbooks;

  return (
    <div className="flex h-full min-h-0">

      {/* ── Левая панель: навигация ─────────────────────────────────── */}
      <div className="w-72 flex-shrink-0 flex flex-col border-r border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 min-h-0">

        {/* Заголовок панели */}
        <div className="h-10 border-b bg-white dark:bg-slate-800 flex items-center gap-1.5 px-3 flex-shrink-0">
          {selectedGL && gradeLevels.length > 1 && (
            <button
              onClick={() => { setSelectedGL(null); }}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400 flex-shrink-0"
              title="Назад"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <span className="text-sm font-medium text-gray-700 dark:text-slate-300 truncate">
            {selectedGL ? selectedGL.name : 'Параллели'}
          </span>
        </div>

        {/* Список параллелей */}
        {!selectedGL && (
          <div className="flex-1 overflow-y-auto p-3">
            {gradeLevels.length === 0 ? (
              <div className="text-center text-gray-400 dark:text-slate-500 text-sm py-8">Нет параллелей</div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {gradeLevels.map(gl => (
                  <button
                    key={gl.id}
                    onClick={() => setSelectedGL(gl)}
                    className="flex flex-col items-center justify-center gap-1 p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition-all"
                  >
                    <span className="text-xl font-bold text-emerald-600">{gl.number}</span>
                    <span className="text-xs text-gray-600 dark:text-slate-400">{gl.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Список учебников */}
        {selectedGL && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Фильтр по предмету */}
            {subjects.length > 1 && (
              <div className="px-3 py-2 flex flex-wrap gap-1 border-b border-gray-100 dark:border-slate-700 flex-shrink-0">
                <button
                  onClick={() => setSubjectFilter(null)}
                  className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${!subjectFilter ? 'bg-purple-600 text-white border-purple-600' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 border-gray-200 dark:border-slate-700 hover:border-purple-300'}`}
                >Все</button>
                {subjects.map(s => (
                  <button
                    key={s}
                    onClick={() => setSubjectFilter(s)}
                    className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${subjectFilter === s ? 'bg-purple-600 text-white border-purple-600' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 border-gray-200 dark:border-slate-700 hover:border-purple-300'}`}
                  >{s}</button>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {loadingBooks ? (
                <div className="text-center text-gray-400 dark:text-slate-500 text-sm py-8">Загрузка...</div>
              ) : visibleBooks.length === 0 ? (
                <div className="text-center text-gray-400 dark:text-slate-500 text-sm py-8">Нет учебников</div>
              ) : visibleBooks.map(tb => (
                <button
                  key={tb.id}
                  onClick={() => selectTextbook(tb)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border-2 transition-all ${
                    activeTb?.id === tb.id
                      ? 'border-purple-400 bg-purple-50'
                      : 'border-transparent bg-white dark:bg-slate-800 hover:border-gray-200'
                  }`}
                >
                  <div className="text-sm font-medium text-gray-800 dark:text-slate-200 leading-tight">{tb.title}</div>
                  {tb.subject_name && (
                    <div className="text-xs text-purple-600 mt-0.5">{tb.subject_name}</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Правая панель: превью PDF ────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        {!activeTb ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-900">
            <div className="text-center">
              <div className="text-5xl mb-3">📖</div>
              <p className="text-sm">Выберите учебник из списка слева</p>
            </div>
          </div>
        ) : (
          <>
            {/* Тулбар: название + диапазон страниц */}
            <div className="h-11 border-b bg-white dark:bg-slate-800 flex items-center gap-3 px-4 flex-shrink-0">
              <span className="text-sm font-medium text-gray-700 dark:text-slate-300 truncate flex-1 min-w-0">{activeTb.title}</span>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-xs text-gray-500 dark:text-slate-400">Стр.</span>
                <input
                  type="number" min={1} max={numPages || undefined} value={content.page_from}
                  onChange={e => setFrom(Number(e.target.value))}
                  className="w-14 text-center text-sm border border-gray-200 dark:border-slate-700 rounded-md px-1.5 py-1 focus:outline-none focus:border-purple-400"
                  title="С страницы"
                />
                <span className="text-xs text-gray-400 dark:text-slate-500">—</span>
                <input
                  type="number" min={content.page_from} max={numPages || undefined} value={content.page_to}
                  onChange={e => setTo(Number(e.target.value))}
                  className="w-14 text-center text-sm border border-gray-200 dark:border-slate-700 rounded-md px-1.5 py-1 focus:outline-none focus:border-purple-400"
                  title="По страницу"
                />
                {numPages > 0 && (
                  <span className="text-xs text-gray-400 dark:text-slate-500">из {numPages}</span>
                )}
              </div>
            </div>

            {/* PDF + навигация по диапазону */}
            <div ref={pdfContainerRef} className="flex-1 overflow-auto bg-gray-700 dark:bg-slate-600 flex flex-col items-center py-4 gap-3">
              {/* Навигация внутри диапазона */}
              <div className="flex items-center gap-2 bg-gray-800 dark:bg-slate-700/90 rounded-lg px-3 py-1.5 flex-shrink-0 select-none">
                <button
                  onClick={() => setPreviewPage(p => Math.max(content.page_from, p - 1))}
                  disabled={previewPage <= content.page_from}
                  className="w-6 h-6 flex items-center justify-center rounded text-gray-300 dark:text-slate-600 hover:bg-gray-600 disabled:opacity-30 transition-colors text-lg leading-none"
                >‹</button>
                <span className="text-xs text-gray-300 dark:text-slate-600 min-w-[110px] text-center">
                  стр. {previewPage}
                  {content.page_from !== content.page_to && ` (диапазон: ${content.page_from}–${content.page_to})`}
                </span>
                <button
                  onClick={() => setPreviewPage(p => Math.min(content.page_to, p + 1))}
                  disabled={previewPage >= content.page_to}
                  className="w-6 h-6 flex items-center justify-center rounded text-gray-300 dark:text-slate-600 hover:bg-gray-600 disabled:opacity-30 transition-colors text-lg leading-none"
                >›</button>
              </div>

              {activeTb.file_url ? (
                <Document
                  file={activeTb.file_url}
                  onLoadSuccess={({ numPages: n }) => {
                    setNumPages(n);
                    // Clamp page_to if PDF has fewer pages
                    if (content.page_to > n) update({ page_to: n });
                  }}
                  loading={<div className="text-gray-400 dark:text-slate-500 text-sm py-16">Загрузка PDF…</div>}
                  error={<div className="text-red-400 text-sm py-16">Не удалось загрузить PDF</div>}
                >
                  <Page
                    pageNumber={previewPage}
                    width={pdfWidth}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    className="shadow-2xl"
                  />
                </Document>
              ) : (
                <div className="text-gray-400 dark:text-slate-500 text-sm py-16">Файл недоступен</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
