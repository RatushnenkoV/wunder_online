import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';
import type {
  LessonSession, Slide, SlideBlock,
  FormQuestion, FormAnswerValue, FormResults,
  DiscussionSticker, DiscussionArrow, User,
} from '../types';

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

// ─── Константы для обсуждения ─────────────────────────────────────────────────

const STICKER_W = 180;
const STICKER_H = 130;
const STICKER_COLORS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#fed7aa', '#e9d5ff'];

function stickerEdgePoint(s: DiscussionSticker, tx: number, ty: number): [number, number] {
  const cx = s.x + STICKER_W / 2, cy = s.y + STICKER_H / 2;
  const dx = tx - cx, dy = ty - cy;
  if (dx === 0 && dy === 0) return [cx, cy];
  const hw = STICKER_W / 2, hh = STICKER_H / 2;
  const sx = dx === 0 ? Infinity : Math.abs(hw / dx);
  const sy = dy === 0 ? Infinity : Math.abs(hh / dy);
  const t = Math.min(sx, sy);
  return [cx + dx * t, cy + dy * t];
}

// ─── VideoSlideView ───────────────────────────────────────────────────────────

function VideoSlideView({
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

// ─── FormAnswerView (студент) ─────────────────────────────────────────────────

function FormAnswerView({
  slide, scale, onSubmit, submitted, savedAnswers,
}: {
  slide: Slide;
  scale: number;
  onSubmit: (answers: FormAnswerValue[]) => void;
  submitted: boolean;
  savedAnswers: FormAnswerValue[];
}) {
  const questions: FormQuestion[] = (slide.content as { questions?: FormQuestion[] })?.questions ?? [];

  const [answers, setAnswers] = useState<Record<string, FormAnswerValue['value']>>(() => {
    const m: Record<string, FormAnswerValue['value']> = {};
    for (const a of savedAnswers) m[a.question_id] = a.value;
    return m;
  });

  const setAnswer = (qid: string, val: FormAnswerValue['value']) =>
    setAnswers(prev => ({ ...prev, [qid]: val }));

  const handleSubmit = () => {
    const list: FormAnswerValue[] = questions.map(q => ({
      question_id: q.id,
      value: answers[q.id] ?? null,
    }));
    onSubmit(list);
  };

  const fs = Math.max(11, 14 * scale);
  const pad = Math.max(10, 16 * scale);

  return (
    <div style={{ width: CANVAS_W * scale, height: CANVAS_H * scale, background: 'white', overflowY: 'auto', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: `${pad}px` }}>
        {questions.length === 0 && (
          <div style={{ textAlign: 'center', color: '#9ca3af', padding: 24 }}>Вопросы не добавлены</div>
        )}
        {questions.map((q, qi) => (
          <div key={q.id} style={{ marginBottom: pad, padding: pad, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
            <div style={{ fontWeight: 600, fontSize: fs, color: '#111827', marginBottom: 10 }}>
              {qi + 1}. {q.text || <span style={{ color: '#9ca3af' }}>Без текста</span>}
              {q.required && <span style={{ color: '#ef4444', marginLeft: 4 }}>*</span>}
            </div>

            {(q.type === 'single' || q.type === 'multiple') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(q.options ?? []).map((opt, oi) => {
                  const checked = q.type === 'single'
                    ? answers[q.id] === oi
                    : Array.isArray(answers[q.id]) && (answers[q.id] as number[]).includes(oi);
                  return (
                    <label key={oi} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: submitted ? 'default' : 'pointer', fontSize: fs }}>
                      <input
                        type={q.type === 'single' ? 'radio' : 'checkbox'}
                        disabled={submitted}
                        checked={!!checked}
                        onChange={() => {
                          if (q.type === 'single') {
                            setAnswer(q.id, oi);
                          } else {
                            const prev = Array.isArray(answers[q.id]) ? (answers[q.id] as number[]) : [];
                            const next = prev.includes(oi) ? prev.filter(x => x !== oi) : [...prev, oi];
                            setAnswer(q.id, next);
                          }
                        }}
                        style={{ width: 16, height: 16, flexShrink: 0 }}
                      />
                      <span style={{ color: '#374151' }}>{opt}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {q.type === 'text' && (
              <textarea
                value={(answers[q.id] as string) ?? ''}
                onChange={e => setAnswer(q.id, e.target.value)}
                disabled={submitted}
                placeholder="Введите ответ..."
                rows={Math.max(2, Math.round(2.5 * scale))}
                style={{ width: '100%', resize: 'vertical', borderRadius: 6, border: '1px solid #d1d5db', padding: '6px 8px', fontSize: fs, color: '#374151', outline: 'none', background: submitted ? '#f3f4f6' : 'white', boxSizing: 'border-box' }}
              />
            )}

            {q.type === 'scale' && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {Array.from({ length: (q.scale_max ?? 5) - (q.scale_min ?? 1) + 1 }, (_, i) => (q.scale_min ?? 1) + i).map(v => (
                  <button
                    key={v}
                    disabled={submitted}
                    onClick={() => setAnswer(q.id, v)}
                    style={{
                      width: Math.max(32, 36 * scale), height: Math.max(32, 36 * scale),
                      borderRadius: 8, border: answers[q.id] === v ? '2px solid #3b82f6' : '1px solid #d1d5db',
                      background: answers[q.id] === v ? '#eff6ff' : 'white',
                      color: answers[q.id] === v ? '#2563eb' : '#374151',
                      fontWeight: answers[q.id] === v ? 700 : 400,
                      fontSize: fs, cursor: submitted ? 'default' : 'pointer',
                    }}
                  >{v}</button>
                ))}
                {q.scale_min_label && <span style={{ fontSize: Math.max(10, 12 * scale), color: '#6b7280', alignSelf: 'center' }}>{q.scale_min_label}</span>}
                {q.scale_max_label && <span style={{ fontSize: Math.max(10, 12 * scale), color: '#6b7280', alignSelf: 'center', marginLeft: 'auto' }}>{q.scale_max_label}</span>}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Кнопка отправки */}
      <div style={{ padding: `${Math.max(8, 10 * scale)}px ${pad}px`, borderTop: '1px solid #e5e7eb', background: 'white', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
        {submitted ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#16a34a', fontSize: fs }}>
            <span style={{ fontSize: 20 }}>✓</span>
            <span style={{ fontWeight: 600 }}>Ответы отправлены</span>
            <button
              onClick={() => onSubmit(questions.map(q => ({ question_id: q.id, value: answers[q.id] ?? null })))}
              style={{ marginLeft: 8, fontSize: Math.max(10, 12 * scale), color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >Изменить</button>
          </div>
        ) : (
          <button
            onClick={handleSubmit}
            style={{ padding: `${Math.max(6, 8 * scale)}px ${Math.max(16, 20 * scale)}px`, background: '#3b82f6', color: 'white', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: fs, cursor: 'pointer' }}
          >Отправить ответы</button>
        )}
      </div>
    </div>
  );
}

// ─── FormResultsView (учитель) ────────────────────────────────────────────────

function FormResultsView({ slide, scale, results }: { slide: Slide; scale: number; results: FormResults | null }) {
  const [tab, setTab] = useState<'summary' | 'detail'>('summary');
  const questions: FormQuestion[] = (slide.content as { questions?: FormQuestion[] })?.questions ?? [];
  const fs = Math.max(11, 13 * scale);
  const pad = Math.max(10, 14 * scale);

  const tabBtn = (t: 'summary' | 'detail', label: string) => (
    <button
      onClick={() => setTab(t)}
      style={{
        padding: `${Math.max(4, 6 * scale)}px ${Math.max(12, 16 * scale)}px`,
        background: tab === t ? '#3b82f6' : '#f3f4f6',
        color: tab === t ? 'white' : '#374151',
        border: 'none', borderRadius: 6, fontWeight: tab === t ? 600 : 400,
        fontSize: fs, cursor: 'pointer',
      }}
    >{label}</button>
  );

  return (
    <div style={{ width: CANVAS_W * scale, height: CANVAS_H * scale, background: 'white', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
      {/* Шапка */}
      <div style={{ padding: `${Math.max(6, 8 * scale)}px ${pad}px`, borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, background: '#f9fafb' }}>
        {tabBtn('summary', 'Общий план')}
        {tabBtn('detail', 'Детально')}
        <div style={{ marginLeft: 'auto', fontSize: fs, color: '#6b7280' }}>
          {results ? `Ответили: ${results.summary.answered_count}` : 'Ожидание ответов...'}
        </div>
      </div>

      {/* Тело */}
      <div style={{ flex: 1, overflowY: 'auto', padding: pad }}>
        {!results ? (
          <div style={{ textAlign: 'center', color: '#9ca3af', paddingTop: 40, fontSize: fs }}>Нет ответов</div>
        ) : tab === 'summary' ? (
          // ── SUMMARY ──────────────────────────────────────────────────────────
          <div style={{ display: 'flex', flexDirection: 'column', gap: Math.max(8, 10 * scale) }}>
            {results.summary.per_question.map((stat, qi) => {
              return (
                <div key={stat.question_id} style={{ padding: Math.max(8, 10 * scale), background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                  <div style={{ fontWeight: 600, fontSize: fs, color: '#111827', marginBottom: 6 }}>
                    {qi + 1}. {stat.text || '—'}
                    <span style={{ fontWeight: 400, color: '#6b7280', marginLeft: 8 }}>({stat.answer_count} отв.)</span>
                    {stat.has_correct && stat.correct_count !== undefined && (
                      <span style={{ marginLeft: 8, color: '#16a34a', fontWeight: 600 }}>✓ {stat.correct_count}</span>
                    )}
                  </div>

                  {(stat.type === 'single' || stat.type === 'multiple') && stat.options && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {stat.options.map((opt, oi) => {
                        const cnt = stat.option_counts?.[oi] ?? 0;
                        const pct = stat.answer_count ? Math.round(cnt / stat.answer_count * 100) : 0;
                        return (
                          <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: Math.max(12, 14 * scale), fontSize: Math.max(9, 11 * scale), color: '#6b7280', fontWeight: 400 }}>
                              {String.fromCharCode(65 + oi)}
                            </span>
                            <span style={{ fontSize: Math.max(10, 12 * scale), color: '#374151', minWidth: 80, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt}</span>
                            <div style={{ flex: 1, height: Math.max(8, 10 * scale), background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: '#93c5fd', transition: 'width 0.3s' }} />
                            </div>
                            <span style={{ fontSize: Math.max(9, 11 * scale), color: '#6b7280', width: 30, textAlign: 'right' }}>{cnt}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {stat.type === 'text' && (
                    <div style={{ fontSize: Math.max(10, 12 * scale), color: '#6b7280' }}>
                      {stat.answer_count > 0 ? `Ответили: ${stat.answer_count}` : 'Нет ответов'}
                    </div>
                  )}

                  {stat.type === 'scale' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {stat.avg !== null && stat.avg !== undefined && (
                        <span style={{ fontWeight: 700, fontSize: Math.max(12, 16 * scale), color: '#1d4ed8' }}>∅ {stat.avg}</span>
                      )}
                      {stat.value_counts && Object.entries(stat.value_counts).sort(([a], [b]) => +a - +b).map(([v, cnt]) => (
                        <span key={v} style={{ fontSize: Math.max(10, 12 * scale), background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: 6 }}>
                          {v}: {cnt}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          // ── DETAIL ───────────────────────────────────────────────────────────
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: fs }}>
              <thead>
                <tr style={{ background: '#f3f4f6' }}>
                  <th style={{ padding: `${Math.max(4, 6 * scale)}px ${Math.max(6, 8 * scale)}px`, textAlign: 'left', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', color: '#374151' }}>Ученик</th>
                  {questions.map((q, qi) => (
                    <th key={q.id} style={{ padding: `${Math.max(4, 6 * scale)}px ${Math.max(6, 8 * scale)}px`, textAlign: 'center', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', color: '#374151', maxWidth: 80 }} title={q.text}>В{qi + 1}</th>
                  ))}
                  <th style={{ padding: `${Math.max(4, 6 * scale)}px ${Math.max(6, 8 * scale)}px`, textAlign: 'center', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', color: '#374151' }}>Итог</th>
                </tr>
              </thead>
              <tbody>
                {results.details.map((det, di) => (
                  <tr key={det.student_id} style={{ background: di % 2 ? '#f9fafb' : 'white' }}>
                    <td style={{ padding: `${Math.max(4, 6 * scale)}px ${Math.max(6, 8 * scale)}px`, borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap', color: '#111827', fontWeight: 500 }}>{det.student_name}</td>
                    {det.answers.map(ans => {
                      const q = questions.find(x => x.id === ans.question_id);
                      let display = '—';
                      if (ans.value !== null && ans.value !== undefined) {
                        if (typeof ans.value === 'number' && (q?.type === 'single')) {
                          display = q?.options?.[ans.value as number] ?? String(ans.value);
                          if (display.length > 12) display = display.slice(0, 10) + '…';
                        } else if (Array.isArray(ans.value)) {
                          display = (ans.value as number[]).map(i => String.fromCharCode(65 + i)).join(',');
                        } else {
                          display = String(ans.value);
                          if (display.length > 12) display = display.slice(0, 10) + '…';
                        }
                      }
                      return (
                        <td key={ans.question_id} style={{ padding: `${Math.max(4, 6 * scale)}px ${Math.max(6, 8 * scale)}px`, borderBottom: '1px solid #e5e7eb', textAlign: 'center', color: ans.is_correct === true ? '#16a34a' : ans.is_correct === false ? '#dc2626' : '#374151' }} title={String(ans.value ?? '')}>
                          {display}
                          {ans.is_correct === true && ' ✓'}
                          {ans.is_correct === false && ' ✗'}
                        </td>
                      );
                    })}
                    <td style={{ padding: `${Math.max(4, 6 * scale)}px ${Math.max(6, 8 * scale)}px`, borderBottom: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 600, color: '#1d4ed8' }}>
                      {det.total_with_correct > 0 ? `${det.correct_count}/${det.total_with_correct}` : '—'}
                    </td>
                  </tr>
                ))}
                {results.details.length === 0 && (
                  <tr><td colSpan={questions.length + 2} style={{ textAlign: 'center', color: '#9ca3af', padding: 24 }}>Нет ответов</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── DiscussionStickerItem (презентер) ────────────────────────────────────────

const DOT_R = 7;

function DiscussionStickerItem({
  sticker, canEdit, canDelete, showDots,
  onMove, onDrag, onTextChange, onDelete, onHoverIn, onHoverOut, onDotMouseDown,
}: {
  sticker: DiscussionSticker;
  canEdit: boolean;
  canDelete: boolean;
  showDots: boolean;
  onMove: (x: number, y: number) => void;
  onDrag: (x: number, y: number) => void;
  onTextChange: (t: string) => void;
  onDelete: () => void;
  onHoverIn: () => void;
  onHoverOut: () => void;
  onDotMouseDown: (dot: 'n' | 's' | 'e' | 'w', e: React.MouseEvent) => void;
}) {
  const [lx, setLx] = useState(sticker.x);
  const [ly, setLy] = useState(sticker.y);
  const dragRef = useRef<{ sx: number; sy: number; smx: number; smy: number } | null>(null);

  useEffect(() => { setLx(sticker.x); setLy(sticker.y); }, [sticker.x, sticker.y]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (!canEdit) return;
    e.preventDefault();
    dragRef.current = { sx: lx, sy: ly, smx: e.clientX, smy: e.clientY };
    const move = (me: MouseEvent) => {
      if (!dragRef.current) return;
      const nx = dragRef.current.sx + me.clientX - dragRef.current.smx;
      const ny = dragRef.current.sy + me.clientY - dragRef.current.smy;
      setLx(nx);
      setLy(ny);
      onDrag(nx, ny);
    };
    const up = (me: MouseEvent) => {
      if (!dragRef.current) return;
      onMove(dragRef.current.sx + me.clientX - dragRef.current.smx, dragRef.current.sy + me.clientY - dragRef.current.smy);
      dragRef.current = null;
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };

  const dotStyle = (top: number, left: number): React.CSSProperties => ({
    position: 'absolute', top, left,
    width: DOT_R * 2, height: DOT_R * 2, borderRadius: '50%',
    background: '#3b82f6', border: '2px solid white',
    cursor: 'crosshair', zIndex: 30,
    boxShadow: '0 1px 4px rgba(0,0,0,0.22)',
  });

  return (
    <div
      onMouseEnter={onHoverIn}
      onMouseLeave={onHoverOut}
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute', left: lx, top: ly,
        width: STICKER_W, height: STICKER_H,
        backgroundColor: sticker.color, borderRadius: 10,
        boxShadow: '0 2px 12px rgba(0,0,0,0.13)',
        display: 'flex', flexDirection: 'column',
        zIndex: 10, cursor: canEdit ? 'grab' : 'default', userSelect: 'none',
      }}
    >
      {/* Точки соединения */}
      {showDots && (
        <>
          <div onMouseDown={e => { e.stopPropagation(); onDotMouseDown('n', e); }} style={dotStyle(-DOT_R, STICKER_W / 2 - DOT_R)} />
          <div onMouseDown={e => { e.stopPropagation(); onDotMouseDown('s', e); }} style={dotStyle(STICKER_H - DOT_R, STICKER_W / 2 - DOT_R)} />
          <div onMouseDown={e => { e.stopPropagation(); onDotMouseDown('e', e); }} style={dotStyle(STICKER_H / 2 - DOT_R, STICKER_W - DOT_R)} />
          <div onMouseDown={e => { e.stopPropagation(); onDotMouseDown('w', e); }} style={dotStyle(STICKER_H / 2 - DOT_R, -DOT_R)} />
        </>
      )}
      <div style={{ height: 24, flexShrink: 0, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '0 6px 0 0' }}>
        {canDelete && (
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onDelete(); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16, lineHeight: 1, padding: 2 }}
          >×</button>
        )}
      </div>
      <textarea
        value={sticker.text}
        onChange={e => { if (canEdit) onTextChange(e.target.value); }}
        onMouseDown={e => e.stopPropagation()}
        readOnly={!canEdit}
        placeholder={canEdit ? 'Введите текст...' : ''}
        style={{ flex: 1, padding: '0 10px', fontSize: 13, background: 'transparent', resize: 'none', border: 'none', outline: 'none', color: '#1f2937', cursor: canEdit ? 'text' : 'default' }}
      />
      <div style={{ height: 24, flexShrink: 0, padding: '0 10px', fontSize: 11, color: '#6b7280', borderTop: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {sticker.author_name}
      </div>
    </div>
  );
}

// ─── DiscussionSlideView ──────────────────────────────────────────────────────

function DiscussionSlideView({ slide, scale, user }: { slide: Slide; scale: number; user: User }) {
  const [stickers,       setStickers]       = useState<DiscussionSticker[]>([]);
  const [arrows,         setArrows]         = useState<DiscussionArrow[]>([]);
  const [topic,          setTopic]          = useState('');
  const [isConn,         setIsConn]         = useState(false);
  const [hoverStickerId, setHoverStickerId] = useState<string | null>(null);
  const [hoveredArrow,   setHoveredArrow]   = useState<string | null>(null);
  const [dragPositions,  setDragPositions]  = useState<Record<string, { x: number; y: number }>>({});
  const [drawing,        setDrawing]        = useState<{
    fromId: string; fromDot: 'n' | 's' | 'e' | 'w'; curX: number; curY: number;
  } | null>(null);
  const wsRef    = useRef<WebSocket | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const isStaff  = user.is_admin || user.is_teacher;

  useEffect(() => {
    const token = localStorage.getItem('access_token') ?? '';
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${window.location.host}/ws/discussion/${slide.id}/?token=${token}`);
    wsRef.current = ws;
    ws.onopen  = () => setIsConn(true);
    ws.onclose = () => { setIsConn(false); if (wsRef.current === ws) wsRef.current = null; };
    ws.onerror = () => setIsConn(false);
    ws.onmessage = (ev) => {
      try {
        const d = JSON.parse(ev.data);
        if (d.type === 'init')            { setStickers(d.stickers ?? []); setArrows(d.arrows ?? []); setTopic(d.topic ?? ''); }
        if (d.type === 'sticker_added')   setStickers(p => [...p, d.sticker]);
        if (d.type === 'sticker_updated') setStickers(p => p.map(s => s.id === d.sticker.id ? d.sticker : s));
        if (d.type === 'sticker_deleted') { setStickers(p => p.filter(s => s.id !== d.id)); setArrows(p => p.filter(a => a.from_id !== d.id && a.to_id !== d.id)); }
        if (d.type === 'arrow_added')     setArrows(p => [...p, d.arrow]);
        if (d.type === 'arrow_deleted')   setArrows(p => p.filter(a => a.id !== d.id));
        if (d.type === 'topic_updated')   setTopic(d.topic ?? '');
      } catch { /* ignore */ }
    };
    return () => { ws.close(); };
  }, [slide.id]);

  const send = (data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(data));
  };

  // ── Рисование стрелки ──────────────────────────────────────────────────────
  const startDraw = (fromId: string, fromDot: 'n' | 's' | 'e' | 'w', clientX: number, clientY: number) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDrawing({ fromId, fromDot, curX: clientX - rect.left, curY: clientY - rect.top });
  };

  useEffect(() => {
    if (!drawing) return;
    const onMove = (e: MouseEvent) => {
      const rect = boardRef.current?.getBoundingClientRect();
      if (!rect) return;
      setDrawing(prev => prev ? { ...prev, curX: e.clientX - rect.left, curY: e.clientY - rect.top } : null);
    };
    const onUp = (e: MouseEvent) => {
      const rect = boardRef.current?.getBoundingClientRect();
      if (rect && drawing) {
        const bx = e.clientX - rect.left;
        const by = e.clientY - rect.top;
        const target = stickers.find(s =>
          s.id !== drawing.fromId &&
          bx >= s.x && bx <= s.x + STICKER_W && by >= s.y && by <= s.y + STICKER_H,
        );
        if (target) send({ type: 'add_arrow', from_id: drawing.fromId, to_id: target.id });
      }
      setDrawing(null);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, [drawing, stickers]); // eslint-disable-line

  const getDotPos = (s: DiscussionSticker, dot: 'n' | 's' | 'e' | 'w'): [number, number] => {
    switch (dot) {
      case 'n': return [s.x + STICKER_W / 2, s.y];
      case 's': return [s.x + STICKER_W / 2, s.y + STICKER_H];
      case 'e': return [s.x + STICKER_W, s.y + STICKER_H / 2];
      case 'w': return [s.x, s.y + STICKER_H / 2];
    }
  };

  const addSticker  = (c: string) => send({ type: 'add_sticker', x: 60 + Math.random() * 500, y: 40 + Math.random() * 250, text: '', color: c, created_at: new Date().toISOString() });
  const moveSticker = (id: string, x: number, y: number) => { send({ type: 'update_sticker', id, x, y }); setStickers(p => p.map(s => s.id === id ? { ...s, x, y } : s)); };
  const textSticker = (id: string, text: string) => { send({ type: 'update_sticker', id, text }); setStickers(p => p.map(s => s.id === id ? { ...s, text } : s)); };
  const delSticker  = (id: string) => send({ type: 'delete_sticker', id });
  const delArrow    = (id: string) => send({ type: 'delete_arrow', id });
  const canEdit     = (authorId: number) => isStaff || authorId === user.id;
  const canDel      = (authorId: number) => isStaff || authorId === user.id;

  const fs = Math.max(11, 13 * scale);
  const fromSticker = drawing ? stickers.find(s => s.id === drawing.fromId) : null;
  const drawStart   = drawing && fromSticker ? getDotPos(fromSticker, drawing.fromDot) : null;

  return (
    <div style={{ width: CANVAS_W * scale, height: CANVAS_H * scale, display: 'flex', flexDirection: 'column', background: 'white', flexShrink: 0, overflow: 'hidden' }}>
      {topic && (
        <div style={{ padding: `${Math.max(4, 6 * scale)}px ${Math.max(8, 12 * scale)}px`, background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontSize: fs, fontWeight: 600, color: '#374151', flexShrink: 0 }}>
          {topic}
        </div>
      )}
      {/* Тулбар: цветные квадраты создают стикеры */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: `${Math.max(4, 6 * scale)}px ${Math.max(8, 10 * scale)}px`, borderBottom: '1px solid #e5e7eb', flexShrink: 0, background: 'white' }}>
        <span style={{ fontSize: Math.max(10, 11 * scale), color: '#9ca3af', flexShrink: 0 }}>Стикер:</span>
        {STICKER_COLORS.map(c => (
          <button
            key={c} onClick={() => { if (isConn) addSticker(c); }} disabled={!isConn} title="Добавить стикер"
            style={{ width: Math.max(16, 18 * scale), height: Math.max(16, 18 * scale), borderRadius: 3, border: '2px solid rgba(0,0,0,0.12)', background: c, cursor: isConn ? 'pointer' : 'default', opacity: isConn ? 1 : 0.4, padding: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.12)', flexShrink: 0 }}
          />
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: isConn ? '#4ade80' : '#f87171', display: 'inline-block' }} />
          <span style={{ fontSize: Math.max(9, 11 * scale), color: isConn ? '#16a34a' : '#dc2626' }}>{isConn ? 'Подключено' : 'Нет связи'}</span>
        </div>
      </div>
      {/* Доска */}
      <div ref={boardRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#f8fafc', cursor: drawing ? 'crosshair' : 'default' }}>
        {/* SVG: стрелки + рисуемая линия */}
        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 5, overflow: 'visible' }}>
          <defs>
            <marker id="pres-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#9ca3af" />
            </marker>
            <marker id="pres-arrow-del" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
            </marker>
            <marker id="pres-arrow-tmp" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#3b82f6" />
            </marker>
          </defs>
          {arrows.map(arrow => {
            const from = stickers.find(s => s.id === arrow.from_id);
            const to   = stickers.find(s => s.id === arrow.to_id);
            if (!from || !to) return null;
            const fp = dragPositions[from.id] ?? { x: from.x, y: from.y };
            const tp = dragPositions[to.id]   ?? { x: to.x,   y: to.y };
            const fromS = { ...from, ...fp };
            const toS   = { ...to,   ...tp };
            const [x1, y1] = stickerEdgePoint(fromS, tp.x + STICKER_W / 2, tp.y + STICKER_H / 2);
            const [x2, y2] = stickerEdgePoint(toS,   fp.x + STICKER_W / 2, fp.y + STICKER_H / 2);
            const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
            const isHov = hoveredArrow === arrow.id;
            const cd = canDel(arrow.author_id);
            return (
              <g key={arrow.id}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={isHov ? '#ef4444' : '#9ca3af'} strokeWidth={isHov ? 2.5 : 2} markerEnd={isHov ? 'url(#pres-arrow-del)' : 'url(#pres-arrow)'} style={{ pointerEvents: 'none' }} />
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={16}
                  style={{ pointerEvents: 'stroke', cursor: cd ? 'pointer' : 'default' }}
                  onMouseEnter={() => setHoveredArrow(arrow.id)}
                  onMouseLeave={() => setHoveredArrow(null)}
                  onClick={cd ? () => delArrow(arrow.id) : undefined}
                />
                {isHov && cd && (
                  <g transform={`translate(${mx},${my})`} style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredArrow(arrow.id)}
                    onMouseLeave={() => setHoveredArrow(null)}
                    onClick={() => delArrow(arrow.id)}>
                    <circle r={10} fill="white" stroke="#fca5a5" strokeWidth={1.5} />
                    <text textAnchor="middle" dominantBaseline="middle" fontSize={14} fill="#ef4444" fontWeight="bold">×</text>
                  </g>
                )}
              </g>
            );
          })}
          {/* Рисуемая стрелка */}
          {drawing && drawStart && (
            <line x1={drawStart[0]} y1={drawStart[1]} x2={drawing.curX} y2={drawing.curY}
              stroke="#3b82f6" strokeWidth={2} strokeDasharray="6,3" markerEnd="url(#pres-arrow-tmp)" style={{ pointerEvents: 'none' }} />
          )}
        </svg>
        {stickers.map(s => (
          <DiscussionStickerItem
            key={s.id} sticker={s}
            canEdit={canEdit(s.author_id)}
            canDelete={canDel(s.author_id)}
            showDots={hoverStickerId === s.id || drawing?.fromId === s.id}
            onDrag={(x, y) => setDragPositions(prev => ({ ...prev, [s.id]: { x, y } }))}
            onMove={(x, y) => {
              moveSticker(s.id, x, y);
              setDragPositions(prev => { const n = { ...prev }; delete n[s.id]; return n; });
            }}
            onTextChange={t => textSticker(s.id, t)}
            onDelete={() => delSticker(s.id)}
            onHoverIn={() => { if (!drawing) setHoverStickerId(s.id); }}
            onHoverOut={() => { if (!drawing) setHoverStickerId(prev => prev === s.id ? null : prev); }}
            onDotMouseDown={(dot, e) => { e.preventDefault(); startDraw(s.id, dot, e.clientX, e.clientY); }}
          />
        ))}
        {stickers.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: fs, pointerEvents: 'none' }}>
            Нажмите на квадратик цвета чтобы добавить стикер
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SlideView ────────────────────────────────────────────────────────────────

function SlideView({
  slide, scale, isPresenter, user,
  formResults, onFormSubmit, formSubmitted, formAnswers,
  onVideoControl, videoControl,
}: {
  slide: Slide;
  scale: number;
  isPresenter: boolean;
  user: User | null;
  formResults: Record<number, FormResults>;
  onFormSubmit: (slideId: number, answers: FormAnswerValue[]) => void;
  formSubmitted: Record<number, boolean>;
  formAnswers: Record<number, FormAnswerValue[]>;
  onVideoControl: (action: string) => void;
  videoControl: { action: string; ts: number } | null;
}) {
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
          overflow: 'hidden',
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

  if (slide.slide_type === 'video') {
    return (
      <VideoSlideView
        slide={slide} scale={scale}
        isPresenter={isPresenter}
        onVideoControl={onVideoControl}
        externalControl={isPresenter ? null : videoControl}
      />
    );
  }

  if (slide.slide_type === 'form') {
    if (isPresenter) {
      return <FormResultsView slide={slide} scale={scale} results={formResults[slide.id] ?? null} />;
    }
    return (
      <FormAnswerView
        slide={slide} scale={scale}
        onSubmit={answers => onFormSubmit(slide.id, answers)}
        submitted={formSubmitted[slide.id] ?? false}
        savedAnswers={formAnswers[slide.id] ?? []}
      />
    );
  }

  if (slide.slide_type === 'discussion' && user) {
    return <DiscussionSlideView slide={slide} scale={scale} user={user} />;
  }

  // Заглушка для неизвестных типов
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
      <span style={{ fontSize: 48 }}>📄</span>
      <span style={{ fontSize: 18, color: '#6b7280', fontWeight: 500 }}>{slide.title || slide.slide_type}</span>
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

  // ── Форма: ответы студентов и результаты для учителя ───────────────────────
  const [formResults,   setFormResults]   = useState<Record<number, FormResults>>({});
  const [formSubmitted, setFormSubmitted] = useState<Record<number, boolean>>({});
  const [formAnswers,   setFormAnswers]   = useState<Record<number, FormAnswerValue[]>>({});

  // ── Видео-синк ─────────────────────────────────────────────────────────────
  const [videoControl, setVideoControl] = useState<{ action: string; ts: number } | null>(null);

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
            <SlideView
              slide={currentSlide}
              scale={scale}
              isPresenter={isPresenter}
              user={user}
              formResults={formResults}
              onFormSubmit={handleFormSubmit}
              formSubmitted={formSubmitted}
              formAnswers={formAnswers}
              onVideoControl={handleVideoControl}
              videoControl={videoControl}
            />
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
