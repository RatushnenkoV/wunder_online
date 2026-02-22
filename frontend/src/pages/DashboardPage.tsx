import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';
import type { TopicByDate, ParentChild } from '../types';

function formatDateRu(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  return `${d.getDate()} ${months[d.getMonth()]}, ${days[d.getDay()]}`;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function StudentDashboard({ studentId }: { studentId?: number }) {
  const [date, setDate] = useState(() => toISODate(new Date()));
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
    setDate(toISODate(d));
  };

  const isToday = date === toISODate(new Date());

  const hasDetails = (t: TopicByDate) => t.homework || t.resources.length > 0 || t.files.length > 0;

  return (
    <div>
      {/* Date navigation */}
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
          <button onClick={() => setDate(toISODate(new Date()))} className="text-sm text-blue-600 hover:text-blue-800 ml-1">Сегодня</button>
        )}
      </div>

      {/* Topics list */}
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

export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  if (user.is_student) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">
          Добро пожаловать, {user.first_name}!
        </h1>
        <StudentDashboard />
      </div>
    );
  }

  if (user.is_parent) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">
          Добро пожаловать, {user.first_name}!
        </h1>
        <ParentDashboard />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">
        Добро пожаловать, {user.first_name}!
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          to="/ktp"
          className="bg-white p-6 rounded-lg shadow hover:shadow-md transition"
        >
          <h2 className="text-lg font-semibold text-blue-600 mb-2">КТП</h2>
          <p className="text-gray-500 text-sm">
            Календарно-тематическое планирование
          </p>
        </Link>

        {user.is_admin && (
          <>
            <Link
              to="/admin/people"
              className="bg-white p-6 rounded-lg shadow hover:shadow-md transition"
            >
              <h2 className="text-lg font-semibold text-blue-600 mb-2">Люди</h2>
              <p className="text-gray-500 text-sm">
                Сотрудники и ученики
              </p>
            </Link>
            <Link
              to="/admin/school"
              className="bg-white p-6 rounded-lg shadow hover:shadow-md transition"
            >
              <h2 className="text-lg font-semibold text-blue-600 mb-2">Школа</h2>
              <p className="text-gray-500 text-sm">
                Классы, предметы, параллели, выходные
              </p>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
