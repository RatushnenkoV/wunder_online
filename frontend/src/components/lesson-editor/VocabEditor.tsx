import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../api/client';
import type { Slide, VocabWord, VocabContent } from '../../types';
import VocabWordCard from './VocabWordCard';

const LANG_LABELS: Record<'en' | 'kk', string> = { en: 'Английский', kk: 'Казахский' };

function newVocabWord(): VocabWord {
  return { id: `w${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, ru: '', target: '', imageUrl: '' };
}

function defaultVocabContent(): VocabContent {
  return {
    targetLang: 'en',
    words: [newVocabWord()],
    tasks: {
      ruToTargetChoice: true,  ruToTargetInput: false,
      targetToRuChoice: true,  targetToRuInput: false,
      audioToTargetChoice: false, audioToTargetInput: false,
      imageToTargetChoice: false, imageToTargetInput: false,
    },
    repetitions: 1,
  };
}

export default function VocabEditor({ slide, lessonId, onSaved }: { slide: Slide; lessonId: number; onSaved: (s: Slide) => void }) {
  const getContent = (): VocabContent => {
    const c = slide.content as Partial<VocabContent>;
    if (c?.words) return c as VocabContent;
    return defaultVocabContent();
  };

  const [content, setContent] = useState<VocabContent>(getContent);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setContent(getContent()); }, [slide.id]); // eslint-disable-line

  const doSave = useCallback((c: VocabContent) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await api.put(`/lessons/lessons/${lessonId}/slides/${slide.id}/`, { content: c });
        onSaved(res.data);
      } catch { /* ignore */ }
    }, 400);
  }, [lessonId, slide.id, onSaved]);

  const update = (c: VocabContent) => { setContent(c); doSave(c); };

  const updateWord = (idx: number, w: VocabWord) => {
    const words = content.words.map((old, i) => i === idx ? w : old);
    update({ ...content, words });
  };

  const addWord = () => update({ ...content, words: [...content.words, newVocabWord()] });

  const deleteWord = (idx: number) => {
    if (content.words.length <= 1) return;
    update({ ...content, words: content.words.filter((_, i) => i !== idx) });
  };

  const setLang = (lang: 'en' | 'kk') => update({ ...content, targetLang: lang });

  const setTask = (key: keyof VocabContent['tasks'], val: boolean) =>
    update({ ...content, tasks: { ...content.tasks, [key]: val } });

  const setReps = (v: number | 'until_correct') => update({ ...content, repetitions: v });

  const activeTasks = Object.values(content.tasks).filter(Boolean).length;

  const taskRows: { label: string; choiceKey: keyof VocabContent['tasks']; inputKey: keyof VocabContent['tasks'] }[] = [
    {
      label:     `Перевести с русского на ${LANG_LABELS[content.targetLang].toLowerCase()}`,
      choiceKey: 'ruToTargetChoice',
      inputKey:  'ruToTargetInput',
    },
    {
      label:     `Перевести с ${LANG_LABELS[content.targetLang].toLowerCase()} на русский`,
      choiceKey: 'targetToRuChoice',
      inputKey:  'targetToRuInput',
    },
    {
      label:     `Аудио → текст (${LANG_LABELS[content.targetLang]})`,
      choiceKey: 'audioToTargetChoice',
      inputKey:  'audioToTargetInput',
    },
    {
      label:     `Картинка → текст (${LANG_LABELS[content.targetLang]})`,
      choiceKey: 'imageToTargetChoice',
      inputKey:  'imageToTargetInput',
    },
  ];

  const repsValue = content.repetitions !== 'until_correct' ? (content.repetitions as number) : 1;

  return (
    <div className="flex flex-col h-full">
      <div className="h-10 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center px-4 gap-3">
        <span className="text-sm text-gray-500 dark:text-slate-400">📚 Редактор словаря</span>
        <span className="text-xs text-gray-400 dark:text-slate-500">{content.words.length} слов</span>
      </div>
      <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-slate-900">
        <div className="max-w-3xl mx-auto p-6 space-y-6">

          {/* Язык */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm p-4">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3">Язык перевода</h3>
            <div className="flex gap-3">
              {(['en', 'kk'] as const).map(l => (
                <label key={l} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name={`lang_${slide.id}`} checked={content.targetLang === l}
                    onChange={() => setLang(l)} className="accent-purple-600" />
                  <span className="text-sm text-gray-700 dark:text-slate-300">{LANG_LABELS[l]}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Слова */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3">Слова</h3>
            <div className="space-y-3">
              {content.words.map((w, idx) => (
                <VocabWordCard
                  key={w.id}
                  word={w}
                  lang={content.targetLang}
                  lessonId={lessonId}
                  onChange={updated => updateWord(idx, updated)}
                  onDelete={() => deleteWord(idx)}
                  canDelete={content.words.length > 1}
                />
              ))}
              <button
                onClick={addWord}
                className="w-full py-3 text-sm text-purple-500 hover:text-purple-700 border-2 border-dashed border-purple-200 hover:border-purple-400 rounded-xl transition-colors font-medium"
              >
                + Добавить слово
              </button>
            </div>
          </div>

          {/* Типы заданий */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Типы заданий</h3>
              <div className="flex gap-4 text-xs text-gray-400 dark:text-slate-500 font-medium">
                <span>Выбор</span>
                <span>Ввод</span>
              </div>
            </div>
            <div className="space-y-2">
              {taskRows.map(({ label, choiceKey, inputKey }) => (
                <div key={choiceKey} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-gray-700 dark:text-slate-300 flex-1">{label}</span>
                  <div className="flex gap-6 flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={!!content.tasks[choiceKey]}
                      onChange={e => setTask(choiceKey, e.target.checked)}
                      disabled={content.tasks[choiceKey] && activeTasks === 1}
                      className="w-4 h-4 accent-purple-600 cursor-pointer"
                    />
                    <input
                      type="checkbox"
                      checked={!!content.tasks[inputKey]}
                      onChange={e => setTask(inputKey, e.target.checked)}
                      disabled={content.tasks[inputKey] && activeTasks === 1}
                      className="w-4 h-4 accent-purple-600 cursor-pointer"
                    />
                  </div>
                </div>
              ))}
            </div>
            {activeTasks === 0 && (
              <p className="text-xs text-red-500 mt-2">Выберите хотя бы один тип задания</p>
            )}
          </div>

          {/* Повторения */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm p-4">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3">Повторения</h3>
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={content.repetitions === 'until_correct'}
                  onChange={e => setReps(e.target.checked ? 'until_correct' : 1)}
                  className="w-4 h-4 accent-purple-600"
                />
                <span className="text-sm text-gray-700 dark:text-slate-300">Повторять до безошибочного</span>
              </label>
              {content.repetitions !== 'until_correct' && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setReps(Math.max(1, repsValue - 1))}
                    disabled={repsValue <= 1}
                    className="w-8 h-8 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors font-bold text-lg leading-none flex items-center justify-center"
                  >−</button>
                  <span className="w-8 text-center text-sm font-semibold text-gray-800 dark:text-slate-200">{repsValue}</span>
                  <button
                    onClick={() => setReps(Math.min(10, repsValue + 1))}
                    disabled={repsValue >= 10}
                    className="w-8 h-8 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors font-bold text-lg leading-none flex items-center justify-center"
                  >+</button>
                </div>
              )}
            </div>
          </div>

          <div className="text-xs text-gray-500 dark:text-slate-400 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            💡 Слово считается выученным, когда все активные типы заданий выполнены без ошибок. Картинки ищутся автоматически на Pixabay при вводе перевода.
          </div>

        </div>
      </div>
    </div>
  );
}
