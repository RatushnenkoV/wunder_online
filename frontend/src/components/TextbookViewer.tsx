import { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface Props {
  title: string;
  fileUrl: string;
  onClose: () => void;
}

export default function TextbookViewer({ title, fileUrl, onClose }: Props) {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageWidth, setPageWidth] = useState(700);

  // Подстраиваем ширину страницы под контейнер
  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth - 32; // padding
        setPageWidth(Math.min(Math.max(w, 300), 1200));
      }
    };
    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const goToPage = useCallback((n: number) => {
    if (numPages === 0) return;
    const page = Math.max(1, Math.min(numPages, n));
    setPageNumber(page);
    setPageInput(String(page));
    // Прокрутить наверх при переходе на страницу
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [numPages]);

  // Клавиатурная навигация
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goToPage(pageNumber + 1);
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goToPage(pageNumber - 1);
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goToPage, pageNumber, onClose]);

  const handleInputBlur = () => goToPage(Number(pageInput));
  const handleInputKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') goToPage(Number(pageInput));
  };

  const zoomIn = () => setScale(s => Math.min(3, parseFloat((s + 0.25).toFixed(2))));
  const zoomOut = () => setScale(s => Math.max(0.5, parseFloat((s - 0.25).toFixed(2))));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-950">

      {/* ── Тулбар ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-900 border-b border-gray-800 flex-shrink-0 select-none">

        {/* Название */}
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-white truncate block">{title}</span>
        </div>

        {/* Навигация по страницам */}
        {numPages > 0 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => goToPage(pageNumber - 1)}
              disabled={pageNumber <= 1}
              className="w-7 h-7 flex items-center justify-center rounded text-gray-300 hover:bg-gray-700 disabled:opacity-30 transition-colors"
              title="Предыдущая страница (←)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="flex items-center gap-1 text-sm text-gray-300">
              <input
                type="number"
                min={1}
                max={numPages}
                value={pageInput}
                onChange={e => setPageInput(e.target.value)}
                onBlur={handleInputBlur}
                onKeyDown={handleInputKey}
                className="w-12 text-center bg-gray-700 text-white rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-gray-500">/ {numPages}</span>
            </div>

            <button
              onClick={() => goToPage(pageNumber + 1)}
              disabled={pageNumber >= numPages}
              className="w-7 h-7 flex items-center justify-center rounded text-gray-300 hover:bg-gray-700 disabled:opacity-30 transition-colors"
              title="Следующая страница (→)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}

        {/* Разделитель */}
        <div className="w-px h-5 bg-gray-700" />

        {/* Масштаб */}
        <div className="flex items-center gap-1">
          <button
            onClick={zoomOut}
            disabled={scale <= 0.5}
            className="w-7 h-7 flex items-center justify-center rounded text-gray-300 hover:bg-gray-700 disabled:opacity-30 transition-colors text-lg font-light"
            title="Уменьшить"
          >−</button>
          <span className="text-xs text-gray-400 w-10 text-center">{Math.round(scale * 100)}%</span>
          <button
            onClick={zoomIn}
            disabled={scale >= 3}
            className="w-7 h-7 flex items-center justify-center rounded text-gray-300 hover:bg-gray-700 disabled:opacity-30 transition-colors text-lg font-light"
            title="Увеличить"
          >+</button>
        </div>

        {/* Разделитель */}
        <div className="w-px h-5 bg-gray-700" />

        {/* Кнопка скачать */}
        <a
          href={fileUrl}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="w-7 h-7 flex items-center justify-center rounded text-gray-300 hover:bg-gray-700 transition-colors"
          title="Скачать"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
          </svg>
        </a>

        {/* Закрыть */}
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded text-gray-300 hover:bg-gray-700 transition-colors"
          title="Закрыть (Esc)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* ── Область документа ────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex justify-center py-4 px-4"
      >
        <Document
          file={fileUrl}
          onLoadSuccess={({ numPages }) => {
            setNumPages(numPages);
            setLoading(false);
          }}
          onLoadError={() => setLoading(false)}
          loading={
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
              <svg className="w-8 h-8 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span className="text-sm">Загрузка документа...</span>
            </div>
          }
          error={
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-red-400">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <span className="text-sm">Не удалось открыть файл</span>
              <a href={fileUrl} download className="text-blue-400 text-sm hover:underline">Скачать вместо этого</a>
            </div>
          }
        >
          <Page
            pageNumber={pageNumber}
            width={pageWidth * scale}
            renderTextLayer
            renderAnnotationLayer
            className="shadow-2xl"
          />
        </Document>

        {/* Индикатор загрузки поверх если ещё грузится */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950/80">
            <svg className="w-8 h-8 text-blue-400 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
        )}
      </div>

      {/* ── Нижняя навигация (быстрый доступ) ───────────────────────── */}
      {numPages > 0 && (
        <div className="flex items-center justify-center gap-4 px-4 py-2.5 bg-gray-900 border-t border-gray-800 flex-shrink-0 select-none">
          <button
            onClick={() => goToPage(1)}
            disabled={pageNumber <= 1}
            className="text-xs text-gray-400 hover:text-white disabled:opacity-30 transition-colors px-2 py-1 rounded hover:bg-gray-700"
          >
            В начало
          </button>
          <div className="flex items-center gap-1">
            {/* Миниатюрная полоска прогресса */}
            <div className="w-32 h-1 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${(pageNumber / numPages) * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 ml-1">
              {Math.round((pageNumber / numPages) * 100)}%
            </span>
          </div>
          <button
            onClick={() => goToPage(numPages)}
            disabled={pageNumber >= numPages}
            className="text-xs text-gray-400 hover:text-white disabled:opacity-30 transition-colors px-2 py-1 rounded hover:bg-gray-700"
          >
            В конец
          </button>
        </div>
      )}
    </div>
  );
}
