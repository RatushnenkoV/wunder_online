import { useState } from 'react';
import type { SchoolClass } from '../../types';
import ClassStudents from './ClassStudents';
import ClassGroups from './ClassGroups';
import ClassSubjects from './ClassSubjects';

type SubTab = 'students' | 'groups' | 'subjects';

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'students', label: 'Ученики' },
  { key: 'groups', label: 'Группы' },
  { key: 'subjects', label: 'Предметы' },
];

interface Props {
  schoolClass: SchoolClass;
  onBack: () => void;
}

export default function ClassDetail({ schoolClass, onBack }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('students');

  return (
    <div>
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 mb-4 text-sm">
        <button onClick={onBack} className="text-gray-500 hover:text-blue-600">Классы</button>
        <span className="text-gray-300">/</span>
        <span className="font-semibold text-blue-600">{schoolClass.display_name}</span>
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
      {subTab === 'students' && <ClassStudents classId={schoolClass.id} />}
      {subTab === 'groups' && <ClassGroups classId={schoolClass.id} />}
      {subTab === 'subjects' && <ClassSubjects classId={schoolClass.id} />}
    </div>
  );
}
