import { useState, useEffect } from 'react';
import api from '../../api/client';
import type { StudentProfile } from '../../types';
import ContextMenu from '../ContextMenu';
import type { MenuItem } from '../ContextMenu';

interface Props {
  classId: number;
}

interface StudentRow {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}

const emptyRow = (): StudentRow => ({
  first_name: '', last_name: '', email: '', phone: '',
});

export default function ClassStudents({ classId }: Props) {
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [ctxMenu, setCtxMenu] = useState<{ student: StudentProfile; x: number; y: number } | null>(null);
  const [editStudent, setEditStudent] = useState<StudentProfile | null>(null);
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', email: '', phone: '' });
  const [message, setMessage] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [rows, setRows] = useState<StudentRow[]>([emptyRow()]);

  const load = async () => {
    const res = await api.get(`/school/classes/${classId}/students/`);
    setStudents(res.data);
  };

  useEffect(() => { load(); }, [classId]);

  const openEdit = (sp: StudentProfile) => {
    setEditStudent(sp);
    setEditForm({
      first_name: sp.user.first_name,
      last_name: sp.user.last_name,
      email: sp.user.email || '',
      phone: sp.user.phone || '',
    });
  };

  const handleEdit = async () => {
    if (!editStudent) return;
    await api.put(`/admin/users/${editStudent.user.id}/`, editForm);
    setEditStudent(null);
    load();
  };

  const handleResetPassword = async (sp: StudentProfile) => {
    if (!confirm(`Сбросить пароль для ${sp.user.last_name} ${sp.user.first_name}?`)) return;
    await api.post(`/admin/users/${sp.user.id}/reset-password/`);
    setMessage(`Пароль сброшен для ${sp.user.last_name} ${sp.user.first_name}`);
    load();
  };

  const handleDelete = async (sp: StudentProfile) => {
    if (!confirm(`Удалить ученика ${sp.user.last_name} ${sp.user.first_name}?`)) return;
    await api.delete(`/admin/users/${sp.user.id}/`);
    load();
  };

  const getMenuItems = (sp: StudentProfile): MenuItem[] => [
    { label: 'Изменить', onClick: () => openEdit(sp) },
    { label: 'Сбросить пароль', onClick: () => handleResetPassword(sp) },
    { label: 'Удалить', onClick: () => handleDelete(sp), danger: true },
  ];

  const openCreateModal = () => {
    setRows([emptyRow()]);
    setShowCreate(true);
  };

  const handleCreate = async () => {
    const valid = rows.filter(r => r.first_name.trim() && r.last_name.trim());
    if (valid.length === 0) return;
    const payload = valid.map(r => ({
      ...r,
      school_class: classId,
    }));
    try {
      const res = await api.post('/admin/students/', payload);
      const parts: string[] = [`Создано: ${res.data.created.length} ученик(ов)`];
      if (res.data.warnings?.length) parts.push(`Тёзки: ${res.data.warnings.join('; ')}`);
      if (res.data.errors?.length) parts.push(`Ошибки: ${res.data.errors.join('; ')}`);
      setMessage(parts.join('. '));
      setShowCreate(false);
      load();
    } catch (err: any) {
      setMessage(err.response?.data?.detail || 'Ошибка создания');
    }
  };

  const updateRow = (idx: number, field: keyof StudentRow, value: string) => {
    setRows(r => r.map((row, i) => i === idx ? { ...row, [field]: value } : row));
  };

  const handleRowKeyDown = (e: React.KeyboardEvent, rowIdx: number, fieldIdx: number) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (fieldIdx < 3) {
      document.getElementById(`cs-${rowIdx}-${fieldIdx + 1}`)?.focus();
    } else {
      setRows(r => [...r, emptyRow()]);
      setTimeout(() => document.getElementById(`cs-${rowIdx + 1}-0`)?.focus(), 0);
    }
  };

  return (
    <div>
      {message && (
        <div className="bg-blue-50 text-blue-700 p-3 rounded mb-4 text-sm flex justify-between">
          {message}
          <button onClick={() => setMessage('')} className="text-blue-400 hover:text-blue-600 ml-4">x</button>
        </div>
      )}

      <div className="flex justify-end mb-4">
        <button onClick={openCreateModal} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
          + Добавить
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-600">Фамилия</th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">Имя</th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">Email</th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">Телефон</th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">Врем. пароль</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {students.map(sp => (
              <tr
                key={sp.id}
                className="hover:bg-gray-50"
                onContextMenu={e => { e.preventDefault(); setCtxMenu({ student: sp, x: e.clientX, y: e.clientY }); }}
              >
                <td className="px-4 py-2">{sp.user.last_name}</td>
                <td className="px-4 py-2">{sp.user.first_name}</td>
                <td className="px-4 py-2 text-gray-500">{sp.user.email || '—'}</td>
                <td className="px-4 py-2 text-gray-500">{sp.user.phone || '—'}</td>
                <td className="px-4 py-2">
                  {sp.user.must_change_password && sp.user.temp_password ? (
                    <code className="bg-yellow-50 text-yellow-700 px-2 py-1 rounded text-xs">{sp.user.temp_password}</code>
                  ) : '—'}
                </td>
                <td className="px-2 py-2 text-center">
                  <button
                    onClick={e => { e.stopPropagation(); setCtxMenu({ student: sp, x: e.clientX, y: e.clientY }); }}
                    className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
                  >&#8942;</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {students.length === 0 && <p className="text-center text-gray-400 py-8">В этом классе нет учеников</p>}
      </div>

      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={getMenuItems(ctxMenu.student)} onClose={() => setCtxMenu(null)} />
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Добавление учеников</h3>
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b">
                    <th className="pb-2 font-medium">Фамилия *</th>
                    <th className="pb-2 font-medium pl-2">Имя *</th>
                    <th className="pb-2 font-medium pl-2">Email</th>
                    <th className="pb-2 font-medium pl-2">Телефон</th>
                    <th className="pb-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={idx}>
                      <td className="py-1 pr-1">
                        <input id={`cs-${idx}-0`} value={row.last_name} onChange={e => updateRow(idx, 'last_name', e.target.value)} onKeyDown={e => handleRowKeyDown(e, idx, 0)} className="w-full border rounded px-2 py-1.5 text-sm" />
                      </td>
                      <td className="py-1 px-1">
                        <input id={`cs-${idx}-1`} value={row.first_name} onChange={e => updateRow(idx, 'first_name', e.target.value)} onKeyDown={e => handleRowKeyDown(e, idx, 1)} className="w-full border rounded px-2 py-1.5 text-sm" />
                      </td>
                      <td className="py-1 px-1">
                        <input id={`cs-${idx}-2`} value={row.email} onChange={e => updateRow(idx, 'email', e.target.value)} onKeyDown={e => handleRowKeyDown(e, idx, 2)} className="w-full border rounded px-2 py-1.5 text-sm" />
                      </td>
                      <td className="py-1 px-1">
                        <input id={`cs-${idx}-3`} value={row.phone} onChange={e => updateRow(idx, 'phone', e.target.value)} onKeyDown={e => handleRowKeyDown(e, idx, 3)} className="w-full border rounded px-2 py-1.5 text-sm" />
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
      {editStudent && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setEditStudent(null)}>
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Редактирование ученика</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Фамилия</label>
                <input value={editForm.last_name} onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Имя</label>
                <input value={editForm.first_name} onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Email</label>
                <input value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Телефон</label>
                <input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setEditStudent(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Отмена</button>
              <button onClick={handleEdit} disabled={!editForm.first_name.trim() || !editForm.last_name.trim()} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
