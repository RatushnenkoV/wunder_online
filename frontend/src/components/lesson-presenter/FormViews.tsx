import { useState } from 'react';
import type { Slide, FormQuestion, FormAnswerValue, FormResults } from '../../types';

const CANVAS_W = 960;
const CANVAS_H = 540;

export function FormAnswerView({
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

export function FormResultsView({ slide, scale, results }: { slide: Slide; scale: number; results: FormResults | null }) {
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
