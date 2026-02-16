import { useState } from 'react';
import StaffTab from '../components/StaffTab';
import StudentsTab from '../components/StudentsTab';

export default function PeoplePage() {
  const [tab, setTab] = useState<'staff' | 'students'>('staff');

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Люди</h1>
      <div className="flex border-b mb-6">
        <button
          onClick={() => setTab('staff')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition ${tab === 'staff' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Сотрудники
        </button>
        <button
          onClick={() => setTab('students')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition ${tab === 'students' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Ученики
        </button>
      </div>

      {tab === 'staff' && <StaffTab />}
      {tab === 'students' && <StudentsTab />}
    </div>
  );
}
