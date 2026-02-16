import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import api from '../../api/client';
import type { Holiday } from '../../types';

type Section = 'holidays';

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'holidays', label: 'Выходные' },
];

export default function ExtraTab() {
  const [section, setSection] = useState<Section>('holidays');

  return (
    <div className="flex gap-6">
      <div className="w-48 shrink-0">
        <div className="space-y-1">
          {SECTIONS.map(s => (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className={`w-full text-left px-3 py-2 rounded text-sm ${
                section === s.key ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1">
        {section === 'holidays' && <HolidaysSection />}
      </div>
    </div>
  );
}

function HolidaysSection() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');

  const load = async () => { setHolidays((await api.get('/ktp/holidays/')).data); };
  useEffect(() => { load(); }, []);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!date) return;
    await api.post('/ktp/holidays/', { date, description });
    setDate('');
    setDescription('');
    load();
  };

  return (
    <div className="max-w-lg">
      <form onSubmit={handleAdd} className="flex gap-2 mb-4 flex-wrap">
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border rounded px-3 py-2 text-sm" required />
        <input placeholder="Описание" value={description} onChange={e => setDescription(e.target.value)} className="border rounded px-3 py-2 text-sm flex-1" />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">Добавить</button>
      </form>
      <div className="space-y-2">
        {holidays.map(h => (
          <div key={h.id} className="flex items-center justify-between bg-white px-4 py-3 rounded-lg shadow-sm">
            <div>
              <span className="text-sm font-medium">{h.date}</span>
              {h.description && <span className="text-sm text-gray-500 ml-2">— {h.description}</span>}
            </div>
            <button onClick={async () => { await api.delete(`/ktp/holidays/${h.id}/`); load(); }} className="text-red-400 hover:text-red-600 text-sm">Удалить</button>
          </div>
        ))}
        {holidays.length === 0 && <p className="text-gray-400 text-sm py-4">Выходные не добавлены</p>}
      </div>
    </div>
  );
}
