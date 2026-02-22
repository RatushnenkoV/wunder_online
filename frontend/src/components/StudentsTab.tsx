import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import type { User, SchoolClass, Parent, ParentChild } from '../types';
import ContextMenu from './ContextMenu';
import type { MenuItem } from './ContextMenu';

interface StudentUser extends User {
  school_class_id: number | null;
  school_class_name: string;
  student_profile_id: number | null;
}

interface StudentRow {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  school_class: number | string;
}

const emptyRow = (classId?: number): StudentRow => ({
  first_name: '', last_name: '', email: '', phone: '', school_class: classId || '',
});

interface ParentForm {
  last_name: string;
  first_name: string;
  email: string;
  phone: string;
  telegram: string;
  birth_date: string;
}

export default function StudentsTab() {
  const [students, setStudents] = useState<StudentUser[]>([]);
  const [pagination, setPagination] = useState({ page: 1, per_page: 25, total: 0, pages: 1 });
  const [filters, setFilters] = useState({ last_name: '', first_name: '', email: '', phone: '', school_class: '' });
  const [sort, setSort] = useState({ field: 'last_name', direction: 'asc' as 'asc' | 'desc' });
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [rows, setRows] = useState<StudentRow[]>([emptyRow()]);
  const [message, setMessage] = useState('');

  // Student edit modal
  const [editUser, setEditUser] = useState<StudentUser | null>(null);
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', email: '', phone: '', birth_date: '', school_class: '' as string | number });
  const [studentParents, setStudentParents] = useState<Parent[]>([]);
  const [showAddParent, setShowAddParent] = useState(false);
  const [parentSearch, setParentSearch] = useState('');
  const [parentSearchResults, setParentSearchResults] = useState<Parent[]>([]);
  const [newParentForm, setNewParentForm] = useState({ last_name: '', first_name: '', phone: '', telegram: '' });
  const [addParentMode, setAddParentMode] = useState<'search' | 'create'>('search');
  const [studentProfileId, setStudentProfileId] = useState<number | null>(null);

  // Cross-nav: parent card opened from student card
  const [crossNavParent, setCrossNavParent] = useState<Parent | null>(null);
  const [crossNavParentForm, setCrossNavParentForm] = useState<ParentForm>({ last_name: '', first_name: '', email: '', phone: '', telegram: '', birth_date: '' });
  const [crossNavParentChildren, setCrossNavParentChildren] = useState<ParentChild[]>([]);
  const [crossNavChildSearch, setCrossNavChildSearch] = useState('');
  const [crossNavChildResults, setCrossNavChildResults] = useState<StudentUser[]>([]);

  const [ctxMenu, setCtxMenu] = useState<{ user: StudentUser; x: number; y: number } | null>(null);

  useEffect(() => {
    api.get('/school/classes/').then(r => setClasses(r.data));
  }, []);

  const loadList = useCallback(async (page = pagination.page) => {
    const params: Record<string, string> = {
      page: String(page),
      per_page: String(pagination.per_page),
      sort: sort.field,
      direction: sort.direction,
    };
    if (filters.last_name) params.last_name = filters.last_name;
    if (filters.first_name) params.first_name = filters.first_name;
    if (filters.email) params.email = filters.email;
    if (filters.phone) params.phone = filters.phone;
    if (filters.school_class) params.school_class = filters.school_class;

    const res = await api.get('/admin/students/', { params });
    setStudents(res.data.results);
    setPagination(res.data.pagination);
  }, [filters, sort, pagination.per_page, pagination.page]);

  useEffect(() => { loadList(1); }, [filters, sort, pagination.per_page]);

  const toggleSort = (field: string) => {
    setSort(s => s.field === field ? { field, direction: s.direction === 'asc' ? 'desc' : 'asc' } : { field, direction: 'asc' });
  };

  const sortIcon = (field: string) => {
    if (sort.field !== field) return ' \u2195';
    return sort.direction === 'asc' ? ' \u2191' : ' \u2193';
  };

  const handleCreate = async () => {
    const valid = rows.filter(r => r.first_name.trim() && r.last_name.trim());
    if (valid.length === 0) return;
    const payload = valid.map(r => ({ ...r, school_class: r.school_class || undefined }));
    try {
      const res = await api.post('/admin/students/', payload);
      const parts: string[] = [`Создано: ${res.data.created.length} ученик(ов)`];
      if (res.data.warnings?.length) parts.push(`Тёзки: ${res.data.warnings.join('; ')}`);
      if (res.data.errors?.length) parts.push(`Ошибки: ${res.data.errors.join('; ')}`);
      setMessage(parts.join('. '));
      setShowCreate(false);
      loadList(1);
    } catch (err: any) {
      setMessage(err.response?.data?.detail || 'Ошибка создания');
    }
  };

  const handleResetPassword = async (user: StudentUser) => {
    if (!confirm(`Сбросить пароль для ${user.last_name} ${user.first_name}?`)) return;
    await api.post(`/admin/users/${user.id}/reset-password/`);
    loadList();
  };

  const handleDelete = async (user: StudentUser) => {
    if (!confirm(`Удалить ученика ${user.last_name} ${user.first_name}?`)) return;
    await api.delete(`/admin/users/${user.id}/`);
    loadList();
  };

  const openEdit = async (user: StudentUser) => {
    setEditUser(user);
    setEditForm({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email || '',
      phone: user.phone || '',
      birth_date: user.birth_date || '',
      school_class: user.school_class_id || '',
    });
    setShowAddParent(false);
    setParentSearch('');
    setParentSearchResults([]);
    setNewParentForm({ last_name: '', first_name: '', phone: '', telegram: '' });
    setCrossNavParent(null);

    const spId = user.student_profile_id;
    setStudentProfileId(spId);
    if (spId) {
      try {
        const parentsRes = await api.get(`/school/students/${spId}/parents/`);
        setStudentParents(parentsRes.data);
      } catch { setStudentParents([]); }
    } else {
      setStudentParents([]);
    }
  };

  const handleEdit = async () => {
    if (!editUser) return;
    try {
      await api.put(`/admin/users/${editUser.id}/`, {
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        email: editForm.email,
        phone: editForm.phone,
        birth_date: editForm.birth_date || null,
        school_class: editForm.school_class || null,
      });
      setEditUser(null);
      setMessage('Данные обновлены');
      loadList();
    } catch (err: any) {
      setMessage(err.response?.data?.detail || 'Ошибка сохранения');
    }
  };

  const handleSearchParents = async (q: string) => {
    setParentSearch(q);
    if (!q.trim()) { setParentSearchResults([]); return; }
    try {
      const res = await api.get('/admin/parents/', { params: { search: q, per_page: '10' } });
      setParentSearchResults(res.data.results);
    } catch { setParentSearchResults([]); }
  };

  const handleLinkParent = async (parentId: number) => {
    if (!studentProfileId) return;
    try {
      const res = await api.post(`/school/students/${studentProfileId}/parents/`, { action: 'add', parent_id: parentId });
      setStudentParents(res.data);
      setShowAddParent(false);
      setParentSearch('');
      setParentSearchResults([]);
    } catch { /* ignore */ }
  };

  const handleUnlinkParent = async (parentId: number) => {
    if (!studentProfileId) return;
    try {
      const res = await api.post(`/school/students/${studentProfileId}/parents/`, { action: 'remove', parent_id: parentId });
      setStudentParents(res.data);
    } catch { /* ignore */ }
  };

  const handleCreateAndLinkParent = async () => {
    if (!newParentForm.first_name.trim() || !newParentForm.last_name.trim()) return;
    if (!studentProfileId) return;
    try {
      const created = await api.post('/admin/parents/', {
        ...newParentForm,
        children: [studentProfileId],
      });
      setStudentParents(p => [...p, created.data]);
      setShowAddParent(false);
      setNewParentForm({ last_name: '', first_name: '', phone: '', telegram: '' });
    } catch { /* ignore */ }
  };

  // --- Cross-nav: parent card ---
  const openCrossNavParent = (p: Parent) => {
    setCrossNavParent(p);
    setCrossNavParentForm({
      last_name: p.last_name,
      first_name: p.first_name,
      email: p.email || '',
      phone: p.phone || '',
      telegram: p.telegram || '',
      birth_date: p.birth_date || '',
    });
    setCrossNavParentChildren(p.children || []);
    setCrossNavChildSearch('');
    setCrossNavChildResults([]);
  };

  const saveCrossNavParent = async () => {
    if (!crossNavParent) return;
    try {
      const spIds = crossNavParentChildren.map(c => c.student_profile_id);
      await api.put(`/admin/parents/${crossNavParent.id}/`, {
        ...crossNavParentForm,
        birth_date: crossNavParentForm.birth_date || null,
        children: spIds,
      });
      setCrossNavParent(null);
      setMessage('Данные родителя обновлены');
      if (studentProfileId) {
        const parentsRes = await api.get(`/school/students/${studentProfileId}/parents/`);
        setStudentParents(parentsRes.data);
      }
    } catch (err: any) {
      setMessage(err.response?.data?.detail || 'Ошибка сохранения');
    }
  };

  const searchStudentsForCrossNav = async (q: string) => {
    setCrossNavChildSearch(q);
    if (!q.trim()) { setCrossNavChildResults([]); return; }
    try {
      const res = await api.get('/admin/students/', { params: { search: q, per_page: '10' } });
      setCrossNavChildResults(res.data.results);
    } catch { setCrossNavChildResults([]); }
  };

  const addChildToCrossNavParent = (s: StudentUser) => {
    if (!s.student_profile_id) return;
    if (crossNavParentChildren.find(c => c.student_profile_id === s.student_profile_id)) return;
    setCrossNavParentChildren(prev => [...prev, {
      id: s.id,
      student_profile_id: s.student_profile_id!,
      first_name: s.first_name,
      last_name: s.last_name,
      school_class_name: s.school_class_name || '',
    }]);
    setCrossNavChildSearch('');
    setCrossNavChildResults([]);
  };

  const handleRowKeyDown = (e: React.KeyboardEvent, rowIdx: number, fieldIdx: number) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (fieldIdx < 3) {
      document.getElementById(`student-${rowIdx}-${fieldIdx + 1}`)?.focus();
    } else {
      setRows(r => [...r, emptyRow()]);
      setTimeout(() => document.getElementById(`student-${rowIdx + 1}-0`)?.focus(), 0);
    }
  };

  const updateRow = (idx: number, field: keyof StudentRow, value: any) => {
    setRows(r => r.map((row, i) => i === idx ? { ...row, [field]: value } : row));
  };

  const openContextMenu = (user: StudentUser, x: number, y: number) => {
    setCtxMenu({ user, x, y });
  };

  const getMenuItems = (user: StudentUser): MenuItem[] => [
    { label: 'Изменить', onClick: () => openEdit(user) },
    { label: 'Сбросить пароль', onClick: () => handleResetPassword(user) },
    { label: 'Удалить', onClick: () => handleDelete(user), danger: true },
  ];

  return (
    <div>
      {message && (
        <div className="bg-blue-50 text-blue-700 p-3 rounded mb-4 text-sm flex justify-between">
          {message}
          <button onClick={() => setMessage('')} className="text-blue-400 hover:text-blue-600 ml-4">×</button>
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          По:
          {[10, 25, 50].map(n => (
            <button key={n} onClick={() => setPagination(p => ({ ...p, per_page: n }))}
              className={`px-2 py-1 rounded ${pagination.per_page === n ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
              {n}
            </button>
          ))}
        </div>
        <button onClick={() => { setRows([emptyRow()]); setShowCreate(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
          + Добавить
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">
                <button onClick={() => toggleSort('last_name')} className="font-medium text-gray-600 hover:text-gray-900">
                  Фамилия{sortIcon('last_name')}
                </button>
                <input placeholder="Фильтр..." value={filters.last_name} onChange={e => setFilters(f => ({ ...f, last_name: e.target.value }))} className="block w-full border rounded px-2 py-1 text-xs mt-1 font-normal" />
              </th>
              <th className="px-4 py-2 text-left">
                <button onClick={() => toggleSort('first_name')} className="font-medium text-gray-600 hover:text-gray-900">
                  Имя{sortIcon('first_name')}
                </button>
                <input placeholder="Фильтр..." value={filters.first_name} onChange={e => setFilters(f => ({ ...f, first_name: e.target.value }))} className="block w-full border rounded px-2 py-1 text-xs mt-1 font-normal" />
              </th>
              <th className="px-4 py-2 text-left">
                <span className="font-medium text-gray-600">Email</span>
                <input placeholder="Фильтр..." value={filters.email} onChange={e => setFilters(f => ({ ...f, email: e.target.value }))} className="block w-full border rounded px-2 py-1 text-xs mt-1 font-normal" />
              </th>
              <th className="px-4 py-2 text-left">
                <span className="font-medium text-gray-600">Телефон</span>
                <input placeholder="Фильтр..." value={filters.phone} onChange={e => setFilters(f => ({ ...f, phone: e.target.value }))} className="block w-full border rounded px-2 py-1 text-xs mt-1 font-normal" />
              </th>
              <th className="px-4 py-2 text-left">
                <button onClick={() => toggleSort('school_class')} className="font-medium text-gray-600 hover:text-gray-900">
                  Класс{sortIcon('school_class')}
                </button>
                <select value={filters.school_class} onChange={e => setFilters(f => ({ ...f, school_class: e.target.value }))} className="block w-full border rounded px-2 py-1 text-xs mt-1 font-normal">
                  <option value="">Все</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.display_name}</option>)}
                </select>
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">Врем. пароль</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {students.map(u => (
              <tr
                key={u.id}
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => openEdit(u)}
                onContextMenu={e => { e.preventDefault(); openContextMenu(u, e.clientX, e.clientY); }}
              >
                <td className="px-4 py-2">{u.last_name}</td>
                <td className="px-4 py-2">{u.first_name}</td>
                <td className="px-4 py-2 text-gray-500">{u.email || '—'}</td>
                <td className="px-4 py-2 text-gray-500">{u.phone || '—'}</td>
                <td className="px-4 py-2 text-gray-500">{u.school_class_name || '—'}</td>
                <td className="px-4 py-2">
                  {u.must_change_password && u.temp_password ? (
                    <code className="bg-yellow-50 text-yellow-700 px-2 py-1 rounded text-xs">{u.temp_password}</code>
                  ) : '—'}
                </td>
                <td className="px-2 py-2 text-center">
                  <button
                    onClick={e => { e.stopPropagation(); openContextMenu(u, e.clientX, e.clientY); }}
                    className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
                  >
                    &#8942;
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {students.length === 0 && <p className="text-center text-gray-400 py-8">Ученики не найдены</p>}
      </div>

      {pagination.pages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => loadList(pagination.page - 1)} disabled={pagination.page <= 1} className="px-3 py-1 rounded border text-sm disabled:opacity-30">&lt;</button>
          <span className="px-3 py-1 text-sm text-gray-600">{pagination.page} / {pagination.pages} (всего: {pagination.total})</span>
          <button onClick={() => loadList(pagination.page + 1)} disabled={pagination.page >= pagination.pages} className="px-3 py-1 rounded border text-sm disabled:opacity-30">&gt;</button>
        </div>
      )}

      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={getMenuItems(ctxMenu.user)} onClose={() => setCtxMenu(null)} />
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-3xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Добавление учеников</h3>
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b">
                    <th className="pb-2 font-medium">Фамилия *</th>
                    <th className="pb-2 font-medium pl-2">Имя *</th>
                    <th className="pb-2 font-medium pl-2">Email</th>
                    <th className="pb-2 font-medium pl-2">Телефон</th>
                    <th className="pb-2 font-medium pl-2">Класс</th>
                    <th className="pb-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={idx}>
                      <td className="py-1 pr-1">
                        <input id={`student-${idx}-0`} value={row.last_name} onChange={e => updateRow(idx, 'last_name', e.target.value)} onKeyDown={e => handleRowKeyDown(e, idx, 0)} className="w-full border rounded px-2 py-1.5 text-sm" />
                      </td>
                      <td className="py-1 px-1">
                        <input id={`student-${idx}-1`} value={row.first_name} onChange={e => updateRow(idx, 'first_name', e.target.value)} onKeyDown={e => handleRowKeyDown(e, idx, 1)} className="w-full border rounded px-2 py-1.5 text-sm" />
                      </td>
                      <td className="py-1 px-1">
                        <input id={`student-${idx}-2`} value={row.email} onChange={e => updateRow(idx, 'email', e.target.value)} onKeyDown={e => handleRowKeyDown(e, idx, 2)} className="w-full border rounded px-2 py-1.5 text-sm" />
                      </td>
                      <td className="py-1 px-1">
                        <input id={`student-${idx}-3`} value={row.phone} onChange={e => updateRow(idx, 'phone', e.target.value)} onKeyDown={e => handleRowKeyDown(e, idx, 3)} className="w-full border rounded px-2 py-1.5 text-sm" />
                      </td>
                      <td className="py-1 px-1">
                        <select value={row.school_class} onChange={e => updateRow(idx, 'school_class', e.target.value ? parseInt(e.target.value) : '')} className="w-full border rounded px-2 py-1.5 text-sm">
                          <option value="">—</option>
                          {classes.map(c => <option key={c.id} value={c.id}>{c.display_name}</option>)}
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

      {/* Student Edit Modal */}
      {editUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setEditUser(null)}>
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Редактирование ученика</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Фамилия *</label>
                <input value={editForm.last_name} onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Имя *</label>
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
              <div>
                <label className="block text-sm text-gray-600 mb-1">Дата рождения</label>
                <input type="date" value={editForm.birth_date} onChange={e => setEditForm(f => ({ ...f, birth_date: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Класс</label>
                <select value={editForm.school_class} onChange={e => setEditForm(f => ({ ...f, school_class: e.target.value ? parseInt(e.target.value) : '' }))} className="w-full border rounded px-3 py-2 text-sm">
                  <option value="">Без класса</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.display_name}</option>)}
                </select>
              </div>

              {/* Родители */}
              {studentProfileId !== null && (
                <div className="border-t pt-3 mt-2">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700">Родители</label>
                    <button onClick={() => { setShowAddParent(v => !v); setAddParentMode('search'); }} className="text-xs text-blue-600 hover:text-blue-800">+ Добавить</button>
                  </div>
                  {studentParents.length > 0 ? (
                    <div className="space-y-1.5 mb-2">
                      {studentParents.map(p => (
                        <div key={p.id} className="flex justify-between items-center bg-gray-50 rounded px-3 py-1.5 text-sm">
                          <button
                            onClick={() => openCrossNavParent(p)}
                            className="text-blue-600 hover:underline text-left flex-1 text-sm"
                          >
                            {p.last_name} {p.first_name}{p.phone ? ` · ${p.phone}` : ''}
                          </button>
                          <button onClick={() => handleUnlinkParent(p.id)} className="text-red-400 hover:text-red-600 text-xs ml-2">Отвязать</button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 mb-2">Родители не привязаны</p>
                  )}
                  {showAddParent && (
                    <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
                      <div className="flex gap-2 mb-1">
                        <button onClick={() => setAddParentMode('search')} className={`text-xs px-2 py-1 rounded ${addParentMode === 'search' ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600'}`}>Найти существующего</button>
                        <button onClick={() => setAddParentMode('create')} className={`text-xs px-2 py-1 rounded ${addParentMode === 'create' ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600'}`}>Создать нового</button>
                      </div>
                      {addParentMode === 'search' ? (
                        <>
                          <input placeholder="Поиск по фамилии..." value={parentSearch} onChange={e => handleSearchParents(e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs" />
                          {parentSearchResults.map(p => (
                            <div key={p.id} className="flex justify-between items-center text-xs bg-white rounded px-2 py-1.5 border">
                              <span>{p.last_name} {p.first_name}</span>
                              <button onClick={() => handleLinkParent(p.id)} className="text-blue-600 hover:text-blue-800 ml-2">Привязать</button>
                            </div>
                          ))}
                          {parentSearch && parentSearchResults.length === 0 && <p className="text-xs text-gray-400">Не найдено</p>}
                        </>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="flex gap-1">
                            <input placeholder="Фамилия *" value={newParentForm.last_name} onChange={e => setNewParentForm(f => ({ ...f, last_name: e.target.value }))} className="flex-1 border rounded px-2 py-1.5 text-xs" />
                            <input placeholder="Имя *" value={newParentForm.first_name} onChange={e => setNewParentForm(f => ({ ...f, first_name: e.target.value }))} className="flex-1 border rounded px-2 py-1.5 text-xs" />
                          </div>
                          <input placeholder="Телефон" value={newParentForm.phone} onChange={e => setNewParentForm(f => ({ ...f, phone: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-xs" />
                          <input placeholder="Telegram" value={newParentForm.telegram} onChange={e => setNewParentForm(f => ({ ...f, telegram: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-xs" />
                          <button onClick={handleCreateAndLinkParent} disabled={!newParentForm.first_name.trim() || !newParentForm.last_name.trim()} className="w-full bg-blue-600 text-white text-xs py-1.5 rounded disabled:opacity-50 hover:bg-blue-700">
                            Создать и привязать
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setEditUser(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Отмена</button>
              <button onClick={handleEdit} disabled={!editForm.first_name.trim() || !editForm.last_name.trim()} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Parent cross-nav modal (z-[60], поверх карточки ученика) */}
      {crossNavParent && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]" onClick={() => setCrossNavParent(null)}>
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => setCrossNavParent(null)} className="text-gray-400 hover:text-gray-600 text-sm">← Назад</button>
              <h3 className="text-lg font-semibold">Карточка родителя</h3>
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-sm text-gray-600 mb-1">Фамилия *</label>
                  <input value={crossNavParentForm.last_name} onChange={e => setCrossNavParentForm(f => ({ ...f, last_name: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm text-gray-600 mb-1">Имя *</label>
                  <input value={crossNavParentForm.first_name} onChange={e => setCrossNavParentForm(f => ({ ...f, first_name: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Телефон</label>
                <input value={crossNavParentForm.phone} onChange={e => setCrossNavParentForm(f => ({ ...f, phone: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Email</label>
                <input value={crossNavParentForm.email} onChange={e => setCrossNavParentForm(f => ({ ...f, email: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Telegram</label>
                <input value={crossNavParentForm.telegram} onChange={e => setCrossNavParentForm(f => ({ ...f, telegram: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" placeholder="@username" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Дата рождения</label>
                <input type="date" value={crossNavParentForm.birth_date} onChange={e => setCrossNavParentForm(f => ({ ...f, birth_date: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div className="border-t pt-3">
                <label className="block text-sm text-gray-600 mb-2">Дети</label>
                {crossNavParentChildren.map(c => (
                  <div key={c.student_profile_id} className="flex justify-between items-center bg-gray-50 rounded px-3 py-1.5 text-sm mb-1">
                    <span>{c.last_name} {c.first_name}{c.school_class_name ? ` · ${c.school_class_name}` : ''}</span>
                    <button onClick={() => setCrossNavParentChildren(p => p.filter(x => x.student_profile_id !== c.student_profile_id))} className="text-red-400 text-xs ml-2">×</button>
                  </div>
                ))}
                <input
                  placeholder="Добавить ученика..."
                  value={crossNavChildSearch}
                  onChange={e => searchStudentsForCrossNav(e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-sm mt-1"
                />
                {crossNavChildResults.map(s => (
                  <div key={s.id} className="flex justify-between items-center text-sm bg-white rounded px-2 py-1.5 border mt-1">
                    <span>{s.last_name} {s.first_name}{s.school_class_name ? ` · ${s.school_class_name}` : ''}</span>
                    <button onClick={() => addChildToCrossNavParent(s)} className="text-blue-600 text-xs ml-2">Добавить</button>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setCrossNavParent(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Отмена</button>
              <button onClick={saveCrossNavParent} disabled={!crossNavParentForm.first_name.trim() || !crossNavParentForm.last_name.trim()} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
