import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import CuratorReportForm from '../components/curator/CuratorReportForm';

export default function CuratorReportPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();

  const [studentName, setStudentName] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!studentId) return;
    api.get('/curator/my-class/').then(res => {
      setAcademicYear(res.data.academic_year);
      const student = (res.data.students as { id: number; first_name: string; last_name: string }[])
        .find(s => s.id === Number(studentId));
      if (student) setStudentName(`${student.last_name} ${student.first_name}`);
      setReady(true);
    });
  }, [studentId]);

  const goBack = () => navigate('/school', { state: { tab: 'curator' } });

  return (
    <div className="max-w-3xl mx-auto pb-8">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <button
          onClick={goBack}
          className="mt-1 flex items-center gap-1.5 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-800 transition-colors shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Назад
        </button>
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100">{studentName || '...'}</h1>
          {academicYear && <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{academicYear} учебный год</p>}
        </div>
      </div>

      {ready && studentId && (
        <CuratorReportForm
          studentId={Number(studentId)}
          academicYear={academicYear}
        />
      )}
    </div>
  );
}
