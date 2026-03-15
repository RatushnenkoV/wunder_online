import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import CuratorReportForm from './CuratorReportForm';

interface StudentItem {
  id: number;
  first_name: string;
  last_name: string;
  student_profile_id: number;
  has_report: boolean;
  updated_at: string | null;
  filled_count: number;
  total_fields: number;
}

interface ClassInfo {
  class_name: string;
  class_id: number;
  academic_year: string;
  students: StudentItem[];
}

interface YellowEntry {
  id: number;
  date: string;
  fact: string;
  lesson: string;
  is_read_by_spps: boolean;
  student_name: string;
  student_class: string;
  submitted_by_name: string;
  created_at: string;
  comments: { id: number; text: string; created_by_name: string; created_at: string }[];
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 768);
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isDesktop;
}

function ProgressBar({ filled, total }: { filled: number; total: number }) {
  const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
  const barColor = pct === 100 ? 'bg-green-500' : pct > 0 ? 'bg-purple-500' : 'bg-gray-300';
  return (
    <div className="flex items-center gap-2 mt-0.5">
      <div className="w-14 h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400 dark:text-slate-500">{pct}%</span>
    </div>
  );
}

function formatDate(iso: string) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

function YellowEntryCard({ entry }: { entry: YellowEntry }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`border rounded-lg overflow-hidden ${!entry.is_read_by_spps ? 'border-yellow-400 bg-yellow-50/40 dark:bg-yellow-900/10' : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800'}`}>
      <button
        className="w-full text-left px-4 py-3 flex items-start justify-between gap-3 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 dark:text-slate-400">{formatDate(entry.date)}</span>
            {entry.lesson && (
              <span className="text-xs text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded">{entry.lesson}</span>
            )}
          </div>
          <p className="text-sm text-gray-800 dark:text-slate-200 mt-1 line-clamp-2">{entry.fact}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Подал(а): {entry.submitted_by_name}</p>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 dark:text-slate-500 flex-shrink-0 mt-1 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-slate-700 pt-3 space-y-3">
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Факт</p>
            <p className="text-sm text-gray-800 dark:text-slate-200 whitespace-pre-wrap">{entry.fact}</p>
          </div>
          {entry.comments.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-2">Комментарии СППС</p>
              <div className="space-y-2">
                {entry.comments.map(c => (
                  <div key={c.id} className="bg-gray-50 dark:bg-slate-900 rounded-lg px-3 py-2">
                    <p className="text-xs font-medium text-gray-600 dark:text-slate-400">{c.created_by_name}</p>
                    <p className="text-sm text-gray-800 dark:text-slate-200 mt-0.5 whitespace-pre-wrap">{c.text}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{formatDate(c.created_at)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StudentYellowList({ studentId }: { studentId: number }) {
  const [entries, setEntries] = useState<YellowEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/yellow-list/student/${studentId}/`)
      .then(r => setEntries(r.data))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) return <div className="text-gray-400 dark:text-slate-500 text-sm py-4 text-center">Загрузка...</div>;
  if (entries.length === 0) return <div className="text-gray-400 dark:text-slate-500 text-sm py-4 text-center">Заявок нет</div>;

  return (
    <div className="space-y-3">
      {entries.map(e => <YellowEntryCard key={e.id} entry={e} />)}
    </div>
  );
}

export default function CuratorTab() {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<StudentItem | null>(null);
  const [activeTab, setActiveTab] = useState<'report' | 'yellow'>('report');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/curator/my-class/');
      setClassInfo(res.data);
      setSelectedStudent(prev =>
        prev ? (res.data.students.find((s: StudentItem) => s.id === prev.id) ?? prev) : null
      );
    } catch {
      setClassInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const silentRefresh = async () => {
    try {
      const res = await api.get('/curator/my-class/');
      setClassInfo(res.data);
      setSelectedStudent(prev =>
        prev ? (res.data.students.find((s: StudentItem) => s.id === prev.id) ?? prev) : null
      );
    } catch {
      // ignore
    }
  };

  useEffect(() => { load(); }, []);

  // Сбрасываем вкладку при смене ученика
  useEffect(() => {
    setActiveTab('report');
  }, [selectedStudent?.id]);

  const handleStudentClick = (student: StudentItem) => {
    if (isDesktop) {
      setSelectedStudent(student);
    } else {
      navigate(`/people/curator/${student.id}`);
    }
  };

  if (loading) {
    return <div className="text-gray-400 dark:text-slate-500 text-sm py-8 text-center">Загрузка...</div>;
  }

  if (!classInfo) {
    return <div className="text-gray-400 dark:text-slate-500 text-sm py-8 text-center">Не удалось загрузить данные класса</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-200">Класс {classInfo.class_name}</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400">{classInfo.academic_year} учебный год</p>
        </div>
        <span className="text-sm text-gray-500 dark:text-slate-400">{classInfo.students.length} учеников</span>
      </div>

      <div className="flex gap-5 items-start">
        {/* Список учеников */}
        <div className={isDesktop ? 'w-64 shrink-0' : 'w-full'}>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
            {classInfo.students.map(student => (
              <div
                key={student.id}
                onClick={() => handleStudentClick(student)}
                className={`flex items-center justify-between px-4 py-3 cursor-pointer border-b last:border-b-0 transition-colors ${
                  isDesktop && selectedStudent?.id === student.id
                    ? 'bg-purple-50 dark:bg-purple-900/20'
                    : 'hover:bg-gray-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-medium truncate ${
                    isDesktop && selectedStudent?.id === student.id ? 'text-purple-700 dark:text-purple-400' : 'text-gray-800 dark:text-slate-200'
                  }`}>
                    {student.last_name} {student.first_name}
                  </div>
                  <ProgressBar filled={student.filled_count} total={student.total_fields} />
                </div>
                {!isDesktop && (
                  <svg className="w-4 h-4 text-gray-300 dark:text-slate-600 shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </div>
            ))}
            {classInfo.students.length === 0 && (
              <p className="text-center text-gray-400 dark:text-slate-500 py-8 text-sm">Ученики в классе не найдены</p>
            )}
          </div>
        </div>

        {/* Десктоп: правая панель */}
        {isDesktop && (
          <div className="flex-1 min-w-0">
            {selectedStudent ? (
              <div>
                <p className="text-base font-semibold text-gray-800 dark:text-slate-200 mb-3">
                  {selectedStudent.last_name} {selectedStudent.first_name}
                </p>

                {/* Вкладки */}
                <div className="flex gap-1 mb-4 border-b border-gray-200 dark:border-slate-700">
                  <button
                    onClick={() => setActiveTab('report')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                      activeTab === 'report'
                        ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                        : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700'
                    }`}
                  >
                    Карточка
                  </button>
                  <button
                    onClick={() => setActiveTab('yellow')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                      activeTab === 'yellow'
                        ? 'border-yellow-500 text-yellow-700 dark:text-yellow-400'
                        : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700'
                    }`}
                  >
                    Заявки СППС
                  </button>
                </div>

                {activeTab === 'report' && (
                  <CuratorReportForm
                    key={selectedStudent.id}
                    studentId={selectedStudent.id}
                    academicYear={classInfo.academic_year}
                    onSaved={silentRefresh}
                  />
                )}

                {activeTab === 'yellow' && (
                  <StudentYellowList studentId={selectedStudent.id} />
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-40 bg-gray-50 dark:bg-slate-900 rounded-xl border border-dashed border-gray-200 dark:border-slate-700">
                <p className="text-sm text-gray-400 dark:text-slate-500">Выберите ученика из списка слева</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
