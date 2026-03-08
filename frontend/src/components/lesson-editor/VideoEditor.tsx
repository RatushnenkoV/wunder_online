import { useState, useEffect, useRef } from 'react';
import api from '../../api/client';
import type { Slide, VideoContent } from '../../types';

function parseVideoUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  const url = rawUrl.trim();
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const vkMatch = url.match(/vk\.com\/video(-?\d+)_(\d+)/);
  if (vkMatch) return `https://vk.com/video_ext.php?oid=${vkMatch[1]}&id=${vkMatch[2]}&hd=2`;
  const rutubeMatch = url.match(/rutube\.ru\/video\/([a-zA-Z0-9]+)/);
  if (rutubeMatch) return `https://rutube.ru/play/embed/${rutubeMatch[1]}`;
  const yandexMatch = url.match(/filmId=([a-zA-Z0-9]+)/);
  if (yandexMatch) return `https://frontend.vh.yandex.ru/player/${yandexMatch[1]}`;
  return url;
}

export default function VideoEditor({ slide, lessonId, onSaved }: { slide: Slide; lessonId: number; onSaved: (s: Slide) => void }) {
  const getContent = (): VideoContent => {
    const c = slide.content as Partial<VideoContent>;
    return { url: c?.url ?? '', embed_url: c?.embed_url ?? '', caption: c?.caption ?? '' };
  };

  const [url,      setUrl]      = useState(getContent().url);
  const [caption,  setCaption]  = useState(getContent().caption);
  const [embedUrl, setEmbedUrl] = useState(getContent().embed_url);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const c = getContent();
    setUrl(c.url); setCaption(c.caption); setEmbedUrl(c.embed_url);
  }, [slide.id]);

  const doSave = (u: string, eu: string, cap: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await api.put(`/lessons/lessons/${lessonId}/slides/${slide.id}/`, { content: { url: u, embed_url: eu, caption: cap } });
        onSaved(res.data);
      } catch { /* ignore */ }
    }, 400);
  };

  const handleUrlChange = (val: string) => {
    const parsed = parseVideoUrl(val);
    setUrl(val); setEmbedUrl(parsed);
    doSave(val, parsed, caption);
  };

  const handleCaptionChange = (val: string) => {
    setCaption(val);
    doSave(url, embedUrl, val);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="h-10 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center px-4">
        <span className="text-sm text-gray-500 dark:text-slate-400">📹 Редактор видео</span>
      </div>
      <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-slate-900 p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">Ссылка на видео</label>
            <input
              type="url" value={url}
              onChange={e => handleUrlChange(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:border-purple-400 bg-white dark:bg-slate-800"
            />
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden shadow-sm" style={{ aspectRatio: '16/9' }}>
            {embedUrl ? (
              <iframe
                src={embedUrl} className="w-full h-full"
                allowFullScreen allow="autoplay; encrypted-media; fullscreen"
                title="Video preview"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 dark:text-slate-600">
                <span className="text-4xl mb-2">📹</span>
                <span className="text-sm">Введите ссылку на видео</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">Подпись (опционально)</label>
            <input
              type="text" value={caption}
              onChange={e => handleCaptionChange(e.target.value)}
              placeholder="Описание видео..."
              className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:border-purple-400 bg-white dark:bg-slate-800"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
