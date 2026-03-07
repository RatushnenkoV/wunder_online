import { useState, useEffect, useRef } from 'react';
import type { Slide } from '../../types';

const CANVAS_W = 960;
const CANVAS_H = 540;

export default function VideoSlideView({
  slide, scale, isPresenter, onVideoControl, externalControl,
}: {
  slide: Slide;
  scale: number;
  isPresenter?: boolean;
  onVideoControl?: (action: string) => void;
  externalControl?: { action: string; ts: number } | null;
}) {
  const content = slide.content as Record<string, string> | null;
  const rawUrl  = content?.embed_url || content?.url || '';
  const caption = content?.caption ?? '';
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [teacherPlaying, setTeacherPlaying] = useState(false);

  // Добавляем enablejsapi=1 для YouTube чтобы работал postMessage-контроль
  const embedUrl = (() => {
    if (!rawUrl) return '';
    try {
      const u = new URL(rawUrl);
      if (u.hostname.includes('youtube.com') && u.pathname.includes('/embed/')) {
        u.searchParams.set('enablejsapi', '1');
      }
      return u.toString();
    } catch { return rawUrl; }
  })();

  const isYouTube = embedUrl.includes('youtube.com/embed');

  const sendYT = (cmd: string) => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func: cmd, args: '' }), '*',
    );
  };

  // Студент реагирует на внешний контроль от учителя
  useEffect(() => {
    if (!externalControl || isPresenter) return;
    if (externalControl.action === 'play')  sendYT('playVideo');
    if (externalControl.action === 'pause') sendYT('pauseVideo');
  }, [externalControl?.ts]); // eslint-disable-line

  const handleTeacherToggle = () => {
    if (teacherPlaying) {
      sendYT('pauseVideo');
      setTeacherPlaying(false);
      onVideoControl?.('pause');
    } else {
      sendYT('playVideo');
      setTeacherPlaying(true);
      onVideoControl?.('play');
    }
  };

  if (!embedUrl) {
    return (
      <div style={{ width: CANVAS_W * scale, height: CANVAS_H * scale, background: '#111', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, flexShrink: 0 }}>
        <span style={{ fontSize: 48 }}>📹</span>
        <span style={{ color: '#6b7280', fontSize: 16 }}>Ссылка на видео не указана</span>
      </div>
    );
  }

  return (
    <div style={{ width: CANVAS_W * scale, height: CANVAS_H * scale, background: '#000', display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'relative' }}>
      <iframe
        ref={iframeRef}
        src={embedUrl}
        style={{ flex: 1, border: 'none', width: '100%', height: caption ? '88%' : '100%' }}
        allow="autoplay; encrypted-media; fullscreen"
        allowFullScreen
      />
      {caption && (
        <div style={{ padding: '6px 12px', background: '#000', color: '#d1d5db', fontSize: Math.max(11, 13 * scale), textAlign: 'center', flexShrink: 0 }}>
          {caption}
        </div>
      )}
      {/* Кнопка синхронизации видео у учеников (только для YouTube и учителя) */}
      {isPresenter && isYouTube && (
        <button
          onClick={handleTeacherToggle}
          style={{
            position: 'absolute', bottom: caption ? 52 : 16, right: 16,
            padding: `${Math.max(6, 8 * scale)}px ${Math.max(12, 16 * scale)}px`,
            background: 'rgba(0,0,0,0.72)', color: 'white',
            border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8,
            fontSize: Math.max(12, 13 * scale), cursor: 'pointer',
            backdropFilter: 'blur(4px)',
          }}
        >
          {teacherPlaying ? '⏸ Пауза у учеников' : '▶ Запустить у учеников'}
        </button>
      )}
    </div>
  );
}
