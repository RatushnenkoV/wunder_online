import { useState } from 'react';
import type { SchoolClass } from '../types';
import ClassesGrid from '../components/school/ClassesGrid';
import ClassDetail from '../components/school/ClassDetail';
import StudentsTab from '../components/StudentsTab';
import ParentsTab from '../components/ParentsTab';

type MainTab = 'classes' | 'all' | 'parents';

const TABS: { key: MainTab; label: string }[] = [
  { key: 'classes', label: 'Классы' },
  { key: 'all', label: 'Ученики' },
  { key: 'parents', label: 'Родители' },
];

export default function SchoolPage() {
  const [mainTab, setMainTab] = useState<MainTab>('classes');
  const [selectedClass, setSelectedClass] = useState<SchoolClass | null>(null);

  const handleTabChange = (tab: MainTab) => {
    setMainTab(tab);
    setSelectedClass(null);
  };

  return (
    <div>
      <div className="flex border-b mb-6">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => handleTabChange(t.key)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition ${
              mainTab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mainTab === 'classes' && (
        selectedClass
          ? <ClassDetail
              schoolClass={selectedClass}
              onBack={() => setSelectedClass(null)}
              onClassUpdated={setSelectedClass}
            />
          : <ClassesGrid onSelect={setSelectedClass} />
      )}

      {mainTab === 'all' && <StudentsTab />}

      {mainTab === 'parents' && <ParentsTab />}
    </div>
  );
}
