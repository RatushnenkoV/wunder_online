import type { Slide, FormQuestion } from '../../types';

function IconTrash() {
  return <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
}
function IconDrag() {
  return <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-300" fill="currentColor" viewBox="0 0 24 24"><path d="M8 6a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4zm8-16a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4z" /></svg>;
}

export interface SlideThumbProps {
  slide: Slide; index: number; isSelected: boolean; isDragOver: boolean;
  onClick: () => void; onDelete: () => void;
  onDragStart: (e: React.DragEvent) => void; onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void; onDrop: (e: React.DragEvent) => void;
}

const SLIDE_TYPE_ICONS: Partial<Record<Slide['slide_type'], string>> = {
  content: '📄', form: '📋', video: '📹', discussion: '💬', quiz: '🏆', vocab: '📚', textbook: '📖',
};

export default function SlideThumb({ slide, index, isSelected, isDragOver, onClick, onDelete, onDragStart, onDragOver, onDragLeave, onDrop }: SlideThumbProps) {
  const icon = SLIDE_TYPE_ICONS[slide.slide_type] ?? '📄';

  let label: string;
  if (slide.slide_type === 'form') {
    const qs = (slide.content as { questions?: FormQuestion[] }).questions;
    label = qs && qs.length > 0 ? `${qs.length} вопр.` : 'Форма';
  } else if (slide.slide_type === 'quiz') {
    const qs = (slide.content as { questions?: unknown[] }).questions;
    label = qs && qs.length > 0 ? `${qs.length} вопр.` : 'Викторина';
  } else if (slide.slide_type === 'video') {
    label = (slide.content as { url?: string }).url ? 'Видео' : 'Видео';
  } else if (slide.slide_type === 'discussion') {
    label = 'Доска';
  } else if (slide.slide_type === 'vocab') {
    const ws = (slide.content as { words?: unknown[] }).words;
    label = ws && ws.length > 0 ? `${ws.length} сл.` : 'Словарь';
  } else if (slide.slide_type === 'textbook') {
    const c = slide.content as { textbook_id?: number | null; page_from?: number; page_to?: number };
    label = c.textbook_id ? `стр. ${c.page_from}–${c.page_to}` : 'Учебник';
  } else {
    const blocks = slide.content?.blocks ?? [];
    const firstText = blocks.find(b => b.type === 'text');
    label = firstText?.html
      ? firstText.html.replace(/<[^>]+>/g, '').slice(0, 30) || `Слайд ${index + 1}`
      : `Слайд ${index + 1}`;
  }

  return (
    <div
      draggable
      onDragStart={onDragStart} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} onClick={onClick}
      className={`group flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors border-b border-gray-100 ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'} ${isDragOver ? 'border-t-2 border-t-blue-400' : ''}`}
    >
      <span className="cursor-grab flex-shrink-0 opacity-40 group-hover:opacity-70 transition-opacity"><IconDrag /></span>
      <span className="text-sm flex-shrink-0 leading-none">{icon}</span>
      <span className="text-xs text-gray-400 w-4 text-center flex-shrink-0 font-medium">{index + 1}</span>
      <span className={`flex-1 text-xs truncate ${isSelected ? 'text-blue-700 font-medium' : 'text-gray-600'}`}>{label}</span>
      <button onClick={e => { e.stopPropagation(); onDelete(); }} className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all rounded"><IconTrash /></button>
    </div>
  );
}
