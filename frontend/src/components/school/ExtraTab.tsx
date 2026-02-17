import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import api from '../../api/client';
import type { Holiday, SchoolClass, GradeLevel, Room } from '../../types';

type Section = 'classList' | 'rooms' | 'holidays';

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'classList', label: 'Классы' },
  { key: 'rooms', label: 'Кабинеты' },
  { key: 'holidays', label: 'Выходные' },
];

export default function ExtraTab() {
  const [section, setSection] = useState<Section>('classList');

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
        {section === 'classList' && <ClassListSection />}
        {section === 'rooms' && <RoomsSection />}
        {section === 'holidays' && <HolidaysSection />}
      </div>
    </div>
  );
}

function ClassListSection() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [gradeNumber, setGradeNumber] = useState('');
  const [letter, setLetter] = useState('');

  const load = async () => {
    const [classesRes, levelsRes] = await Promise.all([
      api.get('/school/classes/'),
      api.get('/school/grade-levels/'),
    ]);
    setClasses(classesRes.data);
    setGradeLevels(levelsRes.data);
  };
  useEffect(() => { load(); }, []);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!gradeNumber || !letter) return;

    let gradeLevel = gradeLevels.find(g => g.number === Number(gradeNumber));
    if (!gradeLevel) {
      const res = await api.post('/school/grade-levels/', { number: Number(gradeNumber) });
      gradeLevel = res.data;
    }

    await api.post('/school/classes/', { grade_level: gradeLevel!.id, letter: letter.toUpperCase() });
    setGradeNumber('');
    setLetter('');
    load();
  };

  return (
    <div className="max-w-lg">
      <form onSubmit={handleAdd} className="flex gap-2 mb-4">
        <input
          type="number" min="1" max="11" placeholder="Класс"
          value={gradeNumber} onChange={e => setGradeNumber(e.target.value)}
          className="border rounded px-3 py-2 text-sm w-24" required
        />
        <input
          placeholder="Буква" maxLength={5}
          value={letter} onChange={e => setLetter(e.target.value)}
          className="border rounded px-3 py-2 text-sm w-24" required
        />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">Добавить</button>
      </form>
      <div className="space-y-2">
        {classes.map(c => (
          <div key={c.id} className="flex items-center justify-between bg-white px-4 py-3 rounded-lg shadow-sm">
            <div>
              <span className="text-sm font-medium">{c.display_name}</span>
              <span className="text-sm text-gray-500 ml-2">({c.students_count} уч.)</span>
            </div>
            <button
              onClick={async () => { await api.delete(`/school/classes/${c.id}/`); load(); }}
              className="text-red-400 hover:text-red-600 text-sm"
            >Удалить</button>
          </div>
        ))}
        {classes.length === 0 && <p className="text-gray-400 text-sm py-4">Классы не добавлены</p>}
      </div>
    </div>
  );
}

function RoomsSection() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [name, setName] = useState('');

  const load = async () => { setRooms((await api.get('/school/rooms/')).data); };
  useEffect(() => { load(); }, []);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await api.post('/school/rooms/', { name: name.trim() });
    setName('');
    load();
  };

  return (
    <div className="max-w-lg">
      <form onSubmit={handleAdd} className="flex gap-2 mb-4">
        <input
          placeholder="Название кабинета" value={name} onChange={e => setName(e.target.value)}
          className="border rounded px-3 py-2 text-sm flex-1" required
        />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">Добавить</button>
      </form>
      <div className="space-y-2">
        {rooms.map(r => (
          <div key={r.id} className="flex items-center justify-between bg-white px-4 py-3 rounded-lg shadow-sm">
            <span className="text-sm font-medium">{r.name}</span>
            <button
              onClick={async () => { await api.delete(`/school/rooms/${r.id}/`); load(); }}
              className="text-red-400 hover:text-red-600 text-sm"
            >Удалить</button>
          </div>
        ))}
        {rooms.length === 0 && <p className="text-gray-400 text-sm py-4">Кабинеты не добавлены</p>}
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
