import { useState, useEffect, useRef } from 'react';
import type { SchoolClass } from '../../types';
import ClassStudents from './ClassStudents';
import ClassGroups from './ClassGroups';
import ClassSubjects from './ClassSubjects';
import api from '../../api/client';

type SubTab = 'students' | 'groups' | 'subjects';

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'students', label: 'Ученики' },
  { key: 'groups', label: 'Группы' },
  { key: 'subjects', label: 'Предметы' },
];

interface TeacherOption {
  id: number;
  first_name: string;
  last_name: string;
}

interface Props {
  schoolClass: SchoolClass;
  onBack: () => void;
  onClassUpdated?: (updated: SchoolClass) => void;
}

export default function ClassDetail({ schoolClass, onBack, onClassUpdated }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('students');
  const [currentClass, setCurrentClass] = useState<SchoolClass>(schoolClass);
  const [showCuratorPicker, setShowCuratorPicker] = useState(false);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [curatorSearch, setCuratorSearch] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setCurrentClass(schoolClass); }, [schoolClass]);

  useEffect(() => {
    if (!showCuratorPicker) return;
    api.get('/admin/staff/', { params: { per_page: '200' } }).then(r => setTeachers(r.data.results || []));
  }, [showCuratorPicker]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowCuratorPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelectCurator = async (teacherId: number | null) => {
    try {
      const res = await api.patch(`/school/classes/${currentClass.id}/`, { curator_id: teacherId });
      setCurrentClass(res.data);
      onClassUpdated?.(res.data);
      setShowCuratorPicker(false);
    } catch { /* ignore */ }
  };

  const filteredTeachers = teachers.filter(t =>
    curatorSearch === '' ||
    `${t.last_name} ${t.first_name}`.toLowerCase().includes(curatorSearch.toLowerCase())
  );

  return (
    <div>
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 mb-3 text-sm">
        <button onClick={onBack} className="text-gray-500 hover:text-blue-600">Классы</button>
        <span className="text-gray-300">/</span>
        <span className="font-semibold text-blue-600">{currentClass.display_name}</span>
      </div>

      {/* Curator row */}
      <div className="flex items-center gap-3 mb-4 text-sm">
        <span className="text-gray-500">Куратор:</span>
        {currentClass.curator_name ? (
          <span className="font-medium text-gray-800">{currentClass.curator_name}</span>
        ) : (
          <span className="text-gray-400 italic">не назначен</span>
        )}
        <div className="relative" ref={pickerRef}>
          <button
            onClick={() => { setShowCuratorPicker(v => !v); setCuratorSearch(''); }}
            className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-2 py-0.5"
          >
            {currentClass.curator_name ? 'Изменить' : 'Назначить'}
          </button>
          {showCuratorPicker && (
            <div className="absolute left-0 top-7 z-30 bg-white border rounded-lg shadow-lg w-64">
              <div className="p-2 border-b">
                <input
                  autoFocus
                  placeholder="Поиск..."
                  value={curatorSearch}
                  onChange={e => setCuratorSearch(e.target.value)}
                  className="w-full border rounded px-2 py-1 text-xs"
                />
              </div>
              <div className="max-h-48 overflow-y-auto">
                {currentClass.curator_id && (
                  <button
                    onClick={() => handleSelectCurator(null)}
                    className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50"
                  >
                    Снять куратора
                  </button>
                )}
                {filteredTeachers.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleSelectCurator(t.id)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${t.id === currentClass.curator_id ? 'bg-blue-50 text-blue-700 font-medium' : ''}`}
                  >
                    {t.last_name} {t.first_name}
                  </button>
                ))}
                {filteredTeachers.length === 0 && <p className="text-xs text-gray-400 text-center py-3">Не найдено</p>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b mb-4">
        {SUB_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setSubTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              subTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {subTab === 'students' && <ClassStudents classId={currentClass.id} />}
      {subTab === 'groups' && <ClassGroups classId={currentClass.id} />}
      {subTab === 'subjects' && <ClassSubjects classId={currentClass.id} />}
    </div>
  );
}
