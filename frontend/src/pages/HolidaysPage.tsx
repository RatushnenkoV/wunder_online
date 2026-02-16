import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import api from '../api/client';
import type { Holiday } from '../types';

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');

  const load = async () => {
    const res = await api.get('/ktp/holidays/');
    setHolidays(res.data);
  };

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
    <div>
      <h1 className="text-2xl font-bold mb-6">Выходные и каникулы</h1>

      <form onSubmit={handleAdd} className="bg-white p-4 rounded-lg shadow mb-6 flex gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Дата</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border rounded px-3 py-2 text-sm" required />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
          <input placeholder="Например: Новогодние каникулы" value={description} onChange={e => setDescription(e.target.value)} className="border rounded px-3 py-2 text-sm w-full" />
        </div>
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">Добавить</button>
      </form>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Дата</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Описание</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {holidays.map(h => (
              <tr key={h.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">{h.date}</td>
                <td className="px-4 py-3 text-gray-500">{h.description || '—'}</td>
                <td className="px-4 py-3">
                  <button onClick={async () => { await api.delete(`/ktp/holidays/${h.id}/`); load(); }} className="text-red-600 hover:text-red-800 text-xs">Удалить</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {holidays.length === 0 && (
          <p className="text-center text-gray-400 py-8">Выходные не добавлены</p>
        )}
      </div>
    </div>
  );
}
