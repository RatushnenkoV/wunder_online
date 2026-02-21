import { useState, useEffect } from 'react';
import api from '../../api/client';
import type { ClassSubject } from '../../types';
import ContextMenu from '../ContextMenu';
import type { MenuItem } from '../ContextMenu';

interface Props {
  classId: number;
}

export default function ClassSubjects({ classId }: Props) {
  const [subjects, setSubjects] = useState<ClassSubject[]>([]);
  const [ctxMenu, setCtxMenu] = useState<{ subject: ClassSubject; x: number; y: number } | null>(null);

  // Batch create
  const [showCreate, setShowCreate] = useState(false);
  const [rows, setRows] = useState<string[]>(['']);

  // Edit
  const [editSubject, setEditSubject] = useState<ClassSubject | null>(null);
  const [editName, setEditName] = useState('');

  const load = async () => {
    const res = await api.get(`/school/classes/${classId}/subjects/`);
    setSubjects(res.data);
  };

  useEffect(() => { load(); }, [classId]);

  // --- Batch create ---
  const openCreate = () => {
    setRows(['']);
    setShowCreate(true);
  };

  const handleRowKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    setRows(r => [...r, '']);
    setTimeout(() => document.getElementById(`subj-${idx + 1}`)?.focus(), 0);
  };

  const handleCreate = async () => {
    const valid = rows.map(r => r.trim()).filter(Boolean);
    if (valid.length === 0) return;
    const payload = valid.map(name => ({ name }));
    await api.post(`/school/classes/${classId}/subjects/`, payload);
    setShowCreate(false);
    load();
  };

  // --- Edit ---
  const openEdit = (subject: ClassSubject) => {
    setEditSubject(subject);
    setEditName(subject.name);
  };

  const handleEdit = async () => {
    if (!editSubject || !editName.trim()) return;
    await api.put(`/school/class-subjects/${editSubject.id}/`, { name: editName.trim() });
    setEditSubject(null);
    load();
  };

  const handleDelete = async (subject: ClassSubject) => {
    if (!confirm(`Удалить предмет "${subject.name}"?`)) return;
    await api.delete(`/school/class-subjects/${subject.id}/`);
    load();
  };

  const getMenuItems = (subject: ClassSubject): MenuItem[] => [
    { label: 'Изменить', onClick: () => openEdit(subject) },
    { label: 'Удалить', onClick: () => handleDelete(subject), danger: true },
  ];

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={openCreate} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
          + Добавить предмет
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-600">Название</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {subjects.map(s => (
              <tr
                key={s.id}
                className="hover:bg-gray-50"
                onContextMenu={e => { e.preventDefault(); setCtxMenu({ subject: s, x: e.clientX, y: e.clientY }); }}
              >
                <td className="px-4 py-2">{s.name}</td>
                <td className="px-2 py-2 text-center">
                  <button
                    onClick={e => { e.stopPropagation(); setCtxMenu({ subject: s, x: e.clientX, y: e.clientY }); }}
                    className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
                  >&#8942;</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {subjects.length === 0 && <p className="text-center text-gray-400 py-8">Предметы не добавлены</p>}
      </div>

      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={getMenuItems(ctxMenu.subject)} onClose={() => setCtxMenu(null)} />
      )}

      {/* Batch Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Добавление предметов</h3>
            <div className="overflow-auto flex-1 space-y-1">
              {rows.map((row, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    id={`subj-${idx}`}
                    value={row}
                    onChange={e => setRows(r => r.map((v, i) => i === idx ? e.target.value : v))}
                    onKeyDown={e => handleRowKeyDown(e, idx)}
                    className="flex-1 border rounded px-2 py-1.5 text-sm"
                    placeholder="Математика"
                  />
                  {rows.length > 1 && (
                    <button onClick={() => setRows(r => r.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 text-lg leading-none px-1">&times;</button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center mt-4 pt-4 border-t">
              <button onClick={() => setRows(r => [...r, ''])} className="text-blue-600 hover:text-blue-800 text-sm">+ Ещё строка</button>
              <div className="flex gap-2">
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Отмена</button>
                <button onClick={handleCreate} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">Создать</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editSubject && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setEditSubject(null)}>
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Редактирование предмета</h3>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Название *</label>
              <input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setEditSubject(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Отмена</button>
              <button onClick={handleEdit} disabled={!editName.trim()} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
