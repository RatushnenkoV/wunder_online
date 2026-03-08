import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { SchoolClass } from '../types';
import ClassesGrid from '../components/school/ClassesGrid';
import ClassDetail from '../components/school/ClassDetail';
import StudentsTab from '../components/StudentsTab';
import ParentsTab from '../components/ParentsTab';
import CuratorTab from '../components/curator/CuratorTab';

type MainTab = 'classes' | 'all' | 'parents' | 'curator';

export default function SchoolPage() {
  const { user } = useAuth();
  const location = useLocation();
  const isAdmin = user?.is_admin ?? false;
  const isCurator = user?.is_teacher && (user?.curated_classes?.length ?? 0) > 0;

  const TABS: { key: MainTab; label: string }[] = [
    { key: 'classes', label: 'Классы' },
    { key: 'all', label: 'Ученики' },
    { key: 'parents', label: 'Родители' },
    ...(isCurator ? [{ key: 'curator' as MainTab, label: 'Кураторская таблица' }] : []),
  ];

  const defaultTab: MainTab = (location.state?.tab as MainTab) ?? 'classes';
  const [mainTab, setMainTab] = useState<MainTab>(defaultTab);
  const [selectedClass, setSelectedClass] = useState<SchoolClass | null>(null);

  const handleTabChange = (tab: MainTab) => {
    setMainTab(tab);
    setSelectedClass(null);
  };

  return (
    <div>
      <div className="flex gap-1 mb-6 border-b">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => handleTabChange(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              mainTab === t.key
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700'
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

      {mainTab === 'all' && <StudentsTab readOnly={!isAdmin} />}

      {mainTab === 'parents' && <ParentsTab />}

      {mainTab === 'curator' && <CuratorTab />}
    </div>
  );
}
