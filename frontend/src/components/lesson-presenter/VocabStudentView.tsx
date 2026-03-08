import { useState, useEffect, useRef } from 'react';
import type { Slide, VocabContent } from '../../types';
import type { VocabTaskKey } from '../../types';
import api from '../../api/client';
const VOCAB_LANG_LABELS: Record<'en' | 'kk', string> = { en: 'Английский', kk: 'Казахский' };
const VOCAB_LANG_BCP47: Record<'en' | 'kk', string>  = { en: 'en-US',      kk: 'kk-KZ'    };

function vocabSpeak(text: string, lang: 'en' | 'kk') {
  if (!text.trim()) return;
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = VOCAB_LANG_BCP47[lang];
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utt);
}

const ALL_TASK_KEYS: VocabTaskKey[] = [
  'ruToTargetChoice', 'ruToTargetInput',
  'targetToRuChoice', 'targetToRuInput',
  'audioToTargetChoice', 'audioToTargetInput',
  'imageToTargetChoice', 'imageToTargetInput',
];

interface VocabExercise {
  wordId: string;
  taskKey: VocabTaskKey;
  attempt: number;
}

function buildExerciseQueue(content: VocabContent): VocabExercise[] {
  const tasks = ALL_TASK_KEYS.filter(k => content.tasks[k]);
  const reps = content.repetitions === 'until_correct' ? 1 : content.repetitions;
  const queue: VocabExercise[] = [];
  for (let rep = 0; rep < reps; rep++) {
    for (const w of content.words) {
      for (const t of tasks) {
        queue.push({ wordId: w.id, taskKey: t, attempt: rep });
      }
    }
  }
  return queue;
}

// Is the correct answer in the target language? (false = Russian)
function isTargetLangAnswer(taskKey: VocabTaskKey): boolean {
  return !taskKey.startsWith('targetToRu');
}

// Is this a multiple-choice task?
function isChoiceTask(taskKey: VocabTaskKey): boolean {
  return taskKey.endsWith('Choice');
}

// Is this an audio stimulus task?
function isAudioTask(taskKey: VocabTaskKey): boolean {
  return taskKey.startsWith('audioToTarget');
}

// Is this an image stimulus task?
function isImageTask(taskKey: VocabTaskKey): boolean {
  return taskKey.startsWith('imageToTarget');
}

function getChoiceOptions(word: VocabWord, words: VocabWord[], taskKey: VocabTaskKey): { label: string; correct: boolean }[] {
  const targetAnswer = isTargetLangAnswer(taskKey);
  const correctText = targetAnswer ? word.target : word.ru;
  const pool = words.filter(w => w.id !== word.id).map(w => targetAnswer ? w.target : w.ru).filter(t => t.trim());
  const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, 3);
  const all = [correctText, ...shuffled].sort(() => Math.random() - 0.5);
  return all.map(label => ({ label, correct: label === correctText }));
}

const TASK_LABELS: Record<VocabTaskKey, string> = {
  ruToTargetChoice:    'Выберите перевод на {lang}',
  ruToTargetInput:     'Переведите на {lang}',
  targetToRuChoice:    'Выберите перевод на русский',
  targetToRuInput:     'Переведите на русский',
  audioToTargetChoice: 'Прослушайте и выберите слово на {lang}',
  audioToTargetInput:  'Прослушайте и напишите на {lang}',
  imageToTargetChoice: 'Что изображено? Выберите на {lang}',
  imageToTargetInput:  'Что изображено? Напишите на {lang}',
};


