import { useState, useEffect } from 'react';
import api from '../../api/client';
import type { ClassSubject, ClassGroup, TeacherOption } from '../../types';
import ContextMenu from '../ContextMenu';
import type { MenuItem } from '../ContextMenu';

interface Props {
  classId: number;
}

interface SubjectRow {
  name: string;
  teacher: string;
  group: string;
}

const emptyRow = (): SubjectRow => ({ name: '', teacher: '', group: '' });

export default function ClassSubjects({ classId }: Props) {
  const [subjects, setSubjects] = useState<ClassSubject[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [groups, setGroups] = useState<ClassGroup[]>([]);
  const [ctxMenu, setCtxMenu] = useState<{ subject: ClassSubject; x: number; y: number } | null>(null);

  // Batch create
  const [showCreate, setShowCreate] = useState(false);
  const [rows, setRows] = useState<SubjectRow[]>([emptyRow()]);

  // Edit
  const [editSubject, setEditSubject] = useState<ClassSubject | null>(null);
  const [editForm, setEditForm] = useState({ name: '', teacher: '', group: '' });

  const load = async () => {
    const [sRes, tRes, gRes] = await Promise.all([
      api.get(`/school/classes/${classId}/subjects/`),
      api.get('/school/teachers/'),
      api.get(`/school/classes/${classId}/groups/`),
    ]);
    setSubjects(sRes.data);
    setTeachers(tRes.data);
    setGroups(gRes.data);
  };

  useEffect(() => { load(); }, [classId]);

  // --- Batch create ---
  const openCreate = () => {
    setRows([emptyRow()]);
    setShowCreate(true);
  };

  const updateRow = (idx: number, field: keyof SubjectRow, value: string) => {
    setRows(r => r.map((row, i) => i === idx ? { ...row, [field]: value } : row));
  };

  const handleRowKeyDown = (e: React.KeyboardEvent, rowIdx: number, fieldIdx: number) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (fieldIdx < 2) {
      document.getElementById(`subj-${rowIdx}-${fieldIdx + 1}`)?.focus();
    } else {
      setRows(r => [...r, emptyRow()]);
      setTimeout(() => document.getElementById(`subj-${rowIdx + 1}-0`)?.focus(), 0);
    }
  };

  const handleCreate = async () => {
    const valid = rows.filter(r => r.name.trim());
    if (valid.length === 0) return;
    const payload = valid.map(r => ({
      name: r.name.trim(),
      teacher: r.teacher ? parseInt(r.teacher) : null,
      group: r.group ? parseInt(r.group) : null,
    }));
    await api.post(`/school/classes/${classId}/subjects/`, payload);
    setShowCreate(false);
    load();
  };

  // --- Edit ---
  const openEdit = (subject: ClassSubject) => {
    setEditSubject(subject);
    setEditForm({
      name: subject.name,
      teacher: subject.teacher ? String(subject.teacher) : '',
      group: subject.group ? String(subject.group) : '',
    });
  };

  const handleEdit = async () => {
    if (!editSubject || !editForm.name.trim()) return;
    await api.put(`/school/class-subjects/${editSubject.id}/`, {
      name: editForm.name.trim(),
      teacher: editForm.teacher ? parseInt(editForm.teacher) : null,
      group: editForm.group ? parseInt(editForm.group) : null,
    });
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
              <th className="px-4 py-2 text-left font-medium text-gray-600">Учитель</th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">Группа</th>
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
                <td className="px-4 py-2 text-gray-500">{s.teacher_name || '—'}</td>
                <td className="px-4 py-2 text-gray-500">{s.group_name || 'Весь класс'}</td>
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
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-3xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Добавление предметов</h3>
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b">
                    <th className="pb-2 font-medium">Название *</th>
                    <th className="pb-2 font-medium pl-2">Учитель</th>
                    <th className="pb-2 font-medium pl-2">Группа</th>
                    <th className="pb-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={idx}>
                      <td className="py-1 pr-1">
                        <input
                          id={`subj-${idx}-0`}
                          value={row.name}
                          onChange={e => updateRow(idx, 'name', e.target.value)}
                          onKeyDown={e => handleRowKeyDown(e, idx, 0)}
                          className="w-full border rounded px-2 py-1.5 text-sm"
                          placeholder="Математика"
                        />
                      </td>
                      <td className="py-1 px-1">
                        <select
                          id={`subj-${idx}-1`}
                          value={row.teacher}
                          onChange={e => updateRow(idx, 'teacher', e.target.value)}
                          onKeyDown={e => handleRowKeyDown(e, idx, 1)}
                          className="w-full border rounded px-2 py-1.5 text-sm"
                        >
                          <option value="">—</option>
                          {teachers.map(t => (
                            <option key={t.id} value={t.id}>{t.last_name} {t.first_name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-1 px-1">
                        <select
                          id={`subj-${idx}-2`}
                          value={row.group}
                          onChange={e => updateRow(idx, 'group', e.target.value)}
                          onKeyDown={e => handleRowKeyDown(e, idx, 2)}
                          className="w-full border rounded px-2 py-1.5 text-sm"
                        >
                          <option value="">Весь класс</option>
                          {groups.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-1 pl-1">
                        {rows.length > 1 && (
                          <button onClick={() => setRows(r => r.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 text-lg leading-none">&times;</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between items-center mt-4 pt-4 border-t">
              <button onClick={() => setRows(r => [...r, emptyRow()])} className="text-blue-600 hover:text-blue-800 text-sm">+ Ещё строка</button>
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
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Название *</label>
                <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Учитель</label>
                <select value={editForm.teacher} onChange={e => setEditForm(f => ({ ...f, teacher: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm">
                  <option value="">Не назначен</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.last_name} {t.first_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Группа</label>
                <select value={editForm.group} onChange={e => setEditForm(f => ({ ...f, group: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm">
                  <option value="">Весь класс</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setEditSubject(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Отмена</button>
              <button onClick={handleEdit} disabled={!editForm.name.trim()} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
