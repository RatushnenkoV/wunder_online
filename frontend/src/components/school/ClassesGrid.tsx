import { useState, useEffect } from 'react';
import api from '../../api/client';
import type { SchoolClass } from '../../types';
import ContextMenu from '../ContextMenu';
import type { MenuItem } from '../ContextMenu';

interface Props {
  onSelect: (cls: SchoolClass) => void;
}

export default function ClassesGrid({ onSelect }: Props) {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [gradeNumber, setGradeNumber] = useState('');
  const [letter, setLetter] = useState('');
  const [ctxMenu, setCtxMenu] = useState<{ cls: SchoolClass; x: number; y: number } | null>(null);

  const load = async () => {
    const res = await api.get('/school/classes/');
    setClasses(res.data);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!gradeNumber || !letter.trim()) return;
    // Ensure grade level exists
    const glRes = await api.post('/school/grade-levels/', { number: parseInt(gradeNumber) });
    await api.post('/school/classes/', { grade_level: glRes.data.id, letter: letter.trim().toUpperCase() });
    setShowCreate(false);
    setGradeNumber('');
    setLetter('');
    load();
  };

  const handleDelete = async (cls: SchoolClass) => {
    if (!confirm(`Удалить класс ${cls.display_name}?`)) return;
    await api.delete(`/school/classes/${cls.id}/`);
    load();
  };

  const getMenuItems = (cls: SchoolClass): MenuItem[] => [
    { label: 'Удалить', onClick: () => handleDelete(cls), danger: true },
  ];

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowCreate(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
          + Создать класс
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {classes.map(cls => (
          <button
            key={cls.id}
            onClick={() => onSelect(cls)}
            onContextMenu={e => { e.preventDefault(); setCtxMenu({ cls, x: e.clientX, y: e.clientY }); }}
            className="bg-white p-4 rounded-lg shadow hover:shadow-md transition text-center"
          >
            <div className="text-3xl mb-2">&#128193;</div>
            <div className="font-medium text-sm">{cls.display_name}</div>
            <div className="text-xs text-gray-400">{cls.students_count} уч.</div>
          </button>
        ))}
        {classes.length === 0 && (
          <p className="col-span-full text-gray-400 text-center py-8">Классы не созданы</p>
        )}
      </div>

      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={getMenuItems(ctxMenu.cls)} onClose={() => setCtxMenu(null)} />
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Новый класс</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Параллель (номер)</label>
                <input type="number" min="1" max="11" value={gradeNumber} onChange={e => setGradeNumber(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" placeholder="1" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Буква</label>
                <input value={letter} onChange={e => setLetter(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()} className="w-full border rounded px-3 py-2 text-sm" placeholder="А" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Отмена</button>
              <button onClick={handleCreate} disabled={!gradeNumber || !letter.trim()} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
                Создать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
