import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import api from '../../api/client';
import type { Holiday, Room } from '../../types';

type Section = 'rooms' | 'holidays' | 'curator_hints';

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'rooms', label: 'Кабинеты' },
  { key: 'holidays', label: 'Выходные' },
  { key: 'curator_hints', label: 'Подсказки куратора' },
];

export default function ExtraTab() {
  const [section, setSection] = useState<Section>('rooms');

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
        {section === 'rooms' && <RoomsSection />}
        {section === 'holidays' && <HolidaysSection />}
        {section === 'curator_hints' && <CuratorHintsSection />}
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

// ─── Curator Hints Section ────────────────────────────────────────────────────

interface CuratorHint {
  id: number;
  field: number;
  text: string;
}

interface CuratorField {
  id: number;
  name: string;
  hints: CuratorHint[];
}

interface CuratorSection {
  id: number;
  name: string;
  fields: CuratorField[];
}

function CuratorHintsSection() {
  const [sections, setSections] = useState<CuratorSection[]>([]);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [newHints, setNewHints] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/curator/structure/');
      setSections(res.data);
      // Expand first section by default
      if (res.data.length > 0) {
        setExpanded({ [res.data[0].id]: true });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleSection = (id: number) => {
    setExpanded(e => ({ ...e, [id]: !e[id] }));
  };

  const handleAddHint = async (fieldId: number) => {
    const text = (newHints[fieldId] ?? '').trim();
    if (!text) return;
    await api.post('/curator/hints/', { field: fieldId, text });
    setNewHints(n => ({ ...n, [fieldId]: '' }));
    load();
  };

  const handleDeleteHint = async (hintId: number) => {
    await api.delete(`/curator/hints/${hintId}/`);
    load();
  };

  if (loading) {
    return <div className="text-gray-400 text-sm py-4">Загрузка...</div>;
  }

  return (
    <div className="max-w-2xl space-y-3">
      <p className="text-sm text-gray-500 mb-4">
        Подсказки отображаются в кураторской таблице под каждым полем. Нажимая на подсказку, куратор вставляет её текст в поле.
      </p>

      {sections.map(section => (
        <div key={section.id} className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          {/* Section toggle */}
          <button
            onClick={() => toggleSection(section.id)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
          >
            <span className="font-medium text-gray-800 text-sm">{section.name}</span>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${expanded[section.id] ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {expanded[section.id] && (
            <div className="border-t divide-y">
              {section.fields.map(field => (
                <div key={field.id} className="px-4 py-3">
                  <p className="text-sm font-medium text-gray-700 mb-2">{field.name}</p>

                  {/* Existing hints */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {field.hints.map(hint => (
                      <span
                        key={hint.id}
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200"
                      >
                        {hint.text}
                        <button
                          onClick={() => handleDeleteHint(hint.id)}
                          className="text-blue-400 hover:text-red-500 transition-colors ml-0.5 leading-none"
                          title="Удалить"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                    {field.hints.length === 0 && (
                      <span className="text-xs text-gray-400">Нет подсказок</span>
                    )}
                  </div>

                  {/* Add new hint */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newHints[field.id] ?? ''}
                      onChange={e => setNewHints(n => ({ ...n, [field.id]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddHint(field.id); } }}
                      placeholder="Новая подсказка..."
                      className="flex-1 border rounded px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => handleAddHint(field.id)}
                      disabled={!(newHints[field.id] ?? '').trim()}
                      className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 transition-colors"
                    >
                      + Добавить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
