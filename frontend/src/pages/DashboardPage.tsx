import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';
import type { TopicByDate, ScheduleLesson, Substitution, ParentChild } from '../types';

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
    ? 'bg-gray-50 border-gray-200 opacity-70'
    : status !== 'normal'
    ? 'bg-amber-50 border-amber-200'
    : 'bg-white border-gray-100 shadow-sm';

  const hoverClass = canNavigate
    ? 'cursor-pointer hover:border-blue-300 hover:shadow-md transition-shadow'
    : '';

  return (
    <div
      className={`rounded-xl border ${cardBg} ${hoverClass}`}
      onClick={canNavigate ? () => onNavigate(topic!.ctp_id) : undefined}
    >
      <div className="px-4 py-3 flex items-start gap-3">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5 ${
          isReplaced ? 'bg-gray-200 text-gray-400' : 'bg-gray-100 text-gray-600'
        }`}>
          {lessonNumber}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {status !== 'normal' && (
              <span className={`text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-full ${
                isReplaced
                  ? 'bg-gray-200 text-gray-500'
                  : 'bg-amber-200 text-amber-800'
              }`}>
                {isReplaced ? 'ЗАМЕНЁН' : 'ЗАМЕНА'}
              </span>
            )}
            <span className={`text-sm font-semibold ${isReplaced ? 'text-gray-400' : 'text-gray-900'}`}>
              {displayClass}
            </span>
            {displayGroup && (
              <span className="text-xs text-blue-500">({displayGroup})</span>
            )}
            {displayRoom && (
              <span className="text-xs text-gray-400 ml-auto">каб. {displayRoom}</span>
            )}
          </div>

          <div className={`text-sm mt-0.5 ${isReplaced ? 'line-through text-gray-400' : 'text-gray-700'}`}>
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
            <div className="text-xs text-gray-400 mt-0.5">
              ведёт: {sub?.teacher_name ?? '—'}
            </div>
          )}
        </div>
      </div>

      {!isReplaced && (
        <div className={`px-4 py-2 border-t ${status === 'normal' ? 'border-gray-100' : 'border-amber-100'} flex items-center gap-2`}>
          <svg
            xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={topic ? 'text-blue-400' : 'text-gray-300'}
          >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
          {topic ? (
            <span className="text-sm text-blue-600 truncate">{topic.title}</span>
          ) : (
            <span className="text-sm text-gray-400 italic">Тема не найдена</span>
          )}
          {topic && (
            <svg
              xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="text-blue-300 ml-auto flex-shrink-0"
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
          className="p-2 rounded hover:bg-gray-100 text-gray-500"
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
            className="border rounded px-2 py-1 text-sm text-gray-500 w-36"
          />
        </div>
        <button
          onClick={() => shiftDate(1)}
          className="p-2 rounded hover:bg-gray-100 text-gray-500"
          title="Следующий день"
        >
          →
        </button>
        {!isToday && (
          <button
            onClick={() => setDate(todayISO())}
            className="text-sm text-blue-600 hover:text-blue-800 ml-1"
          >
            Сегодня
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white border border-gray-100 rounded-xl h-20 animate-pulse" />
          ))}
        </div>
      ) : slots.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
          <p className="text-gray-400">Нет уроков на этот день</p>
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

// ── Student dashboard ─────────────────────────────────────────────────────────

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
        <button onClick={() => shiftDate(-1)} className="p-2 rounded hover:bg-gray-100 text-gray-500" title="Предыдущий день">&#8592;</button>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold capitalize">{formatDateRu(date)}</h2>
          <input
            type="date"
            value={date}
            onChange={e => e.target.value && setDate(e.target.value)}
            className="border rounded px-2 py-1 text-sm text-gray-500 w-36"
          />
        </div>
        <button onClick={() => shiftDate(1)} className="p-2 rounded hover:bg-gray-100 text-gray-500" title="Следующий день">&#8594;</button>
        {!isToday && (
          <button onClick={() => setDate(todayISO())} className="text-sm text-blue-600 hover:text-blue-800 ml-1">Сегодня</button>
        )}
      </div>

      {loading ? (
        <p className="text-gray-400 text-center py-8">Загрузка...</p>
      ) : topics.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-400">Нет тем на этот день</p>
        </div>
      ) : (
        <div className="space-y-2">
          {topics.map(topic => (
            <div key={topic.id} className="bg-white rounded-lg shadow">
              <button
                onClick={() => hasDetails(topic) ? setExpandedId(expandedId === topic.id ? null : topic.id) : undefined}
                className={`w-full text-left px-4 py-3 flex items-center gap-3 ${hasDetails(topic) ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default'}`}
              >
                <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded shrink-0">{topic.subject_name}</span>
                <span className="text-sm text-gray-800 flex-1">{topic.title}</span>
                {hasDetails(topic) && (
                  <span className={`text-gray-400 text-xs transition-transform ${expandedId === topic.id ? 'rotate-90' : ''}`}>&#9654;</span>
                )}
              </button>

              {expandedId === topic.id && hasDetails(topic) && (
                <div className="px-4 pb-3 border-t space-y-3 pt-3">
                  {topic.homework && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Домашнее задание</label>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{topic.homework}</p>
                    </div>
                  )}
                  {topic.resources.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Материалы</label>
                      <ul className="space-y-1">
                        {topic.resources.map((r, i) => (
                          <li key={i}>
                            <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:text-blue-800 hover:underline">
                              {r.title || r.url}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {topic.files.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Файлы</label>
                      <ul className="space-y-1">
                        {topic.files.map(f => (
                          <li key={f.id}>
                            <a href={f.file} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:text-blue-800 hover:underline">
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
    return <p className="text-gray-400 py-8 text-center">Нет привязанных учеников</p>;
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
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {c.last_name} {c.first_name}
              <span className="ml-1.5 text-xs text-gray-400">({c.school_class_name})</span>
            </button>
          ))}
        </div>
      )}
      {activeChildId && <StudentDashboard studentId={activeChildId} />}
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
        <StudentDashboard />
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
        <TeacherDashboard />
      </div>
    );
  }

  // Admin-only view
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Добро пожаловать, {user.first_name}!</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link to="/ktp" className="bg-white p-6 rounded-lg shadow hover:shadow-md transition">
          <h2 className="text-lg font-semibold text-blue-600 mb-2">КТП</h2>
          <p className="text-gray-500 text-sm">Календарно-тематическое планирование</p>
        </Link>
        <Link to="/admin/people" className="bg-white p-6 rounded-lg shadow hover:shadow-md transition">
          <h2 className="text-lg font-semibold text-blue-600 mb-2">Люди</h2>
          <p className="text-gray-500 text-sm">Сотрудники и ученики</p>
        </Link>
        <Link to="/admin/school" className="bg-white p-6 rounded-lg shadow hover:shadow-md transition">
          <h2 className="text-lg font-semibold text-blue-600 mb-2">Школа</h2>
          <p className="text-gray-500 text-sm">Классы, предметы, параллели, выходные</p>
        </Link>
      </div>
    </div>
  );
}
