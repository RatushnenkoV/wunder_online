import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../api/client';
import type { Slide, QuizQuestion, QuizContent } from '../../types';

const QUIZ_OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];
const QUIZ_TIME_OPTIONS = [10, 15, 20, 30, 45, 60];

function newQuizQuestion(): QuizQuestion {
  return {
    id: `q${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    text: '',
    options: ['', '', '', ''],
    correct: 0,
    time_limit: 30,
  };
}

function QuizQuestionCard({
  question, index, total, onChange, onDelete,
}: {
  question: QuizQuestion;
  index: number;
  total: number;
  onChange: (q: QuizQuestion) => void;
  onDelete: () => void;
}) {
  const updateOpt = (i: number, val: string) => {
    const opts = [...question.options]; opts[i] = val;
    onChange({ ...question, options: opts });
  };
  const addOpt = () => {
    if (question.options.length >= 6) return;
    onChange({ ...question, options: [...question.options, ''] });
  };
  const deleteOpt = (i: number) => {
    if (question.options.length <= 2) return;
    const opts = question.options.filter((_, j) => j !== i);
    const correct = question.correct > i
      ? question.correct - 1
      : question.correct >= opts.length
      ? opts.length - 1
      : question.correct;
    onChange({ ...question, options: opts, correct });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Шапка карточки */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50">
        <span className="text-xs font-semibold text-gray-500">Вопрос {index + 1}</span>
        {total > 1 && (
          <button onClick={onDelete} title="Удалить вопрос" className="text-gray-300 hover:text-red-500 transition-colors text-lg leading-none">×</button>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Текст вопроса */}
        <textarea
          value={question.text}
          onChange={e => onChange({ ...question, text: e.target.value })}
          placeholder="Введите вопрос..."
          rows={2}
          className="w-full text-sm text-gray-800 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 resize-none"
        />

        {/* Варианты */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">Варианты ответов</span>
            <span className="text-xs text-gray-400">Нажмите на букву, чтобы отметить правильный</span>
          </div>
          {question.options.map((opt, i) => (
            <div key={i} className={`flex items-center gap-2 p-2 rounded-lg border-2 transition-colors ${question.correct === i ? 'border-green-400 bg-green-50' : 'border-gray-100 hover:border-gray-200'}`}>
              <button
                onClick={() => onChange({ ...question, correct: i })}
                className={`flex-shrink-0 w-7 h-7 rounded-full text-xs font-bold transition-colors ${question.correct === i ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              >
                {QUIZ_OPTION_LABELS[i]}
              </button>
              <input
                type="text"
                value={opt}
                onChange={e => updateOpt(i, e.target.value)}
                placeholder={`Вариант ${QUIZ_OPTION_LABELS[i]}`}
                className="flex-1 text-sm text-gray-800 bg-transparent border-none outline-none"
              />
              {question.options.length > 2 && (
                <button onClick={() => deleteOpt(i)} className="flex-shrink-0 text-gray-300 hover:text-red-500 transition-colors text-lg leading-none">×</button>
              )}
            </div>
          ))}
          {question.options.length < 6 && (
            <button onClick={addOpt} className="w-full py-1.5 text-xs text-gray-400 hover:text-blue-500 border border-dashed border-gray-200 hover:border-blue-300 rounded-lg transition-colors">
              + Добавить вариант
            </button>
          )}
        </div>

        {/* Время */}
        <div>
          <span className="text-xs font-medium text-gray-500 block mb-1.5">Время на ответ</span>
          <div className="flex gap-1.5 flex-wrap">
            {QUIZ_TIME_OPTIONS.map(t => (
              <button
                key={t}
                onClick={() => onChange({ ...question, time_limit: t })}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${question.time_limit === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {t}с
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function QuizEditor({ slide, lessonId, onSaved }: { slide: Slide; lessonId: number; onSaved: (s: Slide) => void }) {
  const getContent = (): QuizContent => {
    const c = slide.content as Partial<QuizContent>;
    if (c?.questions && c.questions.length > 0) {
      return { questions: c.questions };
    }
    return { questions: [newQuizQuestion()] };
  };

  const [content, setContent] = useState<QuizContent>(getContent);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setContent(getContent()); }, [slide.id]); // eslint-disable-line

  const doSave = useCallback((c: QuizContent) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await api.put(`/lessons/lessons/${lessonId}/slides/${slide.id}/`, { content: c });
        onSaved(res.data);
      } catch { /* ignore */ }
    }, 400);
  }, [lessonId, slide.id, onSaved]);

  const updateQuestion = (idx: number, q: QuizQuestion) => {
    const questions = content.questions.map((old, i) => i === idx ? q : old);
    const next = { questions };
    setContent(next);
    doSave(next);
  };

  const addQuestion = () => {
    const next = { questions: [...content.questions, newQuizQuestion()] };
    setContent(next);
    doSave(next);
  };

  const deleteQuestion = (idx: number) => {
    if (content.questions.length <= 1) return;
    const next = { questions: content.questions.filter((_, i) => i !== idx) };
    setContent(next);
    doSave(next);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="h-10 border-b border-gray-200 bg-white flex items-center px-4 gap-3">
        <span className="text-sm text-gray-500">🏆 Редактор викторины</span>
        <span className="text-xs text-gray-400">{content.questions.length} вопр.</span>
      </div>
      <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto space-y-4">

          {content.questions.map((q, idx) => (
            <QuizQuestionCard
              key={q.id}
              question={q}
              index={idx}
              total={content.questions.length}
              onChange={updated => updateQuestion(idx, updated)}
              onDelete={() => deleteQuestion(idx)}
            />
          ))}

          <button
            onClick={addQuestion}
            className="w-full py-3 text-sm text-blue-500 hover:text-blue-700 border-2 border-dashed border-blue-200 hover:border-blue-400 rounded-xl transition-colors font-medium"
          >
            + Добавить вопрос
          </button>

          <div className="text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            💡 Правильный ответ выделен зелёным. Баллы получают только те, кто ответил правильно — чем быстрее, тем больше (макс. 1000, мин. 100 очков).
          </div>

        </div>
      </div>
    </div>
  );
}
