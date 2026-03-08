import { useState, useEffect } from 'react';
import api from '../api/client';
import type { Lesson, LessonSession, LessonAssignment, FormResults, FormQuestionStat } from '../types';

interface SlideStats {
  slide_id: number;
  slide_type: string;
  title: string;
  results: FormResults;
}

interface SessionStats {
  session: LessonSession & { lesson_title: string };
  slides: SlideStats[];
}

function QuestionSummary({ stat }: { stat: FormQuestionStat }) {
  const fs = 13;
  return (
    <div style={{ padding: '8px 12px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 8 }}>
      <div style={{ fontWeight: 600, fontSize: fs, color: '#111827', marginBottom: 6 }}>
        {stat.text || '—'}
        <span style={{ fontWeight: 400, color: '#6b7280', marginLeft: 6, fontSize: 12 }}>({stat.answer_count} отв.)</span>
        {stat.has_correct && stat.correct_count !== undefined && (
          <span style={{ marginLeft: 8, color: '#16a34a', fontSize: 12 }}>✓ {stat.correct_count}</span>
        )}
      </div>

      {(stat.type === 'single' || stat.type === 'multiple') && stat.options && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {stat.options.map((opt, oi) => {
            const cnt = stat.option_counts?.[oi] ?? 0;
            const pct = stat.answer_count ? Math.round(cnt / stat.answer_count * 100) : 0;
            return (
              <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 14, fontSize: 11, color: '#6b7280' }}>{String.fromCharCode(65 + oi)}</span>
                <span style={{ fontSize: 12, color: '#374151', minWidth: 80, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt}</span>
                <div style={{ flex: 1, height: 10, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: '#93c5fd', transition: 'width 0.3s' }} />
                </div>
                <span style={{ fontSize: 11, color: '#6b7280', width: 28, textAlign: 'right' }}>{cnt}</span>
              </div>
            );
          })}
        </div>
      )}

      {stat.type === 'text' && (
        <div style={{ fontSize: 12, color: '#6b7280' }}>Ответили: {stat.answer_count}</div>
      )}

      {stat.type === 'scale' && stat.avg !== undefined && stat.avg !== null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: '#1d4ed8' }}>∅ {stat.avg}</span>
          {stat.value_counts && Object.entries(stat.value_counts).sort(([a], [b]) => +a - +b).map(([v, cnt]) => (
            <span key={v} style={{ fontSize: 12, background: '#eff6ff', color: '#1d4ed8', padding: '2px 6px', borderRadius: 4 }}>{v}: {cnt}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function SlideStatsView({ slideStats }: { slideStats: SlideStats }) {
  const [tab, setTab] = useState<'summary' | 'detail'>('summary');
  const { results, title, slide_type } = slideStats;

  return (
    <div style={{ marginBottom: 20, background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ background: '#f3f4f6', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: '#111827', flex: 1 }}>{title}</span>
        <span style={{ fontSize: 11, color: '#6b7280', background: 'white', border: '1px solid #e5e7eb', borderRadius: 4, padding: '2px 6px' }}>
          {slide_type === 'quiz' ? 'Квиз' : 'Форма'}
        </span>
        <span style={{ fontSize: 12, color: '#6b7280' }}>Ответили: {results.summary.answered_count}</span>
        <button onClick={() => setTab('summary')} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 5, border: 'none', background: tab === 'summary' ? '#3b82f6' : '#e5e7eb', color: tab === 'summary' ? 'white' : '#374151', cursor: 'pointer' }}>Сводка</button>
        <button onClick={() => setTab('detail')} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 5, border: 'none', background: tab === 'detail' ? '#3b82f6' : '#e5e7eb', color: tab === 'detail' ? 'white' : '#374151', cursor: 'pointer' }}>Детально</button>
      </div>
      <div style={{ padding: 16, maxHeight: 280, overflowY: 'auto' }}>
        {tab === 'summary' ? (
          results.summary.per_question.length === 0
            ? <div style={{ color: '#9ca3af', fontSize: 13 }}>Нет вопросов</div>
            : results.summary.per_question.map((stat: FormQuestionStat) => (
              <QuestionSummary key={stat.question_id} stat={stat} />
            ))
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f3f4f6' }}>
                  <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' }}>Ученик</th>
                  {results.summary.per_question.map((q, qi) => (
                    <th key={q.question_id} style={{ padding: '6px 8px', textAlign: 'center', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' }} title={q.text}>В{qi + 1}</th>
                  ))}
                  <th style={{ padding: '6px 8px', textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Итог</th>
                </tr>
              </thead>
              <tbody>
                {results.details.map((det, di) => (
                  <tr key={det.student_id} style={{ background: di % 2 ? '#f9fafb' : 'white' }}>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap', fontWeight: 500 }}>{det.student_name}</td>
                    {det.answers.map(ans => {
                      const q = results.summary.per_question.find(x => x.question_id === ans.question_id);
                      let display = '—';
                      if (ans.value !== null && ans.value !== undefined) {
                        if (typeof ans.value === 'number' && q?.type === 'single') {
                          display = q?.options?.[ans.value as number] ?? String(ans.value);
                          if (display.length > 14) display = display.slice(0, 12) + '…';
                        } else if (Array.isArray(ans.value)) {
                          display = (ans.value as number[]).map(i => String.fromCharCode(65 + i)).join(',');
                        } else {
                          display = String(ans.value);
                          if (display.length > 14) display = display.slice(0, 12) + '…';
                        }
                      }
                      return (
                        <td key={ans.question_id} style={{ padding: '4px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center', color: ans.is_correct === true ? '#16a34a' : ans.is_correct === false ? '#dc2626' : '#374151' }} title={String(ans.value ?? '')}>
                          {display}{ans.is_correct === true && ' ✓'}{ans.is_correct === false && ' ✗'}
                        </td>
                      );
                    })}
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 600, color: '#1d4ed8' }}>
                      {det.total_with_correct > 0 ? `${det.correct_count}/${det.total_with_correct}` : '—'}
                    </td>
                  </tr>
                ))}
                {results.details.length === 0 && (
                  <tr><td colSpan={results.summary.per_question.length + 2} style={{ textAlign: 'center', color: '#9ca3af', padding: 16 }}>Нет ответов</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SessionStatsDialog({ lesson, onClose }: { lesson: Lesson; onClose: () => void }) {
  const [sessions, setSessions] = useState<LessonSession[]>([]);
  const [assignments, setAssignments] = useState<LessonAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<LessonSession | null>(null);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [mainTab, setMainTab] = useState<'sessions' | 'assignments'>('sessions');

  useEffect(() => {
    Promise.all([
      api.get(`/lessons/sessions/?lesson=${lesson.id}`),
      api.get('/lessons/assignments/'),
    ]).then(([sRes, aRes]) => {
      setSessions(sRes.data ?? []);
      setAssignments((aRes.data ?? []).filter((a: LessonAssignment) => a.lesson === lesson.id));
    }).finally(() => setLoading(false));
  }, [lesson.id]);

  const selectSession = async (s: LessonSession) => {
    setSelectedSession(s);
    setStats(null);
    setLoadingStats(true);
    try {
      const res = await api.get(`/lessons/sessions/${s.id}/stats/`);
      setStats(res.data);
    } finally { setLoadingStats(false); }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 960, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.2)' }}>
        {/* Заголовок */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 17, color: '#111827' }}>Статистика урока</div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>{lesson.title}</div>
          </div>
          <button onClick={onClose} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: 14, color: '#374151' }}>Закрыть</button>
        </div>

        {/* Таблица вкладок */}
        <div style={{ padding: '0 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: 0, flexShrink: 0 }}>
          {(['sessions', 'assignments'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setMainTab(t); setSelectedSession(null); setStats(null); }}
              style={{ padding: '10px 20px', fontSize: 13, fontWeight: mainTab === t ? 600 : 400, color: mainTab === t ? '#3b82f6' : '#6b7280', background: 'none', border: 'none', borderBottom: mainTab === t ? '2px solid #3b82f6' : '2px solid transparent', cursor: 'pointer' }}
            >
              {t === 'sessions' ? `Сессии (${sessions.length})` : `Самостоятельные (${assignments.length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 14 }}>Загрузка...</div>
        ) : (
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

            {/* Левая панель — список */}
            <div style={{ width: 280, flexShrink: 0, borderRight: '1px solid #e5e7eb', overflowY: 'auto', background: '#f9fafb' }}>
              {mainTab === 'sessions' ? (
                sessions.length === 0
                  ? <div style={{ padding: 24, color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>Сессий не проводилось</div>
                  : sessions.map(s => (
                    <button
                      key={s.id}
                      onClick={() => selectSession(s)}
                      style={{
                        width: '100%', textAlign: 'left', padding: '12px 16px',
                        background: selectedSession?.id === s.id ? '#eff6ff' : 'transparent',
                        cursor: 'pointer', border: 'none', borderBottom: '1px solid #e5e7eb',
                        borderLeft: selectedSession?.id === s.id ? '3px solid #3b82f6' : '3px solid transparent',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>
                        {s.school_class_name || 'Без класса'}
                        {s.is_active && <span style={{ marginLeft: 6, fontSize: 10, background: '#dcfce7', color: '#16a34a', padding: '1px 5px', borderRadius: 4 }}>Активна</span>}
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{formatDate(s.started_at)}</div>
                    </button>
                  ))
              ) : (
                assignments.length === 0
                  ? <div style={{ padding: 24, color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>Самостоятельных заданий нет</div>
                  : assignments.map(a => (
                    <div key={a.id} style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>
                        {a.school_class_name || a.student_name || '—'}
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                        Выдано: {formatDate(a.created_at)}
                        {a.due_date && ` · Срок: ${formatDate(a.due_date)}`}
                      </div>
                    </div>
                  ))
              )}
            </div>

            {/* Правая панель — детали */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {mainTab === 'assignments' ? (
                <div style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', paddingTop: 40 }}>
                  Статистика самостоятельных заданий будет доступна в следующей версии
                </div>
              ) : selectedSession ? (
                loadingStats ? (
                  <div style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', paddingTop: 40 }}>Загрузка статистики...</div>
                ) : stats ? (
                  <div>
                    <div style={{ marginBottom: 16, padding: '12px 16px', background: '#f3f4f6', borderRadius: 8 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>
                        {selectedSession.school_class_name || 'Без класса'} · {formatDate(selectedSession.started_at)}
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                        {selectedSession.ended_at ? `Завершена: ${formatDate(selectedSession.ended_at)}` : 'Идёт'}
                      </div>
                    </div>
                    {stats.slides.length === 0 ? (
                      <div style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', paddingTop: 24 }}>
                        В этом уроке нет слайдов с формами или квизами
                      </div>
                    ) : (
                      stats.slides.map(ss => <SlideStatsView key={ss.slide_id} slideStats={ss} />)
                    )}
                  </div>
                ) : null
              ) : (
                <div style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', paddingTop: 60 }}>
                  Выберите сессию для просмотра статистики
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
