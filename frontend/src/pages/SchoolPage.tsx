import { useState } from 'react';
import type { SchoolClass } from '../types';
import ClassesGrid from '../components/school/ClassesGrid';
import ClassDetail from '../components/school/ClassDetail';
import ExtraTab from '../components/school/ExtraTab';

type MainTab = 'classes' | 'extra';

const TABS: { key: MainTab; label: string }[] = [
  { key: 'classes', label: 'Классы' },
  { key: 'extra', label: 'Дополнительно' },
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
      <h1 className="text-2xl font-bold mb-4">Управление школой</h1>

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
          ? <ClassDetail schoolClass={selectedClass} onBack={() => setSelectedClass(null)} />
          : <ClassesGrid onSelect={setSelectedClass} />
      )}

      {mainTab === 'extra' && <ExtraTab />}
    </div>
  );
}
