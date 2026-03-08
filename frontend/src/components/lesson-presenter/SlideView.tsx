import type {
  Slide, SlideBlock, User,
  FormResults, FormAnswerValue,
  VocabContent, QuizLeaderboardData,
} from '../../types';
import type { QuizContent } from '../../types';
import VideoSlideView from './VideoSlideView';
import { FormAnswerView, FormResultsView } from './FormViews';
import { QuizAnswerView, QuizPresenterView, QuizLeaderboardView } from './QuizViews';
import VocabStudentView from './VocabStudentView';
import VocabTeacherView from './VocabTeacherView';
import DiscussionSlideView from './DiscussionSlideView';
import TextbookSlideView from './TextbookSlideView';

const CANVAS_W = 960;
const CANVAS_H = 540;

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

export default function SlideView({
  slide, scale, isPresenter, user, sessionId,
  formResults, onFormSubmit, formSubmitted, formAnswers,
  onVideoControl, videoControl,
  quizStarted, quizAnswered, quizAnsweredCount, quizLeaderboard, quizCurrentQuestion,
  onQuizStart, onQuizShowResults, onQuizAnswer, onQuizNextQuestion,
}: {
  slide: Slide;
  scale: number;
  isPresenter: boolean;
  user: User | null;
  sessionId: number;
  formResults: Record<number, FormResults>;
  onFormSubmit: (slideId: number, answers: FormAnswerValue[]) => void;
  formSubmitted: Record<number, boolean>;
  formAnswers: Record<number, FormAnswerValue[]>;
  onVideoControl: (action: string) => void;
  videoControl: { action: string; ts: number } | null;
  quizStarted: { slideId: number; questionIdx: number; timeLimitSec: number; startedAt: number } | null;
  quizAnswered: Record<string, { optionIndex: number; points: number; isCorrect: boolean }>;
  quizAnsweredCount: Record<string, number>;
  quizLeaderboard: Record<string, QuizLeaderboardData>;
  quizCurrentQuestion: Record<number, number>;
  onQuizStart: (slideId: number, questionIdx: number) => void;
  onQuizShowResults: (slideId: number, questionIdx: number) => void;
  onQuizAnswer: (slideId: number, questionIdx: number, optionIndex: number, elapsedMs: number) => void;
  onQuizNextQuestion: (slideId: number) => void;
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

  if (slide.slide_type === 'quiz') {
    const questions = (slide.content as Partial<QuizContent>)?.questions ?? [];
    const totalQuestions = questions.length;

    if (isPresenter) {
      const currentQIdx = quizCurrentQuestion[slide.id] ?? 0;
      const lbKey = `${slide.id}_${currentQIdx}`;
      const isCurrentStarted = quizStarted?.slideId === slide.id && quizStarted?.questionIdx === currentQIdx;
      const defaultTimeLimit = questions[currentQIdx]?.time_limit ?? 30;

      if (quizLeaderboard[lbKey]) {
        return (
          <QuizLeaderboardView
            slide={slide} scale={scale}
            data={quizLeaderboard[lbKey]}
            isPresenter={true}
            hasNextQuestion={currentQIdx + 1 < totalQuestions}
            onNextQuestion={() => onQuizNextQuestion(slide.id)}
          />
        );
      }
      return (
        <QuizPresenterView
          slide={slide} scale={scale}
          questionIdx={currentQIdx}
          totalQuestions={totalQuestions}
          isStarted={isCurrentStarted}
          answeredCount={quizAnsweredCount[lbKey] ?? 0}
          timeLimitSec={isCurrentStarted ? quizStarted!.timeLimitSec : defaultTimeLimit}
          startedAt={isCurrentStarted ? quizStarted!.startedAt : null}
          onStart={() => onQuizStart(slide.id, currentQIdx)}
          onShowResults={() => onQuizShowResults(slide.id, currentQIdx)}
        />
      );
    }

    // Студент
    const activeQIdx = quizStarted?.slideId === slide.id ? quizStarted.questionIdx : null;
    if (activeQIdx !== null) {
      const lbKey = `${slide.id}_${activeQIdx}`;
      if (quizLeaderboard[lbKey]) {
        return (
          <QuizLeaderboardView
            slide={slide} scale={scale}
            data={quizLeaderboard[lbKey]}
            isPresenter={false}
            hasNextQuestion={false}
            onNextQuestion={() => {}}
          />
        );
      }
      return (
        <QuizAnswerView
          slide={slide} scale={scale}
          questionIdx={activeQIdx}
          isStarted={true}
          timeLimitSec={quizStarted!.timeLimitSec}
          startedAt={quizStarted!.startedAt}
          answered={quizAnswered[lbKey] ?? null}
          onAnswer={(optIdx, elapsedMs) => onQuizAnswer(slide.id, activeQIdx, optIdx, elapsedMs)}
        />
      );
    }
    // Ожидание вопроса
    return (
      <QuizAnswerView
        slide={slide} scale={scale}
        questionIdx={0}
        isStarted={false}
        timeLimitSec={questions[0]?.time_limit ?? 30}
        startedAt={null}
        answered={null}
        onAnswer={() => {}}
      />
    );
  }

  if (slide.slide_type === 'vocab' && user) {
    const vocabContent = slide.content as unknown as VocabContent;
    if (isPresenter) {
      return (
        <div style={{ width: CANVAS_W * scale, height: CANVAS_H * scale, overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
            <VocabTeacherView slide={slide} sessionId={sessionId} content={vocabContent} />
          </div>
        </div>
      );
    }
    return (
      <div style={{ width: CANVAS_W * scale, height: CANVAS_H * scale, overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          <VocabStudentView slide={slide} sessionId={sessionId} content={vocabContent} />
        </div>
      </div>
    );
  }

  if (slide.slide_type === 'discussion' && user) {
    return <DiscussionSlideView slide={slide} scale={scale} user={user} sessionId={sessionId} />;
  }

  if (slide.slide_type === 'textbook') {
    return (
      <TextbookSlideView
        slide={slide}
        isPresenter={isPresenter}
        sessionId={sessionId}
      />
    );
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
