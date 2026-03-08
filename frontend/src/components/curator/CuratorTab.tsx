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

export default function CuratorTab() {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<StudentItem | null>(null);

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

  // Тихое обновление списка (без спиннера) — вызывается после авто-сохранения
  const silentRefresh = async () => {
    try {
      const res = await api.get('/curator/my-class/');
      setClassInfo(res.data);
      setSelectedStudent(prev =>
        prev ? (res.data.students.find((s: StudentItem) => s.id === prev.id) ?? prev) : null
      );
    } catch {
      // игнорируем — не сбрасываем UI при ошибке фонового обновления
    }
  };

  useEffect(() => { load(); }, []);

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
                    ? 'bg-purple-50'
                    : 'hover:bg-gray-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-medium truncate ${
                    isDesktop && selectedStudent?.id === student.id ? 'text-purple-700' : 'text-gray-800 dark:text-slate-200'
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

        {/* Десктоп: правая панель с формой */}
        {isDesktop && (
          <div className="flex-1 min-w-0">
            {selectedStudent ? (
              <div>
                <p className="text-base font-semibold text-gray-800 dark:text-slate-200 mb-4">
                  {selectedStudent.last_name} {selectedStudent.first_name}
                </p>
                <CuratorReportForm
                  key={selectedStudent.id}
                  studentId={selectedStudent.id}
                  academicYear={classInfo.academic_year}
                  onSaved={silentRefresh}
                />
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
