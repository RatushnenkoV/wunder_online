import { memo, useState, useRef } from 'react';
import api from '../../api/client';
import type { SlideBlock } from '../../types';

function IconImage() {
  return <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
}

const ImageBlock = memo(function ImageBlock({ block, lessonId, onSave }: { block: SlideBlock; lessonId: number; onSave: (src: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Отслеживаем начало mousedown, чтобы не открывать диалог при перетаскивании блока
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);

  const upload = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post(`/lessons/lessons/${lessonId}/upload/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      onSave(res.data.url);
    } finally { setUploading(false); }
  };

  if (block.src) {
    return (
      <div className="w-full h-full relative group" onClick={e => e.stopPropagation()}>
        <img src={block.src} alt={block.alt ?? ''} className="w-full h-full object-contain" draggable={false} onDragStart={e => e.preventDefault()} />
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
          className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 text-xs bg-black/50 text-white rounded"
        >Заменить</button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); }} />
      </div>
    );
  }

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded bg-gray-50 dark:bg-slate-900 text-gray-400 dark:text-slate-500 cursor-pointer hover:border-purple-400 hover:text-purple-400 transition-colors"
      onMouseDown={e => { mouseDownPosRef.current = { x: e.clientX, y: e.clientY }; }}
      onClick={e => {
        e.stopPropagation();
        // Не открываем диалог если произошло перетаскивание (mousedown → mousemove > 5px)
        if (mouseDownPosRef.current) {
          const dx = e.clientX - mouseDownPosRef.current.x;
          const dy = e.clientY - mouseDownPosRef.current.y;
          if (Math.abs(dx) > 5 || Math.abs(dy) > 5) return;
        }
        fileInputRef.current?.click();
      }}
    >
      {uploading ? <span className="text-sm">Загрузка...</span> : <><IconImage /><span className="text-xs">Нажмите для загрузки</span></>}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); }} />
    </div>
  );
});

export default ImageBlock;
