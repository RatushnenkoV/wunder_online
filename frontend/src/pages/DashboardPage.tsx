import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';
import type { TopicByDate, ScheduleLesson, Substitution, ParentChild, Task } from '../types';

// ── Баннер срочных задач ──────────────────────────────────────────────────────

function UrgentTasksBanner() {
  const navigate = useNavigate();
  const [urgentTasks, setUrgentTasks] = useState<Task[]>([]);

  useEffect(() => {
    api.get('/tasks/tasks/', { params: { page_size: 100 } })
      .then(res => {
        const all: Task[] = Array.isArray(res.data) ? res.data : (res.data.results ?? []);
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowISO = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

        const urgent = all.filter(t => {
          if (t.status === 'done') return false;
          if (t.priority === 'high') return true;
          if (t.due_date && t.due_date <= tomorrowISO) return true;
          return false;
        });
        setUrgentTasks(urgent);
      })
      .catch(() => {});
  }, []);

  if (urgentTasks.length === 0) return null;

  const PRIORITY_CLS: Record<string, string> = {
    high: 'border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950/30 dark:text-red-300',
    medium: 'border-yellow-300 bg-yellow-50 text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-300',
    low: 'border-gray-200 bg-gray-50 text-gray-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300',
  };

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
          Требуют внимания
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {urgentTasks.map(task => (
          <button
            key={task.id}
            onClick={() => navigate('/tasks')}
            className={`flex-shrink-0 border rounded-xl px-4 py-2.5 text-left max-w-[240px] hover:shadow-md transition-shadow ${PRIORITY_CLS[task.priority] ?? PRIORITY_CLS.low}`}
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              {task.priority === 'high' && (
                <span className="text-[10px] font-bold uppercase tracking-wide opacity-70">Срочно</span>
              )}
              {task.due_date && task.priority !== 'high' && (
                <span className="text-[10px] font-bold uppercase tracking-wide opacity-70">Дедлайн</span>
              )}
            </div>
            <div className="text-sm font-medium truncate">{task.title}</div>
            {task.due_date && (
              <div className="text-xs opacity-60 mt-0.5">
                до {new Date(task.due_date + 'T00:00:00').toLocaleDateString('ru', { day: 'numeric', month: 'short' })}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────

function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayISO(): string {
  return toLocalISO(new Date());
}

function formatDateRu(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  return `${d.getDate()} ${months[d.getMonth()]}, ${days[d.getDay()]}`;
}

// ── Teacher dashboard ─────────────────────────────────────────────────────────

type SlotStatus = 'normal' | 'sub_as_teacher' | 'replaced' | 'covering';

interface TeacherSlot {
  lessonNumber: number;
  lesson: ScheduleLesson | null;
  sub: Substitution | null;
  status: SlotStatus;
  topic: TopicByDate | null;
}

function SlotCard({ slot, onNavigate }: { slot: TeacherSlot; onNavigate: (ctpId: number) => void }) {
  const { lessonNumber, lesson, sub, status, topic } = slot;
  const isReplaced = status === 'replaced';
  const canNavigate = !!topic && !isReplaced;

  const displayClass = lesson?.class_name ?? sub?.class_name ?? '';
  const displayGroup = lesson?.group_name ?? sub?.group_name;
  const displaySubject = sub && status !== 'replaced'
    ? sub.subject_name
    : (lesson?.subject_name ?? sub?.subject_name ?? '');
  const displayRoom = (sub && status !== 'replaced') ? sub.room_name : lesson?.room_name;

  const cardBg = isReplaced
    ? 'bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700 opacity-70'
    : status !== 'normal'
    ? 'bg-amber-50 border-amber-200'
    : 'bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700 shadow-sm';

  const hoverClass = canNavigate
    ? 'cursor-pointer hover:border-purple-300 hover:shadow-md transition-shadow'
    : '';

  return (
    <div
      className={`rounded-xl border ${cardBg} ${hoverClass}`}
      onClick={canNavigate ? () => onNavigate(topic!.ctp_id) : undefined}
    >
      <div className="px-4 py-3 flex items-start gap-3">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5 ${
          isReplaced ? 'bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-slate-500' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400'
        }`}>
          {lessonNumber}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {status !== 'normal' && (
              <span className={`text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-full ${
                isReplaced
                  ? 'bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
                  : 'bg-amber-200 text-amber-800'
              }`}>
                {isReplaced ? 'ЗАМЕНЁН' : 'ЗАМЕНА'}
              </span>
            )}
            <span className={`text-sm font-semibold ${isReplaced ? 'text-gray-400 dark:text-slate-500' : 'text-gray-900 dark:text-slate-100'}`}>
              {displayClass}
            </span>
            {displayGroup && (
              <span className="text-xs text-purple-500">({displayGroup})</span>
            )}
            {displayRoom && (
              <span className="text-xs text-gray-400 dark:text-slate-500 ml-auto">каб. {displayRoom}</span>
            )}
          </div>

          <div className={`text-sm mt-0.5 ${isReplaced ? 'line-through text-gray-400 dark:text-slate-500' : 'text-gray-700 dark:text-slate-300'}`}>
            {displaySubject}
          </div>

          {status === 'sub_as_teacher' && sub?.original_subject_name && (
            <div className="text-xs text-amber-600 mt-0.5">
              вместо: {sub.original_subject_name}
              {sub.original_teacher_name ? ` (${sub.original_teacher_name})` : ''}
            </div>
          )}
          {status === 'covering' && (
            <div className="text-xs text-amber-600 mt-0.5">
              {sub?.original_teacher_name ? `вместо ${sub.original_teacher_name}` : 'дополнительный урок'}
            </div>
          )}
          {isReplaced && (
            <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
              ведёт: {sub?.teacher_name ?? '—'}
            </div>
          )}
        </div>
      </div>

      {!isReplaced && (
        <div className={`px-4 py-2 border-t ${status === 'normal' ? 'border-gray-100 dark:border-slate-700' : 'border-amber-100'} flex items-center gap-2`}>
          <svg
            xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={topic ? 'text-purple-400' : 'text-gray-300 dark:text-slate-600'}
          >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
          {topic ? (
            <span className="text-sm text-purple-600 truncate">{topic.title}</span>
          ) : (
            <span className="text-sm text-gray-400 dark:text-slate-500 italic">Тема не найдена</span>
          )}
          {topic && (
            <svg
              xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="text-purple-300 ml-auto flex-shrink-0"
            >
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          )}
        </div>
      )}
    </div>
  );
}

function TeacherDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [date, setDate] = useState(todayISO);
  const [slots, setSlots] = useState<TeacherSlot[]>([]);
  const [loading, setLoading] = useState(true);

  const shiftDate = (days: number) => {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + days);
    setDate(toLocalISO(d));
  };

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    Promise.all([
      api.get('/school/schedule/all/'),
      api.get('/school/substitutions/', { params: { date_from: date, date_to: date } }),
      api.get(`/ktp/topics-by-date/?date=${date}`),
    ]).then(([lessonsRes, subsRes, topicsRes]) => {
      const allLessons: ScheduleLesson[] = lessonsRes.data;
      const todaySubs: Substitution[] = subsRes.data;
      const allTopics: TopicByDate[] = topicsRes.data;

      const weekday = new Date(date + 'T00:00:00').getDay();
      const myLessons = allLessons.filter(l => l.teacher === user.id && l.weekday === weekday);
      const myTopics = allTopics.filter(t => t.ctp_teacher_id === user.id);

      const findTopic = (classId: number, subjectName: string): TopicByDate | null =>
        myTopics.find(t => t.class_id === classId && t.subject_name === subjectName) ?? null;

      const result: TeacherSlot[] = [];
      const processedSubIds = new Set<number>();

      for (const lesson of myLessons) {
        const sub = todaySubs.find(s => s.original_lesson === lesson.id) ?? null;
        let status: SlotStatus;
        let topic: TopicByDate | null = null;

        if (sub) {
          processedSubIds.add(sub.id);
          if (sub.teacher === user.id) {
            status = 'sub_as_teacher';
            topic = findTopic(sub.school_class, sub.subject_name);
          } else {
            status = 'replaced';
          }
        } else {
          status = 'normal';
          topic = findTopic(lesson.school_class, lesson.subject_name);
        }

        result.push({ lessonNumber: lesson.lesson_number, lesson, sub, status, topic });
      }

      const coveringSubs = todaySubs.filter(s => s.teacher === user.id && !processedSubIds.has(s.id));
      for (const sub of coveringSubs) {
        const topic = findTopic(sub.school_class, sub.subject_name);
        result.push({ lessonNumber: sub.lesson_number, lesson: null, sub, status: 'covering', topic });
      }

      result.sort((a, b) => a.lessonNumber - b.lessonNumber);
      setSlots(result);
    }).finally(() => setLoading(false));
  }, [date, user]);

  const isToday = date === todayISO();

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => shiftDate(-1)}
          className="p-2 rounded hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400"
          title="Предыдущий день"
        >
          ←
        </button>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold capitalize">{formatDateRu(date)}</h2>
          <input
            type="date"
            value={date}
            onChange={e => e.target.value && setDate(e.target.value)}
            className="border rounded px-2 py-1 text-sm text-gray-500 dark:text-slate-400 w-36"
          />
        </div>
        <button
          onClick={() => shiftDate(1)}
          className="p-2 rounded hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400"
          title="Следующий день"
        >
          →
        </button>
        {!isToday && (
          <button
            onClick={() => setDate(todayISO())}
            className="text-sm text-purple-600 hover:text-purple-800 ml-1"
          >
            Сегодня
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl h-20 animate-pulse" />
          ))}
        </div>
      ) : slots.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm p-8 text-center">
          <p className="text-gray-400 dark:text-slate-500">Нет уроков на этот день</p>
        </div>
      ) : (
        <div className="space-y-2">
          {slots.map((slot, i) => (
            <SlotCard
              key={i}
              slot={slot}
              onNavigate={ctpId => navigate(`/ktp/${ctpId}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Student schedule dashboard (для главной страницы студента) ────────────────

interface StudentSlot {
  lessonNumber: number;
  lesson: ScheduleLesson | null;
  sub: Substitution | null;
  status: 'normal' | 'replaced' | 'added';
  topic: TopicByDate | null;
}

function StudentSlotCard({ slot }: { slot: StudentSlot }) {
  const { lessonNumber, lesson, sub, status, topic } = slot;
  const [expanded, setExpanded] = useState(false);

  const isReplaced = status === 'replaced';
  const isAdded    = status === 'added';
  const hasChange  = isReplaced || isAdded;

  const displaySubject = sub ? sub.subject_name : (lesson?.subject_name ?? '');
  const displayTeacher = sub ? sub.teacher_name : lesson?.teacher_name;
  const displayRoom    = sub ? sub.room_name    : lesson?.room_name;

  const subjectChanged = isReplaced && !!sub && !!lesson && sub.subject_name !== lesson.subject_name;
  const teacherChanged = isReplaced && !!sub && !!lesson && sub.teacher_name !== lesson.teacher_name;

  const hasDetails = !!(
    topic?.homework ||
    (topic?.resources?.length ?? 0) > 0 ||
    (topic?.files?.length ?? 0) > 0
  );

  const cardBg = hasChange
    ? 'bg-amber-50 border-amber-200'
    : 'bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700 shadow-sm';

  return (
    <div className={`rounded-xl border ${cardBg}`}>
      <div className="px-4 py-3 flex items-start gap-3">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5 ${
          hasChange ? 'bg-amber-200 text-amber-700' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400'
        }`}>
          {lessonNumber}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {hasChange && (
              <span className="text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">
                ЗАМЕНА
              </span>
            )}
            <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">{displaySubject}</span>
            {displayRoom && (
              <span className="text-xs text-gray-400 dark:text-slate-500 ml-auto">каб. {displayRoom}</span>
            )}
          </div>
          {displayTeacher && (
            <div className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{displayTeacher}</div>
          )}
          {subjectChanged && (
            <div className="text-xs text-amber-600 mt-0.5">вместо: {lesson!.subject_name}</div>
          )}
          {teacherChanged && !subjectChanged && (
            <div className="text-xs text-amber-600 mt-0.5">вместо: {lesson!.teacher_name ?? '—'}</div>
          )}
        </div>
      </div>

      {!isAdded && (
        <button
          disabled={!hasDetails}
          onClick={() => hasDetails && setExpanded(e => !e)}
          className={`w-full px-4 py-2 border-t ${hasChange ? 'border-amber-100' : 'border-gray-100 dark:border-slate-700'} flex items-center gap-2 ${hasDetails ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800' : 'cursor-default'}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={topic ? 'text-purple-400' : 'text-gray-300 dark:text-slate-600'}
          >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
          {topic ? (
            <span className="text-sm text-purple-600 truncate flex-1 text-left">{topic.title}</span>
          ) : (
            <span className="text-sm text-gray-400 dark:text-slate-500 italic">Тема не указана</span>
          )}
          {hasDetails && (
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={`text-purple-300 flex-shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
            >
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          )}
        </button>
      )}

      {expanded && hasDetails && (
        <div className="px-4 pb-3 border-t border-gray-100 dark:border-slate-700 space-y-3 pt-3">
          {topic!.homework && (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1">Домашнее задание</label>
              <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap">{topic!.homework}</p>
            </div>
          )}
          {(topic!.resources?.length ?? 0) > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1">Материалы</label>
              <ul className="space-y-1">
                {topic!.resources.map((r, i) => (
                  <li key={i}>
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-sm text-purple-600 hover:underline">
                      {r.title || r.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(topic!.files?.length ?? 0) > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1">Файлы</label>
              <ul className="space-y-1">
                {topic!.files.map(f => (
                  <li key={f.id}>
                    <a href={f.file} target="_blank" rel="noopener noreferrer" className="text-sm text-purple-600 hover:underline">
                      {f.original_name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StudentScheduleDashboard() {
  const { user } = useAuth();
  const [date, setDate] = useState(todayISO);
  const [slots, setSlots] = useState<StudentSlot[]>([]);
  const [loading, setLoading] = useState(true);

  const classId = user?.school_class_id ?? null;

  const shiftDate = (days: number) => {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + days);
    setDate(toLocalISO(d));
  };

  useEffect(() => {
    if (!classId) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      api.get('/school/schedule/', { params: { school_class: classId } }),
      api.get('/school/substitutions/', { params: { date_from: date, date_to: date } }),
      api.get(`/ktp/topics-by-date/?date=${date}`),
    ]).then(([schedRes, subsRes, topicsRes]) => {
      const allLessons: ScheduleLesson[] = schedRes.data;
      const allSubs: Substitution[]      = subsRes.data;
      const allTopics: TopicByDate[]     = topicsRes.data;

      const weekday    = new Date(date + 'T00:00:00').getDay();
      const dayLessons = allLessons.filter(l => l.weekday === weekday);
      const classSubs  = allSubs.filter(s => s.school_class === classId);

      const findTopic = (subjectName: string): TopicByDate | null =>
        allTopics.find(t => t.subject_name === subjectName) ?? null;

      const result: StudentSlot[] = [];
      const processedSubIds = new Set<number>();

      for (const lesson of dayLessons) {
        const sub = classSubs.find(s => s.original_lesson === lesson.id) ?? null;
        if (sub) processedSubIds.add(sub.id);
        const effectiveSubject = sub ? sub.subject_name : lesson.subject_name;
        result.push({
          lessonNumber: lesson.lesson_number,
          lesson,
          sub,
          status: sub ? 'replaced' : 'normal',
          topic: findTopic(effectiveSubject),
        });
      }

      // Дополнительные замены без исходного урока (добавленные уроки)
      for (const sub of classSubs) {
        if (!processedSubIds.has(sub.id)) {
          result.push({
            lessonNumber: sub.lesson_number,
            lesson: null,
            sub,
            status: 'added',
            topic: findTopic(sub.subject_name),
          });
        }
      }

      result.sort((a, b) => a.lessonNumber - b.lessonNumber);
      setSlots(result);
    }).finally(() => setLoading(false));
  }, [date, classId]); // eslint-disable-line

  const isToday = date === todayISO();

  if (!classId) {
    return <p className="text-gray-400 dark:text-slate-500 py-8 text-center">Класс не указан в профиле</p>;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => shiftDate(-1)} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400" title="Предыдущий день">←</button>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold capitalize">{formatDateRu(date)}</h2>
          <input
            type="date" value={date}
            onChange={e => e.target.value && setDate(e.target.value)}
            className="border rounded px-2 py-1 text-sm text-gray-500 dark:text-slate-400 w-36"
          />
        </div>
        <button onClick={() => shiftDate(1)} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400" title="Следующий день">→</button>
        {!isToday && (
          <button onClick={() => setDate(todayISO())} className="text-sm text-purple-600 hover:text-purple-800 ml-1">Сегодня</button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl h-20 animate-pulse" />)}
        </div>
      ) : slots.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm p-8 text-center">
          <p className="text-gray-400 dark:text-slate-500">Нет уроков на этот день</p>
        </div>
      ) : (
        <div className="space-y-2">
          {slots.map((slot, i) => <StudentSlotCard key={i} slot={slot} />)}
        </div>
      )}
    </div>
  );
}

// ── Student topics dashboard (для родителей) ──────────────────────────────────

function StudentDashboard({ studentId }: { studentId?: number } = {}) {
  const [date, setDate] = useState(() => todayISO());
  const [topics, setTopics] = useState<TopicByDate[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const url = studentId
      ? `/ktp/topics-by-date/?date=${date}&student_id=${studentId}`
      : `/ktp/topics-by-date/?date=${date}`;
    api.get(url)
      .then(res => { setTopics(res.data); setExpandedId(null); })
      .finally(() => setLoading(false));
  }, [date, studentId]);

  const shiftDate = (days: number) => {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + days);
    setDate(toLocalISO(d));
  };

  const isToday = date === todayISO();
  const hasDetails = (t: TopicByDate) => t.homework || t.resources.length > 0 || t.files.length > 0;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => shiftDate(-1)} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400" title="Предыдущий день">&#8592;</button>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold capitalize">{formatDateRu(date)}</h2>
          <input
            type="date"
            value={date}
            onChange={e => e.target.value && setDate(e.target.value)}
            className="border rounded px-2 py-1 text-sm text-gray-500 dark:text-slate-400 w-36"
          />
        </div>
        <button onClick={() => shiftDate(1)} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400" title="Следующий день">&#8594;</button>
        {!isToday && (
          <button onClick={() => setDate(todayISO())} className="text-sm text-purple-600 hover:text-purple-800 ml-1">Сегодня</button>
        )}
      </div>

      {loading ? (
        <p className="text-gray-400 dark:text-slate-500 text-center py-8">Загрузка...</p>
      ) : topics.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-8 text-center">
          <p className="text-gray-400 dark:text-slate-500">Нет тем на этот день</p>
        </div>
      ) : (
        <div className="space-y-2">
          {topics.map(topic => (
            <div key={topic.id} className="bg-white dark:bg-slate-800 rounded-lg shadow">
              <button
                onClick={() => hasDetails(topic) ? setExpandedId(expandedId === topic.id ? null : topic.id) : undefined}
                className={`w-full text-left px-4 py-3 flex items-center gap-3 ${hasDetails(topic) ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800' : 'cursor-default'}`}
              >
                <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded shrink-0">{topic.subject_name}</span>
                <span className="text-sm text-gray-800 dark:text-slate-200 flex-1">{topic.title}</span>
                {hasDetails(topic) && (
                  <span className={`text-gray-400 dark:text-slate-500 text-xs transition-transform ${expandedId === topic.id ? 'rotate-90' : ''}`}>&#9654;</span>
                )}
              </button>

              {expandedId === topic.id && hasDetails(topic) && (
                <div className="px-4 pb-3 border-t space-y-3 pt-3">
                  {topic.homework && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1">Домашнее задание</label>
                      <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap">{topic.homework}</p>
                    </div>
                  )}
                  {topic.resources.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1">Материалы</label>
                      <ul className="space-y-1">
                        {topic.resources.map((r, i) => (
                          <li key={i}>
                            <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-sm text-purple-600 hover:text-purple-800 hover:underline">
                              {r.title || r.url}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {topic.files.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1">Файлы</label>
                      <ul className="space-y-1">
                        {topic.files.map(f => (
                          <li key={f.id}>
                            <a href={f.file} target="_blank" rel="noopener noreferrer" className="text-sm text-purple-600 hover:text-purple-800 hover:underline">
                              {f.original_name}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Parent dashboard ──────────────────────────────────────────────────────────

function ParentDashboard() {
  const { user } = useAuth();
  const children: ParentChild[] = user?.children ?? [];
  const [activeChildId, setActiveChildId] = useState<number | null>(
    children.length > 0 ? children[0].id : null
  );

  if (children.length === 0) {
    return <p className="text-gray-400 dark:text-slate-500 py-8 text-center">Нет привязанных учеников</p>;
  }

  return (
    <div>
      {children.length > 1 && (
        <div className="flex gap-1 border-b mb-6">
          {children.map(c => (
            <button
              key={c.id}
              onClick={() => setActiveChildId(c.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
                activeChildId === c.id
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700'
              }`}
            >
              {c.last_name} {c.first_name}
              <span className="ml-1.5 text-xs text-gray-400 dark:text-slate-500">({c.school_class_name})</span>
            </button>
          ))}
        </div>
      )}
      {activeChildId && <StudentDashboard studentId={activeChildId} />}
    </div>
  );
}

// ── Admin quick-access dashboard ──────────────────────────────────────────────

const ALL_QUICK_ACCESS_OPTIONS = [
  { to: '/news', label: 'Новости', description: 'Лента новостей' },
  { to: '/schedule', label: 'Расписание', description: 'Расписание уроков' },
  { to: '/tasks', label: 'Задачи', description: 'Менеджер задач' },
  { to: '/chats', label: 'Чаты', description: 'Мессенджер' },
  { to: '/projects', label: 'Проекты', description: 'Проекты класса' },
  { to: '/requests', label: 'Заявки', description: 'АХО / ИТ заявки' },
  { to: '/ktp', label: 'КТП', description: 'Тематическое планирование' },
  { to: '/lessons', label: 'Уроки', description: 'Библиотека уроков' },
  { to: '/yellow-list', label: 'Жёлтый список', description: 'Отчёты СППС' },
  { to: '/school', label: 'Ученики', description: 'Управление учениками' },
  { to: '/people', label: 'Сотрудники', description: 'Управление сотрудниками' },
  { to: '/settings', label: 'Настройки', description: 'Параметры системы' },
];

interface QuickItem { to: string; label: string }

function AdminDashboard() {
  const { user } = useAuth();
  const storageKey = `quickaccess:${user?.id}`;

  const [items, setItems] = useState<QuickItem[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [showManage, setShowManage] = useState(false);

  const save = (next: QuickItem[]) => {
    setItems(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  };

  const addItem = (item: QuickItem) => {
    if (items.length >= 5 || items.some(i => i.to === item.to)) return;
    save([...items, item]);
  };

  const removeItem = (to: string) => save(items.filter(i => i.to !== to));

  const moveItem = (from: number, direction: -1 | 1) => {
    const to = from + direction;
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    [next[from], next[to]] = [next[to], next[from]];
    save(next);
  };

  const available = ALL_QUICK_ACCESS_OPTIONS.filter(o => !items.some(i => i.to === o.to));

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        {items.map(item => (
          <Link
            key={item.to}
            to={item.to}
            className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-purple-300 dark:hover:border-purple-600 transition"
          >
            <h2 className="text-lg font-semibold text-purple-600 dark:text-purple-400">{item.label}</h2>
          </Link>
        ))}
        {items.length < 5 && (
          <button
            onClick={() => setShowManage(true)}
            className="bg-white dark:bg-slate-800 p-6 rounded-xl border-2 border-dashed border-gray-300 dark:border-slate-600 hover:border-purple-400 dark:hover:border-purple-500 transition flex flex-col items-center justify-center gap-2 text-gray-400 dark:text-slate-500 hover:text-purple-500 dark:hover:text-purple-400 min-h-[96px]"
          >
            <span className="text-3xl font-light leading-none">+</span>
            <span className="text-sm">Добавить пункт быстрого доступа</span>
          </button>
        )}
      </div>

      <div className="flex justify-end mt-2">
        <button
          onClick={() => setShowManage(true)}
          className="flex items-center gap-1.5 text-sm text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Настроить
        </button>
      </div>

      {showManage && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowManage(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">Быстрый доступ</h3>
              <button onClick={() => setShowManage(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Current items */}
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                  Текущие пункты ({items.length}/5)
                </p>
                {items.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-slate-500 italic">Список пуст</p>
                ) : (
                  <div className="space-y-1.5">
                    {items.map((item, idx) => (
                      <div key={item.to} className="flex items-center gap-2 bg-gray-50 dark:bg-slate-700 rounded-lg px-3 py-2">
                        <div className="flex flex-col gap-0">
                          <button
                            onClick={() => moveItem(idx, -1)}
                            disabled={idx === 0}
                            className="text-gray-400 dark:text-slate-500 hover:text-gray-600 disabled:opacity-25 text-[10px] leading-none px-0.5"
                            title="Вверх"
                          >▲</button>
                          <button
                            onClick={() => moveItem(idx, 1)}
                            disabled={idx === items.length - 1}
                            className="text-gray-400 dark:text-slate-500 hover:text-gray-600 disabled:opacity-25 text-[10px] leading-none px-0.5"
                            title="Вниз"
                          >▼</button>
                        </div>
                        <span className="flex-1 text-sm font-medium text-gray-800 dark:text-slate-200">{item.label}</span>
                        <button
                          onClick={() => removeItem(item.to)}
                          className="text-sm text-red-400 hover:text-red-600 transition-colors"
                        >
                          Удалить
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add items */}
              {items.length < 5 && available.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                    Добавить
                  </p>
                  <div className="space-y-0.5">
                    {available.map(opt => (
                      <button
                        key={opt.to}
                        onClick={() => addItem(opt)}
                        className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-purple-50 dark:hover:bg-purple-900/20 text-gray-700 dark:text-slate-300 hover:text-purple-700 dark:hover:text-purple-400 flex items-center justify-between transition-colors"
                      >
                        <span className="font-medium">{opt.label}</span>
                        <span className="text-xs text-gray-400 dark:text-slate-500">{opt.description}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  if (user.is_student) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Добро пожаловать, {user.first_name}!</h1>
        <StudentScheduleDashboard />
      </div>
    );
  }

  if (user.is_parent) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Добро пожаловать, {user.first_name}!</h1>
        <ParentDashboard />
      </div>
    );
  }

  if (user.is_teacher) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Добро пожаловать, {user.first_name}!</h1>
        <UrgentTasksBanner />
        <TeacherDashboard />
      </div>
    );
  }

  // Admin (non-teacher) view — configurable quick access
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Добро пожаловать, {user.first_name}!</h1>
      <UrgentTasksBanner />
      <AdminDashboard />
    </div>
  );
}
