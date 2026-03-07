import { useState, useEffect } from 'react';
import type { Slide } from '../../types';
import type { QuizContent, QuizLeaderboardData } from '../../types';

const CANVAS_W = 960;
const CANVAS_H = 540;
const OPTION_COLORS = ['#6366f1', '#ec4899', '#22c55e', '#f97316', '#06b6d4', '#eab308'];
const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];
const MEDALS = ['🥇', '🥈', '🥉'];

export function QuizAnswerView({
  slide, scale, questionIdx, isStarted, timeLimitSec, startedAt, answered, onAnswer,
}: {
  slide: Slide;
  scale: number;
  questionIdx: number;
  isStarted: boolean;
  timeLimitSec: number;
  startedAt: number | null;
  answered: { optionIndex: number; points: number; isCorrect: boolean } | null;
  onAnswer: (optionIndex: number, elapsedMs: number) => void;
}) {
  const questions = (slide.content as Partial<QuizContent>)?.questions ?? [];
  const q = questions[questionIdx];
  const question = q?.text ?? '';
  const options  = q?.options ?? [];
  const [timeLeft, setTimeLeft] = useState(timeLimitSec);

  useEffect(() => {
    setTimeLeft(timeLimitSec);
  }, [slide.id, questionIdx, timeLimitSec]);

  useEffect(() => {
    if (!isStarted || answered) return;
    const start = startedAt ?? Date.now();
    const end = start + timeLimitSec * 1000;

    const tick = () => {
      const left = Math.max(0, Math.round((end - Date.now()) / 1000));
      setTimeLeft(left);
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [isStarted, startedAt, timeLimitSec, answered]);

  const handleAnswer = (idx: number) => {
    if (!isStarted || answered) return;
    const elapsed = startedAt ? Date.now() - startedAt : 0;
    onAnswer(idx, elapsed);
  };

  const fs = Math.max(11, 14 * scale);
  const fsQ = Math.max(14, 22 * scale);
  const pad = Math.max(10, 16 * scale);
  const timerFrac = isStarted ? timeLeft / timeLimitSec : 1;
  const timerColor = timerFrac > 0.5 ? '#22c55e' : timerFrac > 0.25 ? '#f97316' : '#ef4444';

  return (
    <div style={{ width: CANVAS_W * scale, height: CANVAS_H * scale, background: '#1e1b4b', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
      {/* Прогресс-бар таймера */}
      <div style={{ height: Math.max(4, 6 * scale), background: '#312e81', flexShrink: 0 }}>
        <div style={{ height: '100%', width: `${timerFrac * 100}%`, background: timerColor, transition: 'width 0.2s linear, background 0.5s' }} />
      </div>

      {/* Заголовок с таймером */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${Math.max(6, 8 * scale)}px ${pad}px`, flexShrink: 0 }}>
        <span style={{ fontSize: Math.max(9, 11 * scale), color: '#a5b4fc', fontWeight: 500 }}>🏆 Вопрос {questionIdx + 1}</span>
        {isStarted && (
          <div style={{ display: 'flex', alignItems: 'center', gap: Math.max(4, 6 * scale) }}>
            <div style={{
              width: Math.max(32, 42 * scale), height: Math.max(32, 42 * scale),
              borderRadius: '50%', background: timerColor + '33', border: `2px solid ${timerColor}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: Math.max(11, 14 * scale), fontWeight: 700, color: timerColor,
            }}>
              {timeLeft}
            </div>
          </div>
        )}
      </div>

      {/* Вопрос */}
      <div style={{ flex: '0 0 auto', padding: `0 ${pad}px ${pad}px`, textAlign: 'center' }}>
        {!isStarted ? (
          <div style={{ color: '#a5b4fc', fontSize: fsQ, fontWeight: 600 }}>Ожидайте начала вопроса…</div>
        ) : (
          <div style={{ color: 'white', fontSize: fsQ, fontWeight: 700, lineHeight: 1.3 }}>{question}</div>
        )}
      </div>

      {/* Варианты */}
      {isStarted && (
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: options.length <= 2 ? '1fr 1fr' : 'repeat(2, 1fr)', gap: Math.max(6, 8 * scale), padding: `0 ${pad}px ${pad}px`, overflow: 'hidden' }}>
          {options.map((opt, idx) => {
            const isSelected = answered?.optionIndex === idx;
            const color = OPTION_COLORS[idx % OPTION_COLORS.length];
            return (
              <button
                key={idx}
                disabled={!!answered}
                onClick={() => handleAnswer(idx)}
                style={{
                  background: isSelected ? color : color + 'cc',
                  border: `2px solid ${isSelected ? 'white' : 'transparent'}`,
                  borderRadius: Math.max(8, 10 * scale),
                  color: 'white',
                  fontWeight: 600,
                  fontSize: fs,
                  cursor: answered ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: Math.max(6, 8 * scale),
                  padding: `0 ${Math.max(10, 12 * scale)}px`,
                  opacity: answered && !isSelected ? 0.5 : 1,
                  transition: 'opacity 0.3s',
                  minHeight: Math.max(40, 50 * scale),
                  overflow: 'hidden',
                }}
              >
                <span style={{ flexShrink: 0, width: Math.max(22, 26 * scale), height: Math.max(22, 26 * scale), borderRadius: 4, background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.max(10, 13 * scale) }}>
                  {OPTION_LABELS[idx]}
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* После ответа */}
      {answered && (
        <div style={{ padding: `${Math.max(8, 10 * scale)}px ${pad}px`, textAlign: 'center', flexShrink: 0 }}>
          {answered.isCorrect ? (
            <div style={{ color: '#4ade80', fontSize: Math.max(12, 16 * scale), fontWeight: 700 }}>
              ✓ Верно! +{answered.points} очков
            </div>
          ) : (
            <div style={{ color: '#f87171', fontSize: Math.max(12, 16 * scale), fontWeight: 700 }}>
              ✗ Неверно
            </div>
          )}
          <div style={{ color: '#a5b4fc', fontSize: Math.max(10, 12 * scale), marginTop: 4 }}>Ожидайте результатов…</div>
        </div>
      )}

      {/* Время вышло, не ответил */}
      {isStarted && !answered && timeLeft === 0 && (
        <div style={{ padding: `${Math.max(8, 10 * scale)}px ${pad}px`, textAlign: 'center', flexShrink: 0, color: '#f87171', fontSize: Math.max(12, 16 * scale), fontWeight: 700 }}>
          ⏰ Время вышло
        </div>
      )}
    </div>
  );
}

// ─── QuizPresenterView (учитель) ──────────────────────────────────────────────

export function QuizPresenterView({
  slide, scale, questionIdx, totalQuestions, isStarted, answeredCount, timeLimitSec, startedAt, onStart, onShowResults,
}: {
  slide: Slide;
  scale: number;
  questionIdx: number;
  totalQuestions: number;
  isStarted: boolean;
  answeredCount: number;
  timeLimitSec: number;
  startedAt: number | null;
  onStart: () => void;
  onShowResults: () => void;
}) {
  const questions = (slide.content as Partial<QuizContent>)?.questions ?? [];
  const q = questions[questionIdx];
  const question = q?.text ?? '';
  const options  = q?.options ?? [];
  const [timeLeft, setTimeLeft] = useState(timeLimitSec);

  useEffect(() => {
    setTimeLeft(timeLimitSec);
  }, [slide.id, questionIdx, timeLimitSec]);

  useEffect(() => {
    if (!isStarted) return;
    const start = startedAt ?? Date.now();
    const end = start + timeLimitSec * 1000;
    const tick = () => setTimeLeft(Math.max(0, Math.round((end - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [isStarted, startedAt, timeLimitSec]);

  const fs = Math.max(11, 13 * scale);
  const fsQ = Math.max(14, 20 * scale);
  const pad = Math.max(10, 14 * scale);
  const timerFrac = isStarted ? timeLeft / timeLimitSec : 1;
  const timerColor = timerFrac > 0.5 ? '#22c55e' : timerFrac > 0.25 ? '#f97316' : '#ef4444';

  return (
    <div style={{ width: CANVAS_W * scale, height: CANVAS_H * scale, background: '#1e1b4b', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
      {/* Прогресс-бар */}
      <div style={{ height: Math.max(4, 6 * scale), background: '#312e81' }}>
        <div style={{ height: '100%', width: `${timerFrac * 100}%`, background: timerColor, transition: 'width 0.2s linear, background 0.5s' }} />
      </div>

      {/* Заголовок */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${Math.max(6, 8 * scale)}px ${pad}px`, flexShrink: 0 }}>
        <span style={{ fontSize: Math.max(9, 11 * scale), color: '#a5b4fc' }}>🏆 Вопрос {questionIdx + 1} / {totalQuestions}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: Math.max(8, 12 * scale) }}>
          <span style={{ color: '#c7d2fe', fontSize: fs }}>Ответили: <strong style={{ color: 'white' }}>{answeredCount}</strong></span>
          {isStarted && (
            <div style={{ width: Math.max(32, 40 * scale), height: Math.max(32, 40 * scale), borderRadius: '50%', background: timerColor + '33', border: `2px solid ${timerColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.max(11, 14 * scale), fontWeight: 700, color: timerColor }}>
              {timeLeft}
            </div>
          )}
        </div>
      </div>

      {/* Вопрос */}
      <div style={{ padding: `0 ${pad}px ${Math.max(8, 12 * scale)}px`, textAlign: 'center', flexShrink: 0 }}>
        <div style={{ color: 'white', fontSize: fsQ, fontWeight: 700, lineHeight: 1.3 }}>
          {question || <span style={{ color: '#6b7280' }}>Вопрос не задан</span>}
        </div>
      </div>

      {/* Варианты (показываем только как плашки) */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: Math.max(6, 8 * scale), padding: `0 ${pad}px`, overflow: 'hidden', alignContent: 'start' }}>
        {options.map((opt, idx) => {
          const color = OPTION_COLORS[idx % OPTION_COLORS.length];
          return (
            <div key={idx} style={{ background: color + 'aa', borderRadius: Math.max(8, 10 * scale), color: 'white', fontSize: fs, fontWeight: 600, display: 'flex', alignItems: 'center', gap: Math.max(6, 8 * scale), padding: `${Math.max(6, 8 * scale)}px ${Math.max(10, 12 * scale)}px`, minHeight: Math.max(36, 44 * scale) }}>
              <span style={{ flexShrink: 0, width: Math.max(20, 24 * scale), height: Math.max(20, 24 * scale), borderRadius: 4, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.max(10, 12 * scale) }}>
                {OPTION_LABELS[idx]}
              </span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{opt}</span>
            </div>
          );
        })}
      </div>

      {/* Кнопки управления */}
      <div style={{ padding: `${Math.max(8, 10 * scale)}px ${pad}px`, display: 'flex', justifyContent: 'center', gap: Math.max(8, 12 * scale), flexShrink: 0 }}>
        {!isStarted ? (
          <button
            onClick={onStart}
            style={{ padding: `${Math.max(6, 8 * scale)}px ${Math.max(16, 24 * scale)}px`, background: '#22c55e', color: 'white', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: fs, cursor: 'pointer' }}
          >
            ▶ Начать вопрос
          </button>
        ) : (
          <button
            onClick={onShowResults}
            style={{ padding: `${Math.max(6, 8 * scale)}px ${Math.max(16, 24 * scale)}px`, background: '#f97316', color: 'white', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: fs, cursor: 'pointer' }}
          >
            Показать результаты
          </button>
        )}
      </div>
    </div>
  );
}

// ─── QuizLeaderboardView (после quiz_show_results) ────────────────────────────

export function QuizLeaderboardView({
  slide, scale, data, isPresenter, hasNextQuestion, onNextQuestion,
}: {
  slide: Slide;
  scale: number;
  data: QuizLeaderboardData;
  isPresenter: boolean;
  hasNextQuestion: boolean;
  onNextQuestion: () => void;
}) {
  const questions = (slide.content as Partial<QuizContent>)?.questions ?? [];
  const q = questions[data.question_idx];
  const options = q?.options ?? [];
  const totalAnswers = Object.values(data.answer_stats).reduce((s, n) => s + n, 0);

  const fs = Math.max(11, 13 * scale);
  const pad = Math.max(10, 14 * scale);

  return (
    <div style={{ width: CANVAS_W * scale, height: CANVAS_H * scale, background: '#1e1b4b', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
      <div style={{ padding: `${Math.max(6, 8 * scale)}px ${pad}px`, textAlign: 'center', flexShrink: 0 }}>
        <div style={{ color: '#a5b4fc', fontSize: Math.max(10, 12 * scale), marginBottom: Math.max(4, 6 * scale) }}>Правильный ответ:</div>
        {options[data.correct_index] !== undefined && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: Math.max(6, 8 * scale), background: '#22c55e', color: 'white', borderRadius: Math.max(6, 8 * scale), padding: `${Math.max(4, 6 * scale)}px ${Math.max(10, 14 * scale)}px`, fontWeight: 700, fontSize: Math.max(12, 16 * scale) }}>
            <span>{OPTION_LABELS[data.correct_index]}</span>
            <span>{options[data.correct_index]}</span>
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: Math.max(6, 8 * scale), padding: `0 ${pad}px`, overflow: 'hidden' }}>
        {/* Статистика по вариантам */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: Math.max(4, 6 * scale), overflowY: 'auto' }}>
          <div style={{ color: '#a5b4fc', fontSize: Math.max(9, 11 * scale), fontWeight: 600, marginBottom: 2 }}>Распределение ответов</div>
          {options.map((opt, idx) => {
            const count = data.answer_stats[String(idx)] ?? 0;
            const frac = totalAnswers > 0 ? count / totalAnswers : 0;
            const color = OPTION_COLORS[idx % OPTION_COLORS.length];
            const isCorrect = idx === data.correct_index;
            return (
              <div key={idx} style={{ background: '#312e81', borderRadius: Math.max(4, 6 * scale), overflow: 'hidden', border: isCorrect ? '2px solid #22c55e' : '2px solid transparent' }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: `${Math.max(3, 4 * scale)}px ${Math.max(6, 8 * scale)}px`, gap: Math.max(4, 6 * scale) }}>
                  <span style={{ flexShrink: 0, width: Math.max(18, 22 * scale), height: Math.max(18, 22 * scale), borderRadius: 4, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.max(9, 11 * scale), color: 'white', fontWeight: 700 }}>{OPTION_LABELS[idx]}</span>
                  <span style={{ flex: 1, color: 'white', fontSize: Math.max(9, 11 * scale), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt}</span>
                  <span style={{ color: '#c7d2fe', fontSize: Math.max(9, 11 * scale), flexShrink: 0 }}>{count}</span>
                </div>
                <div style={{ height: Math.max(3, 4 * scale), background: '#1e1b4b' }}>
                  <div style={{ height: '100%', width: `${frac * 100}%`, background: isCorrect ? '#22c55e' : color, transition: 'width 0.5s' }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Рейтинг */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: Math.max(3, 4 * scale), overflowY: 'auto' }}>
          <div style={{ color: '#a5b4fc', fontSize: Math.max(9, 11 * scale), fontWeight: 600, marginBottom: 2 }}>Текущий рейтинг</div>
          {data.leaderboard.slice(0, 10).map((entry, i) => (
            <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: Math.max(4, 6 * scale), background: i < 3 ? '#312e81' : '#27244e', borderRadius: Math.max(4, 6 * scale), padding: `${Math.max(3, 5 * scale)}px ${Math.max(6, 8 * scale)}px`, border: i === 0 ? '1px solid #fbbf24' : 'none' }}>
              <span style={{ flexShrink: 0, fontSize: Math.max(11, 14 * scale), width: Math.max(20, 24 * scale), textAlign: 'center' }}>{i < 3 ? MEDALS[i] : `${i + 1}.`}</span>
              <span style={{ flex: 1, color: 'white', fontSize: fs, fontWeight: i < 3 ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}</span>
              <span style={{ flexShrink: 0, color: '#fbbf24', fontWeight: 700, fontSize: fs }}>{entry.points}</span>
            </div>
          ))}
          {data.leaderboard.length === 0 && (
            <div style={{ color: '#6b7280', fontSize: fs, textAlign: 'center', padding: 16 }}>Никто не ответил</div>
          )}
        </div>
      </div>

      <div style={{ padding: `${Math.max(4, 6 * scale)}px`, textAlign: 'center', flexShrink: 0, color: '#6b7280', fontSize: Math.max(9, 11 * scale) }}>
        Всего ответов: {totalAnswers}
      </div>

      {isPresenter && (
        <div style={{ padding: `${Math.max(4, 8 * scale)}px ${Math.max(10, 14 * scale)}px`, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          {hasNextQuestion ? (
            <button
              onClick={onNextQuestion}
              style={{ padding: `${Math.max(6, 8 * scale)}px ${Math.max(16, 24 * scale)}px`, background: '#6366f1', color: 'white', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: Math.max(11, 13 * scale), cursor: 'pointer' }}
            >
              Следующий вопрос →
            </button>
          ) : (
            <span style={{ color: '#a5b4fc', fontSize: Math.max(10, 12 * scale), fontWeight: 600 }}>🏆 Викторина завершена</span>
          )}
        </div>
      )}
    </div>
  );
}