export default function VocabStudentView({
  slide, sessionId, content,
}: {
  slide: Slide;
  sessionId: number;
  content: VocabContent;
}) {
  const [queue] = useState<VocabExercise[]>(() => buildExerciseQueue(content));
  const [idx, setIdx] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [choiceOptions, setChoiceOptions] = useState<{ label: string; correct: boolean }[]>([]);
  const [done, setDone] = useState(false);
  const wordStatsRef = useRef<Record<string, { attempts: number; correct: number; learnedTasks: Set<string> }>>({});
  const [learnedWords, setLearnedWords] = useState<Set<string>>(new Set());

  const activeTasks = ALL_TASK_KEYS.filter(k => content.tasks[k]);

  const [repeatQueue, setRepeatQueue] = useState<VocabExercise[]>([]);
  const fullQueue = [...queue, ...repeatQueue];

  const currentExercise = fullQueue[idx];
  const currentWord = content.words.find(w => w.id === currentExercise?.wordId);

  // Prepare choice options and auto-speak on exercise change
  useEffect(() => {
    if (!currentExercise || !currentWord) return;
    if (isChoiceTask(currentExercise.taskKey)) {
      setChoiceOptions(getChoiceOptions(currentWord, content.words, currentExercise.taskKey));
    } else {
      setChoiceOptions([]);
    }
    if (isAudioTask(currentExercise.taskKey) && currentWord.target) {
      setTimeout(() => vocabSpeak(currentWord.target, content.targetLang), 300);
    }
    setInputValue('');
  }, [idx]); // eslint-disable-line

  if (done || !currentExercise || !currentWord) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: '#f0fdf4' }}>
        <span style={{ fontSize: 64 }}>🎉</span>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#15803d' }}>Все слова выучены!</h2>
        <p style={{ fontSize: 15, color: '#4b5563' }}>{content.words.length} слов · {VOCAB_LANG_LABELS[content.targetLang]}</p>
      </div>
    );
  }

  const taskLabel = TASK_LABELS[currentExercise.taskKey]
    .replace('{lang}', VOCAB_LANG_LABELS[content.targetLang].toLowerCase());

  const targetAnswer = isTargetLangAnswer(currentExercise.taskKey);
  const correctAnswer = targetAnswer ? currentWord.target : currentWord.ru;
  const isChoice = isChoiceTask(currentExercise.taskKey);
  const isAudio = isAudioTask(currentExercise.taskKey);
  const isImage = isImageTask(currentExercise.taskKey);

  const submitAnswer = (answer: string) => {
    if (feedback !== null) return;
    const stats = wordStatsRef.current;
    if (!stats[currentWord.id]) stats[currentWord.id] = { attempts: 0, correct: 0, learnedTasks: new Set() };
    stats[currentWord.id].attempts += 1;

    const isCorrect = answer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
    setFeedback(isCorrect ? 'correct' : 'wrong');

    if (isCorrect) {
      stats[currentWord.id].correct += 1;
      stats[currentWord.id].learnedTasks.add(currentExercise.taskKey);
    } else if (content.repetitions === 'until_correct') {
      setRepeatQueue(q => [...q, { ...currentExercise, attempt: (currentExercise.attempt ?? 0) + 1 }]);
    }

    const wordLearned = activeTasks.every(t => stats[currentWord.id].learnedTasks.has(t));
    if (wordLearned && !learnedWords.has(currentWord.id)) {
      setLearnedWords(prev => new Set([...prev, currentWord.id]));
      api.post(`/lessons/sessions/${sessionId}/slides/${slide.id}/vocab-progress/`, {
        word_id: currentWord.id,
        attempts: stats[currentWord.id].attempts,
        correct: stats[currentWord.id].correct,
        learned: true,
      }).catch(() => {/* ignore */});
    }

    setTimeout(() => {
      setFeedback(null);
      if (idx + 1 >= fullQueue.length) {
        setDone(true);
      } else {
        setIdx(i => i + 1);
      }
    }, 1500);
  };

  const progressPercent = Math.round((idx / fullQueue.length) * 100);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
      {/* Progress bar */}
      <div style={{ height: 4, background: '#e5e7eb', flexShrink: 0 }}>
        <div style={{ height: '100%', background: '#6366f1', width: `${progressPercent}%`, transition: 'width 0.3s' }} />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 24 }}>
        {/* Counter */}
        <div style={{ fontSize: 13, color: '#9ca3af' }}>
          {idx + 1} / {fullQueue.length} · {learnedWords.size}/{content.words.length} выучено
        </div>

        {/* Task label */}
        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#374151', textAlign: 'center' }}>{taskLabel}</h2>

        {/* Question stimulus */}
        <div style={{ background: 'white', borderRadius: 16, padding: '24px 32px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', textAlign: 'center', minWidth: 260 }}>
          {isAudio ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <button
                onClick={() => vocabSpeak(currentWord.target, content.targetLang)}
                style={{ fontSize: 40, background: 'none', border: 'none', cursor: 'pointer' }}
              >🔊</button>
              <span style={{ fontSize: 13, color: '#9ca3af' }}>Нажмите для повтора</span>
            </div>
          ) : isImage ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              {currentWord.imageUrl ? (
                <img src={currentWord.imageUrl} alt="" style={{ width: 160, height: 120, objectFit: 'cover', borderRadius: 8 }} />
              ) : (
                <div style={{ width: 160, height: 120, borderRadius: 8, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48, color: '#d1d5db' }}>🖼️</div>
              )}
            </div>
          ) : !targetAnswer ? (
            /* targetToRu: show target word with speaker */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 28, fontWeight: 700, color: '#1f2937' }}>{currentWord.target}</span>
              <button onClick={() => vocabSpeak(currentWord.target, content.targetLang)} style={{ fontSize: 18, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>🔊</button>
            </div>
          ) : (
            /* ruToTarget: show Russian word */
            <span style={{ fontSize: 28, fontWeight: 700, color: '#1f2937' }}>{currentWord.ru}</span>
          )}
        </div>

        {/* Answer area */}
        {isChoice ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, width: '100%', maxWidth: 480 }}>
            {choiceOptions.map((opt, i) => {
              let bg = 'white', border = '2px solid #e5e7eb', color = '#1f2937';
              if (feedback !== null) {
                if (opt.correct) { bg = '#f0fdf4'; border = '2px solid #22c55e'; color = '#15803d'; }
                else { bg = '#fef2f2'; border = '2px solid #f87171'; color = '#b91c1c'; }
              }
              return (
                <button key={i} onClick={() => submitAnswer(opt.label)} disabled={feedback !== null}
                  style={{ padding: '14px 16px', borderRadius: 12, background: bg, border, color, fontSize: 16, fontWeight: 500, cursor: feedback !== null ? 'default' : 'pointer', transition: 'all 0.15s' }}>
                  {opt.label}
                </button>
              );
            })}
            {feedback !== null && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', fontSize: 15, fontWeight: 600, color: feedback === 'correct' ? '#15803d' : '#b91c1c' }}>
                {feedback === 'correct' ? '✓ Правильно!' : `✗ Правильный ответ: ${correctAnswer}`}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%', maxWidth: 400 }}>
            <input
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && inputValue.trim() && submitAnswer(inputValue)}
              disabled={feedback !== null}
              placeholder={targetAnswer ? `На ${VOCAB_LANG_LABELS[content.targetLang].toLowerCase()}...` : 'На русском...'}
              autoFocus
              style={{ width: '100%', fontSize: 18, padding: '12px 16px', borderRadius: 12, border: `2px solid ${feedback === 'correct' ? '#22c55e' : feedback === 'wrong' ? '#f87171' : '#e5e7eb'}`, outline: 'none', textAlign: 'center', background: feedback === 'correct' ? '#f0fdf4' : feedback === 'wrong' ? '#fef2f2' : 'white' }}
            />
            <button onClick={() => submitAnswer(inputValue)} disabled={!inputValue.trim() || feedback !== null}
              style={{ padding: '10px 32px', borderRadius: 12, background: '#6366f1', color: 'white', border: 'none', fontSize: 15, fontWeight: 600, cursor: 'pointer', opacity: !inputValue.trim() ? 0.5 : 1 }}>
              Ответить
            </button>
            {feedback !== null && (
              <div style={{ fontSize: 15, fontWeight: 600, color: feedback === 'correct' ? '#15803d' : '#b91c1c' }}>
                {feedback === 'correct' ? '✓ Правильно!' : `✗ Правильный ответ: ${correctAnswer}`}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

