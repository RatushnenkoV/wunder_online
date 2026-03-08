import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../api/client';
import type { Slide, FormQuestion, FormQuestionType } from '../../types';

function IconTrash() {
  return <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
}

export default function FormEditor({ slide, lessonId, onSaved }: { slide: Slide; lessonId: number; onSaved: (s: Slide) => void }) {
  const getQuestions = () => {
    const c = slide.content as { questions?: FormQuestion[] };
    return c?.questions ?? [];
  };

  const [questions, setQuestions] = useState<FormQuestion[]>(getQuestions);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setQuestions(getQuestions()); }, [slide.id]);

  const save = useCallback((qs: FormQuestion[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await api.put(`/lessons/lessons/${lessonId}/slides/${slide.id}/`, { content: { questions: qs } });
        onSaved(res.data);
      } catch { /* ignore */ }
    }, 400);
  }, [lessonId, slide.id, onSaved]);

  const updateQ = (idx: number, patch: Partial<FormQuestion>) => {
    setQuestions(prev => { const next = prev.map((q, i) => i === idx ? { ...q, ...patch } : q); save(next); return next; });
  };

  const addQuestion = () => {
    const q: FormQuestion = { id: `q${Date.now()}`, type: 'single', text: '', required: false, options: ['', ''] };
    setQuestions(prev => { const next = [...prev, q]; save(next); return next; });
  };

  const deleteQuestion = (idx: number) => {
    setQuestions(prev => { const next = prev.filter((_, i) => i !== idx); save(next); return next; });
  };

  const moveQuestion = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= questions.length) return;
    setQuestions(prev => { const next = [...prev]; [next[idx], next[newIdx]] = [next[newIdx], next[idx]]; save(next); return next; });
  };

  const addOption   = (qi: number) => updateQ(qi, { options: [...(questions[qi].options ?? []), ''] });
  const updateOption = (qi: number, oi: number, val: string) => {
    const opts = [...(questions[qi].options ?? [])]; opts[oi] = val; updateQ(qi, { options: opts });
  };
  const deleteOption = (qi: number, oi: number) => {
    updateQ(qi, { options: (questions[qi].options ?? []).filter((_, i) => i !== oi) });
  };

  const Q_TYPES: { value: FormQuestionType; label: string }[] = [
    { value: 'single',   label: 'Один ответ' },
    { value: 'multiple', label: 'Несколько'  },
    { value: 'text',     label: 'Текст'      },
    { value: 'scale',    label: 'Шкала'      },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="h-10 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center px-4">
        <span className="text-sm text-gray-500 dark:text-slate-400">📋 Редактор формы</span>
      </div>
      <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-slate-900 p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {questions.length === 0 && (
            <div className="text-center py-12 text-gray-400 dark:text-slate-500">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-sm">Нет вопросов. Добавьте первый!</p>
            </div>
          )}
          {questions.map((q, idx) => (
            <div key={q.id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="text" value={q.text}
                      onChange={e => updateQ(idx, { text: e.target.value })}
                      placeholder={`Вопрос ${idx + 1}`}
                      className="flex-1 text-sm font-medium text-gray-800 dark:text-slate-200 border-b border-transparent hover:border-gray-200 focus:border-purple-400 focus:outline-none pb-0.5 bg-transparent"
                    />
                    <select
                      value={q.type}
                      onChange={e => updateQ(idx, { type: e.target.value as FormQuestionType })}
                      className="text-xs border border-gray-200 dark:border-slate-700 rounded px-2 h-7 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 cursor-pointer"
                    >
                      {Q_TYPES.map(({ value, label }) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>

                  {(q.type === 'single' || q.type === 'multiple') && (
                    <div className="space-y-1.5 ml-1">
                      {(q.options ?? []).map((opt, oi) => {
                        const isCorrect = (q.correct_options ?? []).includes(oi);
                        const toggleCorrect = () => {
                          if (q.type === 'single') {
                            updateQ(idx, { correct_options: isCorrect ? [] : [oi] });
                          } else {
                            const cur = q.correct_options ?? [];
                            updateQ(idx, { correct_options: isCorrect ? cur.filter(i => i !== oi) : [...cur, oi] });
                          }
                        };
                        return (
                          <div key={oi} className="flex items-center gap-2">
                            <span className="text-gray-300 dark:text-slate-600 text-xs flex-shrink-0">{q.type === 'single' ? '○' : '□'}</span>
                            <input
                              type="text" value={opt}
                              onChange={e => updateOption(idx, oi, e.target.value)}
                              placeholder={`Вариант ${oi + 1}`}
                              className="flex-1 text-sm text-gray-700 dark:text-slate-300 border-b border-gray-100 dark:border-slate-700 hover:border-gray-300 focus:border-purple-400 focus:outline-none pb-0.5 bg-transparent"
                            />
                            <button
                              onClick={toggleCorrect}
                              title={isCorrect ? 'Убрать правильный ответ' : 'Отметить как правильный'}
                              className={`w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center text-[11px] transition-colors ${
                                isCorrect
                                  ? 'bg-green-100 border-green-400 text-green-600'
                                  : 'border-gray-200 dark:border-slate-700 text-gray-300 dark:text-slate-600 hover:border-green-300 hover:text-green-500'
                              }`}
                            >✓</button>
                            {(q.options?.length ?? 0) > 1 && (
                              <button onClick={() => deleteOption(idx, oi)} className="text-gray-300 dark:text-slate-600 hover:text-red-400 text-sm leading-none">×</button>
                            )}
                          </div>
                        );
                      })}
                      <button onClick={() => addOption(idx)} className="text-xs text-purple-500 hover:text-purple-700 mt-1">
                        + Добавить вариант
                      </button>
                      {(q.correct_options ?? []).length > 0 && (
                        <p className="text-[10px] text-green-600 mt-0.5">
                          ✓ Правильный ответ задан — система проверит автоматически
                        </p>
                      )}
                    </div>
                  )}

                  {q.type === 'text' && (
                    <div className="ml-1 mt-2 space-y-2">
                      <div className="border border-dashed border-gray-200 dark:border-slate-700 rounded p-2 text-xs text-gray-400 dark:text-slate-500 italic">Поле для ответа</div>
                      <input
                        type="text"
                        value={q.correct_text ?? ''}
                        onChange={e => updateQ(idx, { correct_text: e.target.value || undefined })}
                        placeholder="Правильный ответ (необязательно)"
                        className={`w-full text-xs rounded px-2 py-1.5 border focus:outline-none bg-transparent transition-colors ${
                          q.correct_text
                            ? 'border-green-300 text-green-700 placeholder:text-green-300 focus:border-green-400'
                            : 'border-dashed border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 placeholder:text-gray-300 focus:border-purple-300'
                        }`}
                      />
                      {q.correct_text && (
                        <p className="text-[10px] text-green-600">✓ Правильный ответ задан — система проверит автоматически</p>
                      )}
                    </div>
                  )}

                  {q.type === 'scale' && (
                    <div className="ml-1 mt-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-slate-400 w-10 flex-shrink-0">Мин</span>
                        <input type="number" value={q.scale_min ?? 1}
                          onChange={e => updateQ(idx, { scale_min: Number(e.target.value) })}
                          className="w-14 text-xs border border-gray-200 dark:border-slate-700 rounded px-1.5 h-6 text-center" />
                        <input type="text" value={q.scale_min_label ?? ''}
                          onChange={e => updateQ(idx, { scale_min_label: e.target.value })}
                          placeholder="Подпись" className="flex-1 text-xs border-b border-gray-100 dark:border-slate-700 focus:border-purple-400 focus:outline-none bg-transparent pb-0.5" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-slate-400 w-10 flex-shrink-0">Макс</span>
                        <input type="number" value={q.scale_max ?? 5}
                          onChange={e => updateQ(idx, { scale_max: Number(e.target.value) })}
                          className="w-14 text-xs border border-gray-200 dark:border-slate-700 rounded px-1.5 h-6 text-center" />
                        <input type="text" value={q.scale_max_label ?? ''}
                          onChange={e => updateQ(idx, { scale_max_label: e.target.value })}
                          placeholder="Подпись" className="flex-1 text-xs border-b border-gray-100 dark:border-slate-700 focus:border-purple-400 focus:outline-none bg-transparent pb-0.5" />
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {Array.from({ length: Math.max(1, (q.scale_max ?? 5) - (q.scale_min ?? 1) + 1) }, (_, i) => {
                          const val = (q.scale_min ?? 1) + i;
                          const isCorrect = q.correct_scale === val;
                          return (
                            <button
                              key={i}
                              onClick={() => updateQ(idx, { correct_scale: isCorrect ? undefined : val })}
                              title={isCorrect ? 'Убрать правильный ответ' : 'Отметить как правильный'}
                              className={`w-7 h-7 rounded border flex items-center justify-center text-xs transition-colors ${
                                isCorrect
                                  ? 'bg-green-100 border-green-400 text-green-700 font-semibold'
                                  : 'border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:border-green-300 hover:text-green-500'
                              }`}
                            >{val}</button>
                          );
                        })}
                      </div>
                      {q.correct_scale != null ? (
                        <p className="text-[10px] text-green-600">✓ Правильный ответ: {q.correct_scale} — система проверит автоматически</p>
                      ) : (
                        <p className="text-[10px] text-gray-400 dark:text-slate-500">Кликните на значение, чтобы отметить правильный ответ</p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-3 pt-2 border-t border-gray-100 dark:border-slate-700">
                    <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400 cursor-pointer">
                      <input type="checkbox" checked={q.required}
                        onChange={e => updateQ(idx, { required: e.target.checked })}
                        className="accent-purple-500" />
                      Обязательный
                    </label>
                  </div>
                </div>

                <div className="flex flex-col gap-0.5 flex-shrink-0 mt-1">
                  <button onClick={() => moveQuestion(idx, -1)} disabled={idx === 0}
                    className="p-1 text-gray-300 dark:text-slate-600 hover:text-gray-600 disabled:opacity-20 text-sm leading-none">↑</button>
                  <button onClick={() => moveQuestion(idx, 1)} disabled={idx === questions.length - 1}
                    className="p-1 text-gray-300 dark:text-slate-600 hover:text-gray-600 disabled:opacity-20 text-sm leading-none">↓</button>
                  <button onClick={() => deleteQuestion(idx)} className="p-1 text-gray-300 dark:text-slate-600 hover:text-red-400 mt-0.5"><IconTrash /></button>
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={addQuestion}
            className="w-full py-3 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-400 dark:text-slate-500 hover:border-purple-400 hover:text-purple-500 hover:bg-purple-50/50 transition-all"
          >
            + Добавить вопрос
          </button>
        </div>
      </div>
    </div>
  );
}
